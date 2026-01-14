// src/services/api.ts

import { extractKeywords } from '../utils/keywords';

const API_BASE_URL = "https://ford442-storage-manager.hf.space";

export interface Note {
  id?: string;
  title: string;
  content: string;
  subject: string; // NEW
  section: string; // NEW
  tags: string;
  updatedAt?: string;
}

export interface CloudItemMeta {
  id: string;
  name: string;
  author: string;
  date: string;
  type: string;
  description: string; // We will store "Subject ::: Section ::: Tags" here
}

export const StorageService = {
  // Fetch list of notes
  async getNotes(): Promise<CloudItemMeta[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/songs?type=note`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  // Fetch full content of a specific note
  async getNoteContent(id: string): Promise<Note> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/songs/${id}?type=note`);
      if (!res.ok) throw new Error("Failed to load note");
      
      const data = await res.json();
      
      // Backward compatibility: Default to General/Inbox if missing
      return {
        ...data,
        subject: data.subject || "General",
        section: data.section || "Inbox"
      };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Save a note (Create or Update)
  async saveNote(note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
    try {
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

      // Always ensure we have placeholders if we are adding subsequent fields,
      // but 'links' is index 3. Current readers handle missing parts.
      // However, if links is empty but we have keywords, we should probably output "::: " for links?
      // Backlinks reader: parts[3].
      // If we put keywords at index 4, we must ensure index 3 exists.

      packedDesc += ` ::: ${linksStr}`; // Index 3 (can be empty string)
      packedDesc += ` ::: ${keywordsStr}`; // Index 4

      console.log('[API] Saving note:', { title: note.title, packedDesc });

      const payload = {
        name: note.title,
        author: author,
        description: packedDesc, 
        type: 'note',
        data: note 
      };

      const res = await fetch(`${API_BASE_URL}/api/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { success: true, id: data.id };
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  }
};
