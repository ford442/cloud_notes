// src/services/api.ts

import { db, CACHE_KEYS, STORE_NOTES_LIST, STORE_NOTES_CONTENT, STORE_PENDING_OPS } from '../utils/db';
import { EncryptionService } from '../utils/encryption';
import { createPackedDescription } from '../utils/metadata';

export const API_BASE_URL = localStorage.getItem('api_url') || "https://storage.noahcohn.com";

// The Bridge: If the user is still using the legacy HF Space, map `/api/notes` back to `/api/songs`
const getApiPath = (path: string): string => {
    if (API_BASE_URL.includes('ford442') || API_BASE_URL.includes('hf.space')) {
        return path.replace('/api/notes', '/api/songs');
    }
    return path;
};

// 1. EXPANDED: Now handles creates, updates, and deletes
interface PendingOp {
  id: string;
  type: 'create' | 'update' | 'delete';
  noteId: string; // Can be a temporary UUID if created offline
  note?: Note;
  author?: string;
  timestamp: number;
}

export interface Note {
  id?: string;
  title: string;
  content: string;
  subject: string;
  section: string;
  tags: string;
  updatedAt?: string;
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
    if (!navigator.onLine) return;

    try {
      const ops = await db.getAll<PendingOp>(STORE_PENDING_OPS);
      if (ops.length === 0) return;

      console.log(`[Sync Engine] Processing ${ops.length} offline operations...`);

      // Sort by timestamp to replay history exactly as it happened
      ops.sort((a, b) => a.value.timestamp - b.value.timestamp);

      // Map to track temporary offline IDs resolving to real server IDs
      const idMap = new Map<string, string>();

      for (const { key, value: op } of ops) {
        try {
          let success = false;

          // Resolve the target ID (if this note was created offline, use the new real server ID)
          const targetId = idMap.get(op.noteId) || op.noteId;

          if (op.type === 'create' && op.note) {
            const res = await this._networkSaveNote(op.note, op.author || "User");
            if (res.success && res.id) {
              idMap.set(op.noteId, res.id); // Map the temp ID to the real ID!

              // Clean up local cache: migrate temp ID to real ID
              await db.del(STORE_NOTES_CONTENT, op.noteId);
              await db.set(STORE_NOTES_CONTENT, res.id, { ...op.note, id: res.id });

              success = true;
            }
          }
          else if (op.type === 'update' && op.note) {
            const res = await this._networkUpdateNote(targetId, op.note, op.author || "User");
            success = res.success;
          }
          // Note: Ready for offline DELETE when you implement delete UI
          else if (op.type === 'delete') {
             // await this._networkDeleteNote(targetId);
             success = true;
          }

          if (success) {
            await db.del(STORE_PENDING_OPS, key);
          } else {
            console.warn(`[Sync Engine] Op ${key} failed, keeping in queue for next retry.`);
          }
        } catch (e) {
          console.error(`[Sync Engine] Failed to process op ${key}`, e);
        }
      }

      // If we synced things successfully, refresh the global cache
      if (ops.length > 0) {
          this.getNotes(false).catch(console.warn);
      }

    } catch (e) {
      console.error('[Sync Engine] Failed to run sync queue', e);
    }
  },

  // --- NETWORK METHODS (With Offline Fallbacks) ---

  async getNotes(skipCacheUpdate = false): Promise<CloudItemMeta[]> {
    try {
      const res = await fetch(`${API_BASE_URL}${getApiPath('/api/notes')}?type=note`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      const notes = await res.json();

      if (!skipCacheUpdate) {
        db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, notes).catch(e =>
          console.warn('[Cache] Failed to update notes list', e)
        );
      }
      return notes;
    } catch (e) {
      console.warn("[Network] Offline or API unreachable. Falling back to cache.", e);
      return this.getCachedNotes();
    }
  },

  async getNoteContent(id: string): Promise<Note> {
    try {
      const res = await fetch(`${API_BASE_URL}${getApiPath(`/api/notes/${id}`)}?type=note`);
      if (!res.ok) throw new Error("Failed to load note");
      const data = await res.json();
      
      const decryptedContent = await EncryptionService.decrypt(data.content || '');
      const note: Note = {
        ...data,
        content: decryptedContent,
        subject: data.subject || "General",
        section: data.section || "Inbox"
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

  // Pure network call for Creates
  async _networkSaveNote(note: Note, author: string): Promise<{ success: boolean; id?: string }> {
      const payload = await this._preparePayload(note, author);
      const res = await fetch(`${API_BASE_URL}${getApiPath('/api/notes')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { success: true, id: data.id };
  },

  // Pure network call for Updates
  async _networkUpdateNote(id: string, note: Note, author: string): Promise<{ success: boolean; id?: string }> {
      const payload = await this._preparePayload(note, author);
      const res = await fetch(`${API_BASE_URL}${getApiPath(`/api/notes/${id}`)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      return { success: true, id: id };
  },

  // Public Update (Handles Offline Queuing)
  async updateNote(id: string, note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
      try {
        if (!id) throw new Error("ID required for update");

        // 1. Always do Optimistic Cache Update for immediate feedback
        db.set(STORE_NOTES_CONTENT, id, { ...note, id }).catch(console.warn);

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