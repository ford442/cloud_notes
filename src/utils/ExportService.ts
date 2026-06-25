import { db, STORE_NOTES_CONTENT } from './db';
import type { Note } from '../services/api';
import { StorageService } from '../services/api';

export const ExportService = {
  async exportLibrary() {
    try {
      const notes = await db.getAll<Note>(STORE_NOTES_CONTENT);
      const notesData = notes.map(n => n.value);

      const blob = new Blob([JSON.stringify(notesData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `cloud_notes_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, count: notesData.length };
    } catch (e) {
      console.error('Export failed', e);
      return { success: false, error: e };
    }
  },

  async importLibrary(file: File, author: string = "User") {
    try {
      const text = await file.text();
      const notesData = JSON.parse(text);

      if (!Array.isArray(notesData)) {
        throw new Error("Invalid format: expected an array of notes.");
      }

      let importedCount = 0;
      for (const note of notesData) {
        if (note && note.title && typeof note.content === 'string') {
           const id = note.id || note.name || note.title;
           const fullNote: Note = {
               id: id,
               title: note.title,
               content: note.content,
               subject: note.subject || 'General',
               section: note.section || 'Inbox',
               tags: note.tags || '',
               updatedAt: note.updatedAt || new Date().toISOString()
           };

           const existing = await StorageService.getCachedNote(id);
           if (existing) {
               await StorageService.updateNote(id, fullNote, author);
           } else {
               await StorageService.saveNote(fullNote, author);
           }
           importedCount++;
        }
      }
      return { success: true, count: importedCount };
    } catch (e) {
      console.error('Import failed', e);
      return { success: false, error: e };
    }
  }
};
