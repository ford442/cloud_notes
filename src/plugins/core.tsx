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
      id: 'text-uppercase',
      title: 'Text: To UPPERCASE',
      section: 'Editor',
      icon: <span className="text-lg">🔠</span>,
      perform: () => {
        // Dispatch event for editor to catch and apply transform
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'uppercase' } }));
      }
    });

    ctx.registerAction({
      id: 'text-lowercase',
      title: 'Text: To lowercase',
      section: 'Editor',
      icon: <span className="text-lg">🔡</span>,
      perform: () => {
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'lowercase' } }));
      }
    });

    ctx.registerAction({
      id: 'text-titlecase',
      title: 'Text: To Title Case',
      section: 'Editor',
      icon: <span className="text-lg">🔠</span>,
      perform: () => {
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'titlecase' } }));
      }
    });

    ctx.registerAction({
      id: 'text-strip',
      title: 'Text: Strip Formatting',
      section: 'Editor',
      icon: <span className="text-lg">🧹</span>,
      perform: () => {
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'strip' } }));
      }
    });

    ctx.registerAction({
      id: 'text-bullet-list',
      title: 'Text: To Bullet List',
      section: 'Editor',
      icon: <span className="text-lg">📝</span>,
      perform: () => {
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'bullet-list' } }));
      }
    });

    ctx.registerAction({
      id: 'append-signature',
      title: 'Text: Append Signature',
      section: 'Editor',
      icon: <span className="text-lg">✍️</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) return;
        const signature = `\n\n---\n*Signed*`;
        ctx.updateNote({ content: (note.content || '') + signature });
      }
    });
  }
};

import { TexturesPlugin } from './textures';

export const CorePlugins = [TexturesPlugin, InteractiveTemplatesPlugin, StatsPlugin, ExportPlugin, CanvasToolsPlugin, TextToolsPlugin, AIPlugin, DailyNotesPlugin, FlashcardsPlugin, ReadwisePlugin, VoicePlugin, FocusPlugin, TasksPlugin, ClusterPlugin, E2EPlugin];
