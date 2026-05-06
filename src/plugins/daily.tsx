import type { Plugin } from '../services/plugin';
import { markdownToHtml } from '../utils/serialization';

export const DailyNotesPlugin: Plugin = {
  id: 'daily-notes',
  name: 'Daily Notes',
  init: (ctx) => {
    const handleDailyNote = async () => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if a note for today already exists
        const allNotes = ctx.getAllNotes();
        const existingNote = allNotes.find(
          n => n.name === `Daily: ${dateStr}` || n.name === dateStr
        );

        if (existingNote) {
           ctx.navigateTo(existingNote.id);
           return;
        }

        const template = `
# 📅 Daily Journal: ${dateStr}

## 🎯 Top Priorities
- [ ]
- [ ]
- [ ]

## 📝 Notes
-

## 🧠 Reflections
-
        `.trim();

        ctx.createNote({
          title: `Daily: ${dateStr}`,
          content: template,
          subject: 'Journal',
          section: 'Daily',
          tags: 'daily, journal'
        });
    };

    // Register as a global action so users can trigger it without a command
    ctx.registerAction({
      id: 'create-daily-note',
      title: 'Open Daily Note',
      section: 'Actions',
      icon: <span className="text-lg">📅</span>,
      perform: handleDailyNote
    });

    // Register as a slash command
    // Insert into the current document instead of jumping to another document.
    ctx.registerCommand({
      title: 'Daily Journal Template',
      description: 'Insert daily journal template',
      searchTerms: ['daily', 'journal', 'today', 'template'],
      icon: <span className="text-lg">📅</span>,
      section: 'Templates',
      command: ({ editor, range }) => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        const template = `
# 📅 Daily Journal: ${dateStr}

## 🎯 Top Priorities
- [ ]
- [ ]
- [ ]

## 📝 Notes
-

## 🧠 Reflections
-
        `.trim();

        editor.chain().focus().deleteRange(range).insertContent(markdownToHtml(template)).run();
      }
    });
  }
};
