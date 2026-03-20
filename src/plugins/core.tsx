import type { Plugin } from '../services/plugin';
import { CanvasToolsPlugin } from './canvas';
import { AIPlugin } from './ai';
import { DailyNotesPlugin } from './daily';
import { FlashcardsPlugin } from './flashcards';
import { InteractiveTemplatesPlugin } from './templates';
import { ReadwisePlugin } from './readwise';
import { VoicePlugin } from './voice';
import { FocusPlugin } from './focus';
import { TasksPlugin } from './tasks';
import { ClusterPlugin } from './cluster';
import { StorageService } from '../services/api';
import { E2EPlugin } from './e2e';

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
        if (!note) {
            ctx.alert('No note selected');
            return;
        }

        const content = note.content || '';
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const chars = content.length;
        const lines = content.split('\n').length;

        ctx.alert(`Statistics for "${note.title}"\n\nWords: ${words}\nCharacters: ${chars}\nLines: ${lines}`);
      }
    });

    ctx.registerCommand({
      title: 'Note Statistics',
      description: 'Show word count and stats',
      searchTerms: ['stats', 'count', 'word'],
      icon: <span className="text-lg">📊</span>,
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        const words = content.trim().split(/\s+/).filter(Boolean).length;
        const chars = content.length;
        const lines = content.split('\n').length;

        await ctx.alert(`Statistics\n\nWords: ${words}\nCharacters: ${chars}\nLines: ${lines}`);
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
        if (!note) {
            ctx.alert('No note selected');
            return;
        }
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
        if (!note) {
            ctx.alert('No note selected');
            return;
        }
        downloadFile(`${note.title || 'untitled'}.json`, JSON.stringify(note, null, 2), 'application/json');
      }
    });

    ctx.registerAction({
      id: 'export-all-markdown',
      title: 'Export All as Markdown',
      section: 'Actions',
      icon: <span className="text-lg">📚</span>,
      perform: async () => {
        const allNotes = ctx.getAllNotes();
        if (allNotes.length === 0) {
            ctx.alert('No notes to export');
            return;
        }

        try {
            let combined = `# All Notes (${new Date().toLocaleDateString()})\n\n`;
            for (const meta of allNotes) {
                // Try cache first, fallback to network
                let note = await StorageService.getCachedNote(meta.id);
                if (!note) {
                    note = await StorageService.getNoteContent(meta.id);
                }
                if (note && note.content) {
                    combined += `## ${note.title}\n\n`;
                    combined += `*Subject: ${note.subject} | Section: ${note.section} | Tags: ${note.tags}*\n\n`;
                    combined += `${note.content}\n\n---\n\n`;
                }
            }
            downloadFile(`cloud_notes_backup_${new Date().toISOString().split('T')[0]}.md`, combined, 'text/markdown');
            ctx.alert('Successfully exported all notes.');
        } catch (e) {
            console.error('Export failed', e);
            ctx.alert('Failed to export all notes. Make sure you are online to fetch uncached notes.');
        }
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

export const CorePlugins = [InteractiveTemplatesPlugin, StatsPlugin, ExportPlugin, CanvasToolsPlugin, TextToolsPlugin, AIPlugin, DailyNotesPlugin, FlashcardsPlugin, ReadwisePlugin, VoicePlugin, FocusPlugin, TasksPlugin, ClusterPlugin, E2EPlugin];
