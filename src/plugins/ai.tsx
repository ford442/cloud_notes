import type { Plugin } from '../services/plugin';
import { AIService } from '../services/ai';
import { SemanticService } from '../services/semantic';
import { StorageService } from '../services/api';
import { markdownToHtml } from '../utils/serialization';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Mark } from '@tiptap/pm/model';

export const AIPlugin: Plugin = {
  id: 'ai-features',
  name: 'AI Features',
  init: (ctx) => {
    // 1. Ask AI (Q&A)
    ctx.registerCommand({
        title: 'Ask AI',
        description: 'Ask a question about your notes',
        searchTerms: ['ask', 'qa', 'question', 'query', 'ai'],
        icon: <span className="text-lg">❓</span>,
        section: 'AI',
        command: async ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();

            const question = await ctx.prompt('What is your question?');
            if (!question) return;

            const uniqueId = Date.now().toString().slice(-4);
            const placeholder = `[Thinking about "${question}" ${uniqueId}...]`;
            editor.chain().focus().insertContent(`\n${placeholder}\n`).run();

            try {
                // 1. Find relevant notes
                const relevant = await SemanticService.findSimilar(question, undefined, 3);

                // 2. Fetch content
                const context = [];
                for (const item of relevant) {
                    try {
                         // Try cache first
                         let note = await StorageService.getCachedNote(item.id);
                         if (!note) {
                             note = await StorageService.getNoteContent(item.id);
                         }
                         if (note) {
                            // @ts-expect-error - name might be on cloud meta but note uses title
                            context.push(`Note: ${note.name || note.title}\n${note.content.substring(0, 1000)}...`);
                         }
                    } catch (e) { console.warn('Failed to fetch note for context', e); }
                }

                if (context.length === 0) {
                     context.push("No relevant notes found. Answer based on general knowledge if possible.");
                }

                // 3. Generate Answer
                const prompt = `Context:\n${context.join('\n\n')}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;
                const answer = await AIService.generateText(prompt, 300);

                // 4. Replace placeholder
                 const doc = editor.state.doc;
                 let from = -1;
                 let to = -1;

                 doc.descendants((node: ProseMirrorNode, pos: number) => {
                    if (node.isText && node.text && node.text.includes(placeholder)) {
                        from = pos + node.text.indexOf(placeholder);
                        to = from + placeholder.length;
                        return false;
                    }
                 });

                 const formattedAnswer = `\n> **Q:** ${question}\n> **A:** ${answer}\n`;

                 if (from !== -1) {
                     editor.chain().focus().deleteRange({ from, to }).insertContent(markdownToHtml(formattedAnswer)).run();
                 } else {
                     editor.chain().focus().insertContent(markdownToHtml(formattedAnswer)).run();
                 }

            } catch (e) {
                console.error(e);
                await ctx.alert('Failed to get answer');

                // Cleanup
                 const doc = editor.state.doc;
                 let from = -1;
                 let to = -1;
                 doc.descendants((node: ProseMirrorNode, pos: number) => {
                    if (node.isText && node.text && node.text.includes(placeholder)) {
                        from = pos + node.text.indexOf(placeholder);
                        to = from + placeholder.length;
                        return false;
                    }
                 });
                 if (from !== -1) editor.chain().focus().deleteRange({ from, to }).run();
            }
        }
    });

    // 2. Summarize Note
    ctx.registerCommand({
      title: 'Summarize Note',
      description: 'Generate a summary of the current note',
      searchTerms: ['summarize', 'summary', 'ai'],
      icon: <span className="text-lg">✨</span>,
      section: 'AI',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        if (!content.trim()) return;

        const uniqueId = Date.now().toString().slice(-4);
        const placeholder = `[AI SUMMARIZING ${uniqueId}...]`;
        editor.chain().focus().insertContent(`\n${placeholder}\n`).run();

        try {
          const summary = await AIService.summarize(content);
          const formattedSummary = `\n> **Summary:** ${summary}\n`;

          let pos = -1;
          editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
            if (node.isText && node.text?.includes(placeholder)) {
              pos = position + node.text.indexOf(placeholder);
              return false;
            }
          });

          if (pos >= 0) {
            editor.chain().focus().deleteRange({ from: pos, to: pos + placeholder.length }).insertContent(markdownToHtml(formattedSummary)).run();
          } else {
            editor.chain().focus().insertContent(markdownToHtml(formattedSummary)).run();
          }

        } catch (e) {
          console.error(e);
          let pos = -1;
          editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
            if (node.isText && node.text?.includes(placeholder)) {
              pos = position + node.text.indexOf(placeholder);
              return false;
            }
          });
          if (pos >= 0) {
            editor.chain().focus().deleteRange({ from: pos, to: pos + placeholder.length }).insertContent(markdownToHtml(`\n*AI Summarization failed.*\n`)).run();
          }
        }
      },
    });

    // 3. Continue Writing
    ctx.registerCommand({
      title: 'Continue Writing',
      description: 'Let AI finish your thought',
      searchTerms: ['continue', 'write', 'generate', 'ai'],
      icon: <span className="text-lg">🤖</span>,
      section: 'AI',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const { from } = editor.state.selection;
        const start = Math.max(0, from - 1000);
        const context = editor.state.doc.textBetween(start, from, '\n');

        if (!context.trim()) return;

        const uniqueId = Date.now().toString().slice(-4);
        const placeholder = `[AI WRITING ${uniqueId}...]`;
        editor.chain().focus().insertContent(` ${placeholder} `).run();

        try {
          const result = await AIService.generateText(context);

          let pos = -1;
          editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
            if (node.isText && node.text?.includes(placeholder)) {
              pos = position + node.text.indexOf(placeholder);
              return false;
            }
          });

          if (pos >= 0) {
            const tr = editor.chain().focus().deleteRange({ from: pos, to: pos + placeholder.length });
            if (result) {
              tr.insertContent(result);
            }
            tr.run();
          }

        } catch (e) {
          console.error(e);
          let pos = -1;
          editor.state.doc.descendants((node: ProseMirrorNode, position: number) => {
            if (node.isText && node.text?.includes(placeholder)) {
              pos = position + node.text.indexOf(placeholder);
              return false;
            }
          });
          if (pos >= 0) {
            editor.chain().focus().deleteRange({ from: pos, to: pos + placeholder.length }).run();
          }
        }
      },
    });

    // 4. Auto-Link Notes
    ctx.registerCommand({
      title: 'Auto-Link Notes',
      description: 'Automatically link mentioned notes',
      icon: <span className="text-lg">🔗</span>,
      section: 'Tools',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        if (!content.trim()) return;

        const availableNotes = ctx.getAllNotes();
        if (availableNotes.length === 0) return;

        const map = new Map<string, { id: string, name: string }>();

        availableNotes.forEach(n => {
            const name = n.name || '';
            if (name) map.set(name.toLowerCase(), { id: n.id, name: name });
        });

        const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);

        const escapeRegExp = (string: string) => {
           return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        let matchCount = 0;
        let transactions = editor.state.tr;
        let modified = false;

        keys.forEach(key => {
            const { id } = map.get(key)!;
            if (key.length < 3) return;

            const regex = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');

            editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
                if (!node.isText) return;
                const text = node.text;
                if (!text) return;

                let match;
                while ((match = regex.exec(text)) !== null) {
                    const start = pos + match.index;
                    const end = start + match[0].length;

                    const hasLink = node.marks.some((m: Mark) => m.type.name === 'link');
                    if (hasLink) continue;

                    transactions = transactions.addMark(start, end, editor.schema.marks.link.create({ href: id }));
                    modified = true;
                    matchCount++;
                }
            });
        });

        if (modified) {
             editor.view.dispatch(transactions);
             await ctx.alert(`Auto-linked ${matchCount} items.`);
        } else {
             await ctx.alert('No new links found.');
        }
      }
    });
  }
};
