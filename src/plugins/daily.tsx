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
           await ctx.alert(`You already have a daily note for today! Opened: ${existingNote.name}`);
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

        // Note: The below createNote is temporarily disabled.
        // There is an issue where Tiptap throws "Invalid content for node listItem: <>"
        // when hydrating the empty task lists (- [ ]) on a newly created note.
        // Documented in weekly_plan.md to fix later.

        await ctx.alert(`Not yet implemented. Try using the '/daily template' slash command inside a note instead.`);

        /*
        ctx.createNote({
          title: `Daily: ${dateStr}`,
          content: template,
          subject: 'Journal',
          section: 'Daily',
          tags: 'daily, journal'
        });
        */
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
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // Small delay to ensure the slash command menu closes cleanly before inserting content
        await new Promise(resolve => setTimeout(resolve, 50));

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

        editor.chain().focus().insertContent(markdownToHtml(template)).run();
      }
    });
  }
};
