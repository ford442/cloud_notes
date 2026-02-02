import type { Plugin } from '../services/plugin';
import { StorageService } from '../services/api';

interface ReadwiseBook {
  user_book_id: number;
  title: string;
  author: string;
  readable_title: string;
  source: string;
  cover_image_url: string;
  unique_url: string;
  tags: { name: string }[];
  category: string;
  document_note: string;
  read_at: string;
  highlights: {
    id: number;
    text: string;
    note: string;
    location: number;
    location_type: string;
    highlighted_at: string;
    url: string | null;
    color: string;
    updated_at: string;
    book_id: number;
    tags: { name: string }[];
  }[];
}

interface ReadwiseExportResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ReadwiseBook[];
}

export const ReadwisePlugin: Plugin = {
  id: 'readwise-sync',
  name: 'Readwise Integration',
  init: (ctx) => {
    ctx.registerAction({
      id: 'sync-readwise',
      title: 'Sync Readwise Highlights',
      section: 'Integrations',
      icon: <span className="text-lg">📚</span>,
      perform: async () => {
        const token = localStorage.getItem('readwise_token');
        if (!token) {
          alert('Please configure your Readwise Access Token in Settings first.');
          return;
        }

        const authorName = localStorage.getItem('author_name') || 'Readwise';

        if (!confirm('Start syncing highlights from Readwise? This might take a few seconds.')) return;

        try {
          // Fetch from Readwise
          // Note: This endpoint exports ALL highlights.
          // For a production app, we should handle pagination and 'updatedAfter'.
          const response = await fetch('https://readwise.io/api/v2/export/', {
            headers: {
              'Authorization': `Token ${token}`
            }
          });

          if (!response.ok) {
            throw new Error(`Readwise API Error: ${response.statusText}`);
          }

          const data: ReadwiseExportResponse = await response.json();
          const books = data.results;

          let created = 0;
          let updated = 0;

          // Process each book
          for (const book of books) {
             if (book.highlights.length === 0) continue;

             const title = `Highlights: ${book.title}`;
             const tags = ['readwise', book.category, ...book.tags.map(t => t.name)].join(', ');

             // Format Content
             let content = `## ${book.title}\n**Author:** ${book.author}\n**Source:** ${book.source}\n**Category:** ${book.category}\n\n`;

             if (book.cover_image_url) {
                 content += `![Cover](${book.cover_image_url})\n\n`;
             }

             if (book.document_note) {
                 content += `> **Note:** ${book.document_note}\n\n`;
             }

             content += `### Highlights\n\n`;

             book.highlights.forEach(h => {
                 content += `> ${h.text}\n`;
                 if (h.note) content += `> *Note: ${h.note}*\n`;
                 // content += `> [View](${h.url})\n\n`; // URL might be null or internal
                 content += `\n`;
             });

             // Check if note exists
             const allNotes = ctx.getAllNotes();
             const existing = allNotes.find(n => n.name === title);

             const noteData = {
                 title,
                 content,
                 subject: 'Reading',
                 section: 'Highlights',
                 tags
             };

             if (existing) {
                 // Update
                 await StorageService.saveNote({ ...noteData, id: existing.id }, authorName);
                 updated++;
             } else {
                 // Create
                 await StorageService.saveNote(noteData, authorName);
                 created++;
             }
          }

          alert(`Sync Complete!\nCreated: ${created}\nUpdated: ${updated}\n\nPlease reload the page to see the new notes.`);

        } catch (e) {
          console.error(e);
          alert('Sync Failed. Check console for details. (Likely CORS issue or Invalid Token)');
        }
      }
    });
  }
};
