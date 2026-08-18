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

import { StatsPlugin } from './stats';
import { TimeTravelPlugin } from './time-travel';
import { markdownToHtml } from '../utils/serialization';

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
      id: 'export-to-pdf',
      title: 'Export as PDF',
      section: 'Actions',
      icon: <span className="text-lg">📄</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) {
            ctx.alert('No note selected');
            return;
        }

        const htmlContent = markdownToHtml(note.content || '');

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`
            <html>
              <head>
                <title>${note.title || 'Note'}</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                  h1, h2, h3 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
                  code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
                  pre { background: #f4f4f4; padding: 10px; overflow-x: auto; border-radius: 4px; }
                  blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 10px; color: #666; }
                  img { max-width: 100%; height: auto; }
                  @media print {
                    body { max-width: none; margin: 0; padding: 0; }
                  }
                </style>
              </head>
              <body>
                <h1>${note.title || 'Untitled Note'}</h1>
                ${htmlContent}
              </body>
            </html>
          `);
          doc.close();

          iframe.contentWindow?.focus();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 100);
          }, 250);
        } else {
          ctx.alert('Failed to generate PDF.');
        }
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
export const NoteActionsPlugin: Plugin = {
  id: 'core-note-actions',
  name: 'Note Actions',
  init: (ctx) => {
    ctx.registerAction({
      id: 'duplicate-note',
      title: 'Duplicate Note',
      section: 'Actions',
      icon: <span className="text-lg">📋</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) {
          ctx.alert('No note selected');
          return;
        }

        ctx.createNote({
          title: `[Copy] ${note.title || 'Untitled'}`,
          content: note.content || '',
          subject: note.subject,
          section: note.section,
          tags: note.tags,
        });

        ctx.alert(`Duplicated note: ${note.title}`);
      }
    });
  }
};

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
      id: 'text-remove-extra-spaces',
      title: 'Text: Remove extra spaces',
      section: 'Editor',
      icon: <span className="text-lg">✂️</span>,
      perform: () => {
        window.dispatchEvent(new CustomEvent('text-tool', { detail: { action: 'remove-extra-spaces' } }));
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

export const CorePlugins = [TexturesPlugin, InteractiveTemplatesPlugin, StatsPlugin, ExportPlugin, NoteActionsPlugin, CanvasToolsPlugin, TextToolsPlugin, AIPlugin, DailyNotesPlugin, FlashcardsPlugin, ReadwisePlugin, VoicePlugin, FocusPlugin, TasksPlugin, ClusterPlugin, E2EPlugin, TimeTravelPlugin];
