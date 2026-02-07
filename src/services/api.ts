// src/services/api.ts

import { db, CACHE_KEYS, STORE_NOTES_LIST, STORE_NOTES_CONTENT, STORE_PENDING_OPS } from '../utils/db';
import { EncryptionService } from '../utils/encryption';
import { createPackedDescription } from '../utils/metadata';

const API_BASE_URL = "https://ford442-storage-manager.hf.space";

interface PendingOp {
  id: string;
  type: 'update'; // limiting to update for safety
  noteId: string;
  note: Note;
  author: string;
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

  async syncPending() {
    if (!navigator.onLine) return;

    try {
      const ops = await db.getAll<PendingOp>(STORE_PENDING_OPS);
      if (ops.length === 0) return;

      console.log(`[Sync] Processing ${ops.length} pending operations...`);

      // Sort by timestamp to ensure correct order
      ops.sort((a, b) => a.value.timestamp - b.value.timestamp);

      for (const { key, value: op } of ops) {
        try {
          let success = false;
          if (op.type === 'update') {
            const res = await this.updateNote(op.noteId, op.note, op.author, true);
            success = res.success;
          }

          if (success) {
            await db.del(STORE_PENDING_OPS, key);
          } else {
            console.warn(`[Sync] Op ${key} failed, keeping in queue.`);
          }
        } catch (e) {
          console.error(`[Sync] Failed to process op ${key}`, e);
        }
      }
    } catch (e) {
      console.error('[Sync] Failed to sync pending ops', e);
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

  // --- NETWORK METHODS (With Cache Side-Effects) ---

  // Fetch list of notes
  async getNotes(skipCacheUpdate = false): Promise<CloudItemMeta[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/songs?type=note`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      const notes = await res.json();

      if (!skipCacheUpdate) {
        // Update cache in background
        db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, notes).catch(e =>
          console.warn('[Cache] Failed to update notes list', e)
        );
      }

      return notes;
    } catch (e) {
      console.error(e);
      // Fallback to cache if network fails entirely?
      // Current contract expects empty array on error, but maybe we should throw if offline?
      // For now, return empty array to match previous behavior, but we might want to change this later.
      return [];
    }
  },

  // Fetch full content of a specific note
  async getNoteContent(id: string): Promise<Note> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/songs/${id}?type=note`);
      if (!res.ok) throw new Error("Failed to load note");
      
      const data = await res.json();
      
      // DECRYPT CONTENT
      const decryptedContent = await EncryptionService.decrypt(data.content || '');

      // Backward compatibility: Default to General/Inbox if missing
      const note: Note = {
        ...data,
        content: decryptedContent,
        subject: data.subject || "General",
        section: data.section || "Inbox"
      };

      // Update cache (We store DECRYPTED content in local cache for speed/offline editing)
      // This is a trade-off: Local IndexedDB is not encrypted by us, but it is sandboxed by browser.
      // E2E requirement usually focuses on SERVER not seeing data.
      db.set(STORE_NOTES_CONTENT, id, note).catch(e =>
        console.warn(`[Cache] Failed to update content for ${id}`, e)
      );

      return note;
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Prepare payload for saving/updating
  async _preparePayload(note: Note, author: string): Promise<any> {
      // PACKING METADATA:
      // We format the description as: "Subject ::: Section ::: Tags ::: Links ::: Keywords"
      // This allows the Sidebar and Graph to parse the tree structure instantly.
      const packedDesc = createPackedDescription(note);

      console.log('[API] Saving/Updating note:', { title: note.title, packedDesc });

      // ENCRYPT CONTENT BEFORE SENDING
      const encryptedContent = await EncryptionService.encrypt(note.content);

      // We clone the note to avoid modifying the UI state object
      const secureNote = { ...note, content: encryptedContent };

      return {
        name: note.title,
        author: author,
        description: packedDesc, 
        type: 'note',
        data: secureNote
      };
  },

  // Update existing note (PUT)
  async updateNote(id: string, note: Note, author: string = "User", skipQueue = false): Promise<{ success: boolean; id?: string }> {
      try {
        if (!id) throw new Error("ID required for update");

        // Optimistic Cache Update
        db.set(STORE_NOTES_CONTENT, id, note).catch(console.warn);

        if (!navigator.onLine && !skipQueue) {
           throw new Error("Offline");
        }

        const payload = await this._preparePayload(note, author);

        const res = await fetch(`${API_BASE_URL}/api/songs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        // Cache Update (Confirmation)
        db.set(STORE_NOTES_CONTENT, id, { ...note, id: id }).catch(console.warn);

        return { success: true, id: id };
      } catch (e) {
          console.error(e);
          if (!skipQueue && id) {
             console.log('[API] Queueing offline update for', id);
             const op: PendingOp = {
                id: crypto.randomUUID(),
                type: 'update',
                noteId: id,
                note,
                author,
                timestamp: Date.now()
             };
             // Use timestamp as key prefix for order
             await db.set(STORE_PENDING_OPS, `${op.timestamp}-${op.id}`, op);
             return { success: true, id: id }; // Mock success
          }
          return { success: false };
      }
  },

  // Create new note (POST)
  async saveNote(note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
    try {
      const payload = await this._preparePayload(note, author);

      const res = await fetch(`${API_BASE_URL}/api/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // If new note, update cache with new ID
      if (data.id) {
         db.set(STORE_NOTES_CONTENT, data.id, { ...note, id: data.id }).catch(console.warn);
      }

      return { success: true, id: data.id };
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  }
};
