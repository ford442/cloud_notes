import type { Plugin } from '../services/plugin';

export const DailyNotesPlugin: Plugin = {
  id: 'daily-notes',
  name: 'Daily Notes',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-daily-note',
      title: 'Open Daily Note',
      section: 'Actions',
      icon: <span className="text-lg">📅</span>,
      perform: () => {
        const now = new Date();
        // Use local time for ID to ensure consistency with user's day
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayISO = `${year}-${month}-${day}`;

        const todayLocale = now.toLocaleDateString();

        const allNotes = ctx.getAllNotes();
        const existingNote = allNotes.find(n => n.name === todayISO);

        if (existingNote) {
            ctx.navigateTo(existingNote.id);
        } else {
            const template = `
## Daily Journal: ${todayLocale}

### 🌟 Gratitude
1.
2.
3.

### 🧠 Brain Dump
-

### ✅ Action Items
- [ ]
`;
            ctx.createNote({
                title: todayISO,
                subject: 'Journal',
                section: 'Daily',
                tags: 'daily, journal',
                content: template.trim()
            });
        }
      }
    });
  }
};
