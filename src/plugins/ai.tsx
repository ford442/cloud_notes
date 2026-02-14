import type { Plugin } from '../services/plugin';
import { AIService } from '../services/ai';
import { SemanticService } from '../services/semantic';
import { StorageService } from '../services/api';

export const AIPlugin: Plugin = {
  id: 'ai-features',
  name: 'AI Features',
  init: (ctx) => {
    // Slash Command: Ask AI (Q&A)
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
            editor.chain().focus().insertContent(placeholder).run();

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
                            context.push(`Note: ${note.title}\n${note.content}`);
                         }
                    } catch (e) { console.warn('Failed to fetch note for context', e); }
                }

                if (context.length === 0) {
                     // Fallback if no relevant notes found (or no index)
                     context.push("No relevant notes found. Answer based on general knowledge if possible.");
                }

                // 3. Generate Answer
                const prompt = `Context:\n${context.join('\n\n')}\n\nQuestion: ${question}\n\nAnswer based on the context above:`;
                const answer = await AIService.generateText(prompt, 300);

                // 4. Replace
                 const doc = editor.state.doc;
                 let from = -1;
                 let to = -1;

                 doc.descendants((node, pos) => {
                    if (node.isText && node.text && node.text.includes(placeholder)) {
                        from = pos + node.text.indexOf(placeholder);
                        to = from + placeholder.length;
                        return false;
                    }
                 });

                 const content = `> **Q:** ${question}\n\n${answer}`;

                 if (from !== -1) {
                     editor.chain().focus().deleteRange({ from, to }).insertContent(content).run();
                 } else {
                     editor.chain().focus().insertContent(content).run();
                 }

            } catch (e) {
                console.error(e);
                await ctx.alert('Failed to get answer');

                // Cleanup
                 const doc = editor.state.doc;
                 let from = -1;
                 let to = -1;
                 doc.descendants((node, pos) => {
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

    // Slash Command: Auto-Link
    ctx.registerCommand({
      title: 'Auto-Link Notes',
      icon: <span className="text-lg">🔗</span>,
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        if (!content.trim()) return;

        const availableNotes = ctx.getAllNotes();
        if (availableNotes.length === 0) return;

        // Simple keyword matching
        // Create a map of lowercased title/tag -> original title
        const map = new Map<string, { id: string, name: string }>();

        availableNotes.forEach(n => {
            const name = n.name || '';
            if (name) map.set(name.toLowerCase(), { id: n.id, name: name });

            // Also map tags? Maybe later.
        });

        // Scan content for keywords
        // We iterate over the map keys and check if they exist in the text
        // This is a naive approach, O(N*M), but fine for small N.
        // For better performance, Aho-Corasick or Regex construction.

        // Let's use a regex approach for all keys.
        // Sort keys by length descending to match longest first
        const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);

        // Escape regex special chars
        const escapeRegExp = (string: string) => {
           return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        let matchCount = 0;
        let transactions = editor.state.tr;
        let modified = false;

        // We need to find ranges.
        // We can iterate over all occurrences of all titles.

        keys.forEach(key => {
            const { id } = map.get(key)!;
            if (key.length < 3) return; // Skip short words to avoid noise

            // Find all occurrences of 'name' (case insensitive)
            // We use a regex for this specific name
            const regex = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');

            editor.state.doc.descendants((node, pos) => {
                if (!node.isText) return;
                const text = node.text;
                if (!text) return;

                let match;
                while ((match = regex.exec(text)) !== null) {
                    const start = pos + match.index;
                    const end = start + match[0].length;

                    // Check if already has link mark
                    const hasLink = node.marks.some(m => m.type.name === 'link');
                    if (hasLink) continue;

                    // Add link mark
                    transactions = transactions.addMark(start, end, editor.schema.marks.link.create({ href: id }));
                    modified = true;
                    matchCount++;
                }
            });
        });

        if (modified) {
             editor.view.dispatch(transactions);
             // Use toast if available? We don't have access to toast here easily.
             // We can use alert or console.
             // Or better, PluginContext could expose a `notify` method.
             // But for now:
             console.log(`Auto-linked ${matchCount} items.`);
        }
      }
    });
  }
};
