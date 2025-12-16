// src/services/api.ts

const API_BASE_URL = "https://ford442-storage-manager.hf.space";

export interface Note {
  id?: string;
  title: string;
  content: string;
  tags: string;
  updatedAt?: string;
}

export interface CloudItemMeta {
  id: string;
  name: string;
  author: string;
  date: string;
  type: string;
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
      return await res.json();
    } catch (e) {
      console.error(e);
      throw e;
    }
  },

  // Save a note (Create or Update)
  async saveNote(note: Note, author: string = "User"): Promise<{ success: boolean; id?: string }> {
    try {
      const payload = {
        name: note.title,
        author: author,
        description: note.tags, // Storing tags in description for easy viewing in list
        type: 'note',
        data: note // The full note object is stored in the 'data' field
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
