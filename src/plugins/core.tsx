import type { Plugin } from '../services/plugin';
import { CanvasToolsPlugin } from './canvas';
import { AIPlugin } from './ai';
import { DailyNotesPlugin } from './daily';

// --- Templates Plugin ---

const MEETING_TEMPLATE = `
## Meeting: [Topic]
**Date:** ${new Date().toLocaleDateString()}

### Attendees
-

### Agenda
1.

### Notes
-

### Action Items
- [ ]
`;

const JOURNAL_TEMPLATE = `
## Journal: ${new Date().toLocaleDateString()}

### Gratitude
1.
2.
3.

### Thoughts
...
`;

const PROJECT_TEMPLATE = `
## Project: [Name]

### Goal
Define the goal here.

### Milestones
- [ ] Phase 1
- [ ] Phase 2
`;

export const TemplatesPlugin: Plugin = {
  id: 'core-templates',
  name: 'Core Templates',
  init: (ctx) => {
    // Slash Commands
    ctx.registerCommand({
      title: 'Meeting Notes',
      description: 'Insert a meeting template',
      searchTerms: ['meeting', 'template', 'agenda'],
      icon: <span className="text-lg">📅</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent(MEETING_TEMPLATE).run();
      },
    });

    ctx.registerCommand({
      title: 'Daily Journal',
      description: 'Insert a daily journal template',
      searchTerms: ['journal', 'diary', 'daily'],
      icon: <span className="text-lg">📔</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent(JOURNAL_TEMPLATE).run();
      },
    });

    ctx.registerCommand({
      title: 'Project Plan',
      description: 'Insert a project planning template',
      searchTerms: ['project', 'plan', 'roadmap'],
      icon: <span className="text-lg">🚀</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent(PROJECT_TEMPLATE).run();
      },
    });
  }
};

// --- Stats Plugin ---

export const StatsPlugin: Plugin = {
  id: 'core-stats',
  name: 'Statistics',
  init: (ctx) => {
    ctx.registerAction({
      id: 'show-stats',
      title: 'Show Note Statistics',
      section: 'Actions',
      icon: <span className="text-lg">📊</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) return alert('No note selected');

        const content = note.content || '';
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const chars = content.length;
        const lines = content.split('\n').length;

        alert(`Statistics for "${note.title}"\n\nWords: ${words}\nCharacters: ${chars}\nLines: ${lines}`);
      }
    });
  }
};

// --- Export Plugin ---

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const ExportPlugin: Plugin = {
  id: 'core-export',
  name: 'Export Tools',
  init: (ctx) => {
    ctx.registerAction({
      id: 'export-markdown',
      title: 'Export as Markdown',
      section: 'Actions',
      icon: <span className="text-lg">⬇️</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) return alert('No note selected');
        downloadFile(`${note.title || 'untitled'}.md`, note.content, 'text/markdown');
      }
    });

    ctx.registerAction({
      id: 'export-json',
      title: 'Export as JSON',
      section: 'Actions',
      icon: <span className="text-lg">📦</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) return alert('No note selected');
        downloadFile(`${note.title || 'untitled'}.json`, JSON.stringify(note, null, 2), 'application/json');
      }
    });
  }
};

// --- Text Tools Plugin ---
export const TextToolsPlugin: Plugin = {
  id: 'core-text-tools',
  name: 'Text Tools',
  init: (ctx) => {
    ctx.registerAction({
      id: 'append-signature',
      title: 'Append Signature',
      section: 'Editor',
      icon: <span className="text-lg">✍️</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) return;

        // Note: note.author might not be on the Note interface strictly speaking, but we can try note.author or fallback
        // Looking at api.ts Note interface: id, title, content, subject, section, tags.
        // CloudItemMeta has author.
        // App.tsx passes currentNote which matches Note.
        // So author might not be available on 'note'.
        // We will just use 'Me' or check if we can get it from somewhere else.
        // Actually, App.tsx manages 'authorName' state but doesn't pass it to the Note object unless saved.
        // But for now, we just append a static signature or "Me".

        const signature = `\n\n---\n*Signed*`;
        ctx.updateNote({ content: (note.content || '') + signature });
      }
    });
  }
};

export const CorePlugins = [TemplatesPlugin, StatsPlugin, ExportPlugin, CanvasToolsPlugin, TextToolsPlugin, AIPlugin, DailyNotesPlugin];
