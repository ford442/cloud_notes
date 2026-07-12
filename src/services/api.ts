// src/services/api.ts
// Cloud Notes API Service - Integrated with Contabo Storage Manager

import { db, CACHE_KEYS, STORE_NOTES_LIST, STORE_NOTES_CONTENT, STORE_PENDING_OPS, STORE_HISTORY, getPendingOps } from '../utils/db';
import { EncryptionService } from '../utils/encryption';
import { BacklinkService } from './BacklinkService';
import { createPackedDescription } from '../utils/metadata';
import { vpsStorageAPI } from './vpsStorageAPI';


async function saveToHistory(id: string, note: Note, author: string) {
    try {
        const history = await db.get<any[]>(STORE_HISTORY, id) || [];
        const newHistory = [...history, {
            timestamp: Date.now(),
            content: note.content,
            author: author
        }].slice(-50); // Keep last 50 versions
        await db.set(STORE_HISTORY, id, newHistory);
    } catch (e) {
        console.warn('Failed to save to history', e);
    }
}

function slugify(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-');
}

// Storage Manager API endpoint
export const API_BASE_URL = localStorage.getItem('api_url') || "https://storage.noahcohn.com";

// 1. EXPANDED: Now handles creates, updates, and deletes
interface PendingOp {
  id: string;
  type: 'create' | 'update' | 'delete';
  noteId: string; // Can be a temporary UUID if created offline
  note?: Note;
  author?: string;
  timestamp: number;
  retries?: number;
  nextRetry?: number;
}

export interface Note {
  id?: string;
  title: string;
  content: string;
  subject: string;
  section: string;
  tags: string;
  updatedAt?: string;
  lastEdited?: string;
  wordCount?: number;
  lastSyncedAt?: number;
}

export interface CloudItemMeta {
  id: string;
  name: string;
  author: string;
  date: string;
  type: string;
  description: string;
}

export const StorageService = {
  // --- CACHE FIRST METHODS (For Speed) ---

  async getCachedNotes(): Promise<CloudItemMeta[]> {
    try {
      const cached = await db.get<CloudItemMeta[]>(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES);
      return cached || [];
    } catch (e) {
      console.warn('[Cache] Failed to load cached notes', e);
      return [];
    }
  },

  async getCachedNote(id: string): Promise<Note | undefined> {
    try {
      return await db.get<Note>(STORE_NOTES_CONTENT, id);
    } catch (e) {
      console.warn('[Cache] Failed to load note ' + id, e);
      return undefined;
    }
  },

  // --- THE SYNC ENGINE ---

  async syncPending() {
    if (!navigator.onLine) {
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'Offline' }));
        return;
    }

    try {
      window.dispatchEvent(new CustomEvent('sync-status', { detail: 'Syncing...' }));
      const allOps = await db.getAll<PendingOp>(STORE_PENDING_OPS);
      if (allOps.length === 0) {
          window.dispatchEvent(new CustomEvent('sync-status', { detail: 'Synced' }));
          return;
      }

      const now = Date.now();
      const ops = allOps.filter(item => !item.value.nextRetry || item.value.nextRetry <= now);

      if (ops.length === 0) {
          // Some ops exist but are waiting for backoff
          window.dispatchEvent(new CustomEvent('sync-status', { detail: 'Failed' }));
          return;
      }

      console.log(`[Sync Engine] Processing ${ops.length} offline operations...`);

      // Sort by timestamp to replay history exactly as it happened
      ops.sort((a, b) => a.value.timestamp - b.value.timestamp);

      // Group operations by note ID to batch updates
      const latestOpsMap = new Map<string, { keys: string[], op: PendingOp }>();

      for (const item of ops) {
         const { key, value: op } = item;
         const existing = latestOpsMap.get(op.noteId);
         if (!existing) {
             latestOpsMap.set(op.noteId, { keys: [key], op });
         } else {
             // Combine operations: if it's a create followed by update, treat it as create with new content
             if (existing.op.type === 'create' && op.type === 'update') {
                 latestOpsMap.set(op.noteId, {
                     keys: [...existing.keys, key],
                     op: { ...op, type: 'create', id: existing.op.id }
                 });
             } else if (op.type === 'delete') {
                 // If deleted, override all previous
                 latestOpsMap.set(op.noteId, { keys: [...existing.keys, key], op });
             } else {
                 // Multiple updates, just keep the latest
                 latestOpsMap.set(op.noteId, { keys: [...existing.keys, key], op });
             }
         }
      }

      const consolidatedOps = Array.from(latestOpsMap.values());
      consolidatedOps.sort((a, b) => a.op.timestamp - b.op.timestamp);

      // Map to track temporary offline IDs resolving to real server IDs
      const idMap = new Map<string, string>();
      const successfulOps: PendingOp[] = [];
      let hasFailures = false;

      // We do not want the legacy network methods to fire individual webhooks
      // because we will fire one batch webhook at the end (or individual if only 1 op).
      const skipWebhook = true;

      for (const { keys, op } of consolidatedOps) {
        try {
          let success = false;

          // Resolve the target ID (if this note was created offline, use the new real server ID)
          const targetId = idMap.get(op.noteId) || op.noteId;

          // [CONFLICT RESOLUTION STUB]
          // If pulling before pushing, we would check the remote `updatedAt` vs `op.timestamp`
          // and apply Last-Write-Wins here.
          console.log(`[Sync Engine] Stub: Checking conflict resolution for ${targetId}`);

          if (op.type === 'create' && op.note) {
            const res = await this._networkSaveNote(op.note, op.author || "User", skipWebhook);
            if (res.success && res.id) {
              idMap.set(op.noteId, res.id); // Map the temp ID to the real ID!

              // Clean up local cache: migrate temp ID to real ID
              await db.del(STORE_NOTES_CONTENT, op.noteId);
              await db.set(STORE_NOTES_CONTENT, res.id, { ...op.note, id: res.id });

              success = true;
            }
          }
          else if (op.type === 'update' && op.note) {
            const res = await this._networkUpdateNote(targetId, op.note, op.author || "User", skipWebhook);
            success = res.success;
          }
          else if (op.type === 'delete') {
             const res = await this._networkDeleteNote(targetId, skipWebhook);
             success = res;
          }

          if (success) {
            successfulOps.push(op);
            for (const k of keys) {
              await db.del(STORE_PENDING_OPS, k);
            }
          } else {
            throw new Error(`[Sync Engine] Op ${keys.join(', ')} failed gracefully.`);
          }
        } catch (e) {
          hasFailures = true;
          console.error(`[Sync Engine] Error processing op ${keys.join(', ')}`, e);
          for (const k of keys) {
              const retries = (op.retries || 0) + 1;
              if (retries >= 5) {
                  console.error(`[Sync Engine] Max retries exceeded for ${k}. Dropping operation.`);
                  await db.del(STORE_PENDING_OPS, k);
              } else {
                  const nextRetry = Date.now() + Math.min(30000, 1000 * Math.pow(2, retries));
                  await db.set(STORE_PENDING_OPS, k, { ...op, retries, nextRetry });
              }
          }
        }
      }

      // Batch sync
      if (successfulOps.length > 1) {
          this._dispatchBatchWebhook(successfulOps, idMap);
      } else if (successfulOps.length === 1) {
          const singleOp = successfulOps[0];
          const realId = idMap.get(singleOp.noteId) || singleOp.noteId;
          if (singleOp.type === 'delete') {
              this._networkDeleteNote(realId, false); // fire individual webhook
          } else if (singleOp.note) {
              this._dispatchWebhook({ ...singleOp.note, id: realId }, singleOp.author || "User", singleOp.type);
          }
      }

      // If we synced things successfully, refresh the global cache
      if (consolidatedOps.length > 0) {
          this.getNotes(false).catch(console.warn);
      }

      window.dispatchEvent(new CustomEvent('sync-status', { detail: hasFailures ? 'Failed' : 'Synced' }));

    } catch (e) {
      console.error('[Sync Engine] Failed to run sync queue', e);
      window.dispatchEvent(new CustomEvent('sync-status', { detail: 'Failed' }));
    }
  },

  // --- NETWORK METHODS (With Offline Fallbacks) ---

  async getNotes(skipCacheUpdate = false): Promise<CloudItemMeta[]> {
    try {
      // Fetch note list from storage manager's named notes endpoint
      const notesRes = await fetch(`${API_BASE_URL}/api/notes/list`);
      if (!notesRes.ok) throw new Error("Failed to fetch notes list");
      
      const notes = await notesRes.json();
      
      // Transform to CloudItemMeta format
      let metaList: CloudItemMeta[] = notes.map((n: any) => ({
        id: n.name,
        name: n.name,
        author: 'User',
        date: n.updated_at,
        type: 'note',
        description: ''
      }));

      // Fetch pending operations and merge them with server state
      const pendingOps = await getPendingOps();
      pendingOps.sort((a, b) => a.value.timestamp - b.value.timestamp);
      for (const { value: op } of pendingOps) {
        const pending = op as PendingOp;
        if (pending.type === 'create' && pending.note) {
          const packedDesc = createPackedDescription(pending.note);
          metaList.push({
            id: pending.noteId,
            name: pending.note.title,
            author: pending.author || 'User',
            date: new Date(pending.timestamp).toISOString(),
            type: 'note',
            description: packedDesc
          });
        } else if (pending.type === 'update' && pending.note) {
          const note = pending.note;
          const packedDesc = createPackedDescription(note);
          metaList = metaList.map(item =>
            item.id === pending.noteId
              ? { ...item, name: note.title, description: packedDesc, date: new Date(pending.timestamp).toISOString() }
              : item
          );
        } else if (pending.type === 'delete') {
          metaList = metaList.filter(item => item.id !== pending.noteId);
        }
      }

      // Protect local-only / recently-synced notes that the server doesn't know about yet
      const cached = await this.getCachedNotes();
      for (const cachedNote of cached) {
          const existsOnServerOrPending = metaList.some(m => m.id === cachedNote.id);
          if (!existsOnServerOrPending) {
              metaList.push(cachedNote);
          }
      }

      // Deduplicate by id to prevent React key errors
      metaList = Array.from(new Map(metaList.map(item => [item.id, item])).values());

      if (!skipCacheUpdate) {
        db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, metaList).catch(e =>
          console.warn('[Cache] Failed to update notes list', e)
        );
      }
      return metaList;
    } catch (e) {
      console.warn("[Network] Offline or API unreachable. Falling back to cache.", e);
      return this.getCachedNotes();
    }
  },

  async getNoteContent(id: string): Promise<Note> {
    try {
      // 1. Try cache first to avoid fetching truncated notes from buggy backend
      const cached = await this.getCachedNote(id);
      if (cached) return cached;

      // Check pending ops first to prioritize local truth
      const pendingOps = await getPendingOps();
      for (const { value: op } of pendingOps) {
        const pending = op as PendingOp;
        if (pending.noteId === id && (pending.type === 'create' || pending.type === 'update') && pending.note) {
          return pending.note;
        }
      }

      // Fetch from storage manager's named notes endpoint
      const res = await fetch(`${API_BASE_URL}/api/notes/read/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Failed to load note");
      const data = await res.json();
      
      // Content may be encrypted or plain markdown
      const content = data.content || '';
      let decryptedContent = content;
      const isEncryptedRaw = content.startsWith('ENC:v1:');

      // Attempt to extract the ENC string out of the content
      let extractedEnc = null;
      if (isEncryptedRaw) {
         extractedEnc = content.trim();
      } else {
         const parts = content.split('ENC:v1:');
         if (parts.length > 1) {
            const extracted = parts[1].split('-->')[0].trim();
            extractedEnc = 'ENC:v1:' + extracted;
            console.log("Raw string around ENC:", content.substring(content.indexOf('ENC:v1:') - 20, content.indexOf('ENC:v1:') + 150));
            console.log("Full data.content length:", data.content.length);
            console.log("Extracted enc string ends with char code:", extractedEnc.charCodeAt(extractedEnc.length - 1));
            console.log("Extracted enc string ends with chars:", extractedEnc.slice(-10));
            console.log("Original string ends with char code:", content.charCodeAt(content.length - 1));
         }
      }

      if (extractedEnc) {
         try {
             decryptedContent = await EncryptionService.decrypt(extractedEnc);
         } catch (e) {
             console.warn("Decryption failed safely:", e);
         }
      }

      
      const note: Note = {
        id: data.name,
        title: data.name,
        content: decryptedContent,
        subject: "General",
        section: "Inbox",
        tags: ""
      };

      db.set(STORE_NOTES_CONTENT, id, note).catch(console.warn);
      return note;
    } catch (e) {
      console.warn(`[Network] Offline. Attempting to load ${id} from local DB.`);
      const cached = await this.getCachedNote(id);
      if (cached) return cached;
      throw e;
    }
  },

  // Storage Manager Integration
  // ===========================
  // The cloud_notes app integrates with contabo_storage_manager via webhooks.
  // Notes are sent to /webhook/notes endpoint and stored as timestamped JSON files.
  // For simple named notes (markdown), use the named notes API below.
  
  // Legacy payload format (kept for reference/compatibility)
  async _preparePayload(note: Note, author: string) {
      const packedDesc = createPackedDescription(note);
      const encryptedContent = await EncryptionService.encrypt(note.content);
      const secureNote = { ...note, content: encryptedContent };

      return {
        name: note.title,
        author: author,
        description: packedDesc, 
        type: 'note',
        data: secureNote
      };
  },

  async _generateHmacSignature(payloadStr: string): Promise<string> {
    const secret = localStorage.getItem('webhook_secret');
    if (!secret) return '';

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    // Web Crypto API to generate HMAC SHA-256
    const crypto = window.crypto || (window as any).msCrypto;
    if (!crypto || !crypto.subtle) return '';

    try {
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payloadStr)
      );

      // Convert buffer to hex string
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.warn("Failed to generate HMAC signature", e);
      return '';
    }
  },

  // Bridge Pattern: Dispatches the structured payload asynchronously
  async _dispatchBatchWebhook(ops: PendingOp[], idMap: Map<string, string>): Promise<void> {
      try {
          const payload = {
            source: 'cloud_notes',
            event: 'batch.sync',
            timestamp: new Date().toISOString(),
            data: await Promise.all(ops.map(async op => {
              const realId = idMap.get(op.noteId) || op.noteId;
              if (op.type === 'delete') {
                return { type: 'delete', noteId: realId };
              }
              const packedDesc = createPackedDescription(op.note!);
              const encryptedContent = await EncryptionService.encrypt(op.note!.content);
              return {
                type: op.type,
                noteId: realId,
                data: {
                  id: realId,
                  title: op.note!.title,
                  content: encryptedContent,
                  subject: op.note!.subject || 'General',
                  section: op.note!.section || 'Inbox',
                  tags: op.note!.tags || '',
                  author: op.author || 'User',
                  description: packedDesc,
                  updatedAt: op.note!.updatedAt || new Date().toISOString()
                }
              };
            }))
          };

          const payloadStr = JSON.stringify(payload);
          const signature = await this._generateHmacSignature(payloadStr);

          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };
          if (signature) headers['X-Signature-256'] = signature;

          fetch(`${API_BASE_URL}/webhook/notes`, {
              method: 'POST',
              headers,
              body: payloadStr
          }).catch(e => console.warn(`[Webhook Bridge] Failed to dispatch batch webhook:`, e));

      } catch (e) {
          console.error('[Webhook Bridge] Error preparing batch payload:', e);
      }
  },

  async _dispatchWebhook(note: Note, author: string, action: 'create' | 'update'): Promise<void> {
      try {
          const payload = await this._createWebhookPayload(note, author, action);
          const payloadStr = JSON.stringify(payload);
          const signature = await this._generateHmacSignature(payloadStr);

          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };
          if (signature) headers['X-Signature-256'] = signature;

          // Fire and forget - we do not await this fetch so it doesn't block the UI
          fetch(`${API_BASE_URL}/webhook/notes`, {
              method: 'POST',
              headers,
              body: payloadStr
          }).catch(e => console.warn(`[Webhook Bridge] Failed to dispatch ${action} webhook:`, e));

      } catch (e) {
          console.error('[Webhook Bridge] Error preparing payload:', e);
      }
  },

  // Create payload for storage manager webhook
  async _createWebhookPayload(note: Note, author: string, action: 'create' | 'update') {
      const packedDesc = createPackedDescription(note);
      const encryptedContent = await EncryptionService.encrypt(note.content);
      const noteId = note.id || crypto.randomUUID();
      
      return {
        source: 'cloud_notes',
        event: action === 'create' ? 'note.created' : 'note.updated',
        timestamp: new Date().toISOString(),
        data: {
          id: noteId,
          title: note.title,
          content: encryptedContent,
          subject: note.subject || 'General',
          section: note.section || 'Inbox',
          tags: note.tags || '',
          author: author,
          description: packedDesc,
          updatedAt: note.updatedAt || new Date().toISOString()
        },
        noteId // Return for reference
      };
  },

  // Pure network call for Creates
  async _networkSaveNote(note: Note, author: string, skipWebhook = false): Promise<{ success: boolean; id?: string }> {
      const wordCount = note.content ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;
      note.lastEdited = new Date().toISOString();
      note.wordCount = wordCount;

      const noteName = slugify(note.title);

      // 1. Maintain Legacy API call (Synchronous truth)
      const res = await fetch(`${API_BASE_URL}/api/notes/write/${encodeURIComponent(noteName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note.content })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // 2. Bridge Pattern: Dispatch Webhook (Asynchronous shadow-write)
      if (!skipWebhook) this._dispatchWebhook(note, author, 'create');

      return { success: true, id: data.name || note.title };
  },

  async _networkDeleteNote(id: string, skipWebhook = false): Promise<boolean> {
      const noteName = slugify(id);

      // 1. Maintain Legacy API call (Synchronous truth)
      const deleteRes = await fetch(`${API_BASE_URL}/api/notes/delete/${encodeURIComponent(noteName)}`, {
        method: 'DELETE'
      });
      if (!deleteRes.ok) throw new Error(await deleteRes.text());

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const payload = {
        source: 'cloud_notes',
        event: 'note.deleted',
        timestamp: new Date().toISOString(),
        noteId: id,
        data: { id }
      };

      const payloadStr = JSON.stringify(payload);

      const signature = await this._generateHmacSignature(payloadStr);
      if (signature) {
        headers['X-Signature-256'] = signature;
      }

      if (!skipWebhook) {
        const res = await fetch(`${API_BASE_URL}/webhook/notes`, {
          method: 'POST',
          headers,
          body: payloadStr
        });
        if (!res.ok) throw new Error(await res.text());
      }

      return true;
  },

  // Pure network call for Updates
  async _networkUpdateNote(id: string, note: Note, author: string, skipWebhook = false): Promise<{ success: boolean; id?: string }> {
      const wordCount = note.content ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;
      note.lastEdited = new Date().toISOString();
      note.wordCount = wordCount;

      const noteName = slugify(id);

      // 1. Maintain Legacy API call (Synchronous truth)
      const res = await fetch(`${API_BASE_URL}/api/notes/write/${encodeURIComponent(noteName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note.content })
      });

      if (!res.ok) throw new Error(await res.text());

      // 2. Bridge Pattern: Dispatch Webhook (Asynchronous shadow-write)
      if (!skipWebhook) this._dispatchWebhook({ ...note, id }, author, 'update');

      // 5. Update Backlinks Index asynchronously
      if (note.title !== undefined && note.content !== undefined) {
          BacklinkService.updateBacklinks(id, note.title, note.content).catch(console.warn);
      } else if (note.title !== undefined && note.content === undefined) {
          // If only title changed, we need to update the source name in existing links
          // For a true fix, BacklinkService would need an updateSourceName method,
          // but for now we just handle full updates.
      }

      return { success: true, id };
  },

  // Public Update (Handles Offline Queuing)
  async updateNote(id: string, note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
      try {
        if (!id) throw new Error("ID required for update");

        // 1. Always do Optimistic Cache Update for immediate feedback
        db.set(STORE_NOTES_CONTENT, id, { ...note, id }).catch(console.warn);
        saveToHistory(id, note, author);
        if (note.title !== undefined && note.content !== undefined) {
           BacklinkService.updateBacklinks(id, note.title, note.content).catch(console.warn);
        }

        // 2. If clearly offline, throw to trigger queue immediately
        if (!navigator.onLine) throw new Error("Offline");

        // 3. Attempt Network Call
        return await this._networkUpdateNote(id, note, author);

      } catch (e) {
          console.log('[Sync Engine] Queueing offline update for', id);
          const op: PendingOp = {
            id: crypto.randomUUID(),
            type: 'update',
            noteId: id,
            note,
            author,
            timestamp: Date.now()
          };
          await db.set(STORE_PENDING_OPS, `${op.timestamp}-${op.id}`, op);

          // Optimistically update the list
          const currentList = await this.getCachedNotes();
          const packedDesc = createPackedDescription(note);
          const updatedList = currentList.map(item =>
              item.id === id ? { ...item, name: note.title, description: packedDesc } : item
          );
          await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, updatedList);

          return { success: true, id: id }; // Return mock success to keep UI happy
      }
  },

  // Public Save/Create (Handles Offline Queuing)
  async saveNote(note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
    try {
      // 1. If clearly offline, throw to trigger queue
      if (!navigator.onLine) throw new Error("Offline");

      // 2. Attempt Network Call
      const res = await this._networkSaveNote(note, author);
      if (res.success && res.id) {
         db.set(STORE_NOTES_CONTENT, res.id, { ...note, id: res.id }).catch(console.warn);
         saveToHistory(res.id, note, author);
         if (note.title !== undefined && note.content !== undefined) {
             BacklinkService.updateBacklinks(res.id, note.title, note.content).catch(console.warn);
         }
      }
      return res;

    } catch (e) {
      // 3. Offline Creation Logic
      const tempId = `offline-${crypto.randomUUID()}`;
      console.log('[Sync Engine] Queueing offline creation with temp ID:', tempId);

      const op: PendingOp = {
        id: crypto.randomUUID(),
        type: 'create',
        noteId: tempId,
        note,
        author,
        timestamp: Date.now()
      };

      // Store operation and optimistic cache
      await db.set(STORE_PENDING_OPS, `${op.timestamp}-${op.id}`, op);
      await db.set(STORE_NOTES_CONTENT, tempId, { ...note, id: tempId });
      saveToHistory(tempId, note, author);
      if (note.title !== undefined && note.content !== undefined) {
          BacklinkService.updateBacklinks(tempId, note.title, note.content).catch(console.warn);
      }

      // Optimistically update the list so it appears in the sidebar while offline
      const currentList = await this.getCachedNotes();
      const packedDesc = createPackedDescription(note);
      const newMeta: CloudItemMeta = {
          id: tempId,
          name: note.title,
          type: 'note',
          author: author,
          date: new Date().toISOString(),
          description: packedDesc
      };
      await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [newMeta, ...currentList]);

      return { success: true, id: tempId }; // Return mock success with temporary ID
    }
  },


  // Public Delete (Handles Offline Queuing)
  async deleteNote(id: string): Promise<boolean> {
    try {
      if (!id) throw new Error("ID required for delete");

      // 1. Optimistic Cache Update
      await db.del(STORE_NOTES_CONTENT, id);
      const currentList = await this.getCachedNotes();
      const updatedList = currentList.filter(item => item.id !== id);
      await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, updatedList);
      BacklinkService.removeLinks(id).catch(console.warn);

      // 2. If clearly offline, throw to trigger queue immediately
      if (!navigator.onLine) throw new Error("Offline");

      // 3. Attempt Network Call
      return await this._networkDeleteNote(id);

    } catch (e) {
      console.log('[Sync Engine] Queueing offline delete for', id);
      const op: PendingOp = {
        id: crypto.randomUUID(),
        type: 'delete',
        noteId: id,
        timestamp: Date.now()
      };
      await db.set(STORE_PENDING_OPS, `${op.timestamp}-${op.id}`, op);
      return true; // Return mock success to keep UI happy
    }
  },

  // ── Named Notes API ──────────────────────────────────────────────────────────

  async listNamedNotes(): Promise<Array<{ name: string; updated_at: string; size: number }>> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/list`);
      if (!res.ok) throw new Error(`listNamedNotes failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[API] listNamedNotes failed', e);
      return [];
    }
  },

  async loadNamedNote(name: string): Promise<{ name: string; content: string; updated_at: string } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/read/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`loadNamedNote(${name}) failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[API] loadNamedNote failed', e);
      return null;
    }
  },

  async saveNamedNote(name: string, content: string): Promise<{ success: boolean; name: string; size: number; updated_at: string } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/write/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`saveNamedNote(${name}) failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('[API] saveNamedNote failed', e);
      return null;
    }
  },

  async deleteNamedNote(name: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes/delete/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (e) {
      console.warn('[API] deleteNamedNote failed', e);
      return false;
    }
  },

  async syncWithVps(
    onProgress?: (message: string) => void
  ): Promise<{ pulled: number; pushed: number; conflicts: number; errors: string[] }> {
    const result = { pulled: 0, pushed: 0, conflicts: 0, errors: [] as string[] };

    try {
      onProgress?.('Fetching VPS notes...');
      const vpsNotes = await vpsStorageAPI.listNotes();
      const localEntries = await db.getAll<Note>(STORE_NOTES_CONTENT);
      const localNotes = new Map(localEntries.map(e => [e.key, e.value]));
      const localMetaList = await this.getCachedNotes();
      const localMetaMap = new Map(localMetaList.map(m => [m.id, m]));

      const allNames = new Set([
        ...vpsNotes.map(n => n.name),
        ...Array.from(localNotes.keys()),
      ]);

      for (const name of allNames) {
        const vpsNote = vpsNotes.find(n => n.name === name);
        const localNote = localNotes.get(name);
        const vpsTime = vpsNote ? new Date(vpsNote.updated_at).getTime() : 0;
        const localTime = localNote?.updatedAt ? new Date(localNote.updatedAt).getTime() : 0;

        try {
          const lastSync = localNote?.lastSyncedAt || 0;
          const TOLERANCE_MS = 5000;

          let action: 'PULL' | 'PUSH' | 'CONFLICT' | 'NOOP' = 'NOOP';

          if (!localNote && vpsNote) {
             action = 'PULL';
          } else if (localNote && !vpsNote) {
             action = 'PUSH';
          } else if (localNote && vpsNote) {
             const hasLocalChanges = localTime > lastSync;
             const hasServerChanges = vpsTime > (lastSync + TOLERANCE_MS);

             if (hasLocalChanges && hasServerChanges) {
                const remote = await vpsStorageAPI.readNote(name);
                if (remote.content !== localNote.content) {
                   action = 'CONFLICT';
                } else {
                   action = 'PULL'; // They're identical, just refresh local timestamps/meta
                }
             } else if (hasLocalChanges) {
                action = 'PUSH';
             } else if (hasServerChanges) {
                action = 'PULL';
             }
          }

          if (action === 'CONFLICT' && localNote && vpsNote) {
             onProgress?.(`Conflict detected for "${name}"...`);
             await vpsStorageAPI.readNote(name);

             // 1. Save local as conflicted copy
             const conflictId = `${name}_conflict_${Date.now()}`;
             const conflictTitle = `${localNote.title} (Conflicted Copy)`;
             const conflictNote: Note = {
               ...localNote,
               id: conflictId,
               title: conflictTitle,
               updatedAt: new Date().toISOString(),
               lastSyncedAt: Date.now()
             };
             await db.set(STORE_NOTES_CONTENT, conflictId, conflictNote);

             const conflictMeta: CloudItemMeta = {
               id: conflictId,
               name: conflictId,
               author: conflictNote.subject,
               date: conflictNote.updatedAt || new Date().toISOString(),
               type: 'note',
               description: createPackedDescription(conflictNote),
             };
             await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [conflictMeta, ...localMetaList]);
             localMetaList.unshift(conflictMeta);

             // 2. Push the conflict copy to the VPS as well so it's safely backed up
             try {
               await vpsStorageAPI.writeNote(conflictId, conflictNote.content);
             } catch (e) {
               console.warn('[Sync] Failed to push conflict copy', e);
             }

             // 3. Force overwrite the original local note with the remote note
             action = 'PULL';
             result.conflicts++;
          }

          if (action === 'PULL') {
            onProgress?.(`Pulling "${name}"...`);
            const remote = await vpsStorageAPI.readNote(name);
            const newVpsTime = remote.updated_at ? new Date(remote.updated_at).getTime() : Date.now();

            const updatedNote: Note = {
              id: name,
              title: name,
              content: remote.content,
              subject: localNote?.subject || 'General',
              section: localNote?.section || 'Inbox',
              tags: localNote?.tags || '',
              updatedAt: remote.updated_at,
              lastSyncedAt: newVpsTime // Trust the server's clock
            };
            await db.set(STORE_NOTES_CONTENT, name, updatedNote);

            const packedDesc = createPackedDescription(updatedNote);
            const meta: CloudItemMeta = {
              id: name,
              name,
              author: localNote?.subject || 'User',
              date: remote.updated_at,
              type: 'note',
              description: packedDesc,
            };

            if (localMetaMap.has(name)) {
              const newList = localMetaList.map(m => (m.id === name ? meta : m));
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
            } else {
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
              localMetaList.unshift(meta);
            }
            localMetaMap.set(name, meta);
            result.pulled++;
          } else if (action === 'PUSH' && localNote) {
            onProgress?.(`Pushing "${name}"...`);
            await vpsStorageAPI.writeNote(name, localNote.content);

            const timeOfPush = Date.now();
            localNote.lastSyncedAt = timeOfPush;

            await db.set(STORE_NOTES_CONTENT, name, localNote);

            // Also update STORE_NOTES_LIST to maintain consistency
            const meta: CloudItemMeta = {
              id: name,
              name,
              author: localNote.subject || 'User',
              date: localNote.updatedAt || new Date(timeOfPush).toISOString(),
              type: 'note',
              description: createPackedDescription(localNote),
            };

            if (localMetaMap.has(name)) {
              const newList = localMetaList.map(m => (m.id === name ? meta : m));
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, newList);
            } else {
              await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, [meta, ...localMetaList]);
              localMetaList.unshift(meta);
            }
            localMetaMap.set(name, meta);

            result.pushed++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`"${name}": ${msg}`);
          console.warn(`[Sync] Failed to sync "${name}":`, err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Sync failed: ${msg}`);
      console.error('[Sync] Overall sync failed:', err);
    }

    return result;
  },

  async uploadFile(file: File, author: string, description: string = ""): Promise<{ success: boolean; id?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('author', author);
      formData.append('description', description);

      const res = await fetch(`${API_BASE_URL}/api/samples`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { success: true, id: data.id };
    } catch (e) {
      console.error('[API] Upload failed', e);
      return { success: false };
    }
  }
};