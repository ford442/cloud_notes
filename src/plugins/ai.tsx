import type { Plugin } from '../services/plugin';

export const AIPlugin: Plugin = {
  id: 'ai-features',
  name: 'AI Features',
  init: (ctx) => {
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
