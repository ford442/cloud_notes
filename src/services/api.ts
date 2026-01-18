// src/services/api.ts

import { extractKeywords } from '../utils/keywords';
import { db, CACHE_KEYS, STORE_NOTES_LIST, STORE_NOTES_CONTENT } from '../utils/db';
import { EncryptionService } from '../utils/encryption';

const API_BASE_URL = "https://ford442-storage-manager.hf.space";

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
      console.warn(`[Cache] Failed to load note ${id}`, e);
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

  // Save a note (Create or Update)
  async saveNote(note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
    try {
      // Optimistic Cache Update (if we have an ID)
      if (note.id) {
        db.set(STORE_NOTES_CONTENT, note.id, note).catch(console.warn);
      }

      // PACKING METADATA:
      // We format the description as: "Subject ::: Section ::: Tags"
      // This allows the Sidebar to parse the tree structure instantly.

      // Extract backlinks from content (Inline regex to avoid circular dependencies)
      const extractLinks = (text: string): string[] => {
        if (!text) return [];
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const ids: string[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          const href = match[2];
          if (!href.startsWith('http://') && !href.startsWith('https://')) {
            ids.push(href);
          }
        }
        return [...new Set(ids)];
      };

      const links = extractLinks(note.content);
      const linksStr = links.join('|');

      // Extract keywords
      const keywords = extractKeywords(note.content);
      const keywordsStr = keywords.join(' ');

      // Format: Subject ::: Section ::: Tags ::: Links ::: Keywords
      let packedDesc = `${note.subject || 'General'} ::: ${note.section || 'Inbox'} ::: ${note.tags || ''}`;

      packedDesc += ` ::: ${linksStr}`; // Index 3
      packedDesc += ` ::: ${keywordsStr}`; // Index 4

      console.log('[API] Saving note:', { title: note.title, packedDesc });

      // ENCRYPT CONTENT BEFORE SENDING
      const encryptedContent = await EncryptionService.encrypt(note.content);

      // We clone the note to avoid modifying the UI state object
      const secureNote = { ...note, content: encryptedContent };

      const payload = {
        name: note.title,
        author: author,
        description: packedDesc, 
        type: 'note',
        data: secureNote
      };

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
