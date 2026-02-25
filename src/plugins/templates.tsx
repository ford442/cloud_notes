import type { Plugin, PluginContext } from '../services/plugin';
import { StorageService } from '../services/api';
import { AIService } from '../services/ai';

// Helper to handle variables in templates
const processTemplate = async (content: string, ctx: PluginContext): Promise<string | null> => {
  // Find all unique variables {{Var}}
  const regex = /\{\{(.*?)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    variables.add(match[1]);
  }

  let finalContent = content;

  for (const variable of variables) {
    const isDate = variable.toLowerCase().includes('date');
    const defaultValue = isDate ? new Date().toLocaleDateString() : '';

    // Use the application's modal dialog
    const value = await ctx.prompt(`Enter value for '${variable}':`, defaultValue);

    if (value === null) return null; // User cancelled

    // Replace all instances
    // Escape variable for regex
    const escapedVar = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    finalContent = finalContent.replace(new RegExp(`\\{\\{${escapedVar}\\}\\}`, 'g'), value);
  }

  return finalContent;
};

export const InteractiveTemplatesPlugin: Plugin = {
  id: 'interactive-templates',
  name: 'Interactive Templates',
  init: (ctx) => {

    // 1. Built-in Templates
    const builtinTemplates = [
      {
        title: 'Meeting Notes',
        content: `## Meeting: {{Topic}}\n**Date:** {{Date}}\n\n### Attendees\n- {{Attendees}}\n\n### Agenda\n1. \n\n### Notes\n- \n\n### Action Items\n- [ ] `
      },
      {
        title: 'Project Plan',
        content: `## Project: {{Project Name}}\n\n### Goal\n{{Goal}}\n\n### Milestones\n- [ ] `
      },
      {
        title: 'Daily Journal',
        content: `## Journal: {{Date}}\n\n### Gratitude\n1. \n2. \n3. \n\n### Thoughts\n- `
      }
    ];

    builtinTemplates.forEach(t => {
      ctx.registerCommand({
        title: t.title,
        description: 'Insert template',
        searchTerms: ['template', t.title.toLowerCase()],
        icon: <span className="text-lg">📋</span>,
        section: 'Templates',
        command: async ({ editor, range }) => {
            // Clear slash command first to close the menu
            editor.chain().focus().deleteRange(range).run();

            try {
              const filled = await processTemplate(t.content, ctx);
              if (filled) {
                  editor.chain().focus().insertContent(filled).run();
              }
            } catch (e) {
              console.error(e);
              await ctx.alert('Failed to process template.');
            }
        }
      });
    });

    // Smart Meeting Command (Hybrid: Instant Structure + AI Content)
    ctx.registerCommand({
        title: 'Smart Meeting',
        description: 'Instant meeting template with AI agenda',
        searchTerms: ['meeting', 'agenda', 'ai'],
        icon: <span className="text-lg">🗓️</span>,
        section: 'AI',
        command: async ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();

            const topic = await ctx.prompt('Meeting Topic:');
            if (!topic) return;
            const attendees = await ctx.prompt('Attendees:', 'Team');

            const uniqueId = Date.now().toString().slice(-4);
            const placeholder = `[AI SUGGESTING AGENDA ${uniqueId}...]`;

            // 1. Insert Static Structure IMMEDIATELY
            const template = `
# Meeting: ${topic}
**Date:** ${new Date().toLocaleDateString()}
**Attendees:** ${attendees}

## Agenda
${placeholder}

## Discussion
-

## Action Items
- [ ]
`;
            editor.chain().focus().insertContent(template).run();

            // 2. Call AI asynchronously
            try {
                const prompt = `Generate a concise, numbered meeting agenda (3-5 items) for a meeting about "${topic}". Just the list.`;
                const agenda = await AIService.generateText(prompt, 150);

                // 3. Replace Placeholder
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

                if (from !== -1) {
                    const content = agenda ? agenda : "- [ ] ";
                    editor.chain().focus().deleteRange({ from, to }).insertContent(content).run();
                }

            } catch (e) {
                console.error(e);
                // Fallback: just remove placeholder
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
                 if (from !== -1) editor.chain().focus().deleteRange({ from, to }).insertContent("- [ ] ").run();
            }
        }
    });

    // 2. Draft with AI Command
    ctx.registerCommand({
      title: 'Draft with AI',
      description: 'Generate text from a prompt',
      searchTerms: ['ai', 'generate', 'draft', 'gpt'],
      icon: <span className="text-lg">✨</span>,
      section: 'AI',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const prompt = await ctx.prompt('What should I write?');
        if (!prompt) return;

        const uniqueId = Date.now().toString().slice(-4);
        const placeholder = `[AI DRAFTING ${uniqueId}]...`;

        editor.chain().focus().insertContent(`\n${placeholder}\n`).run();

        try {
          const text = await AIService.generateText(prompt, 200);

          // Find placeholder position
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

          if (from !== -1) {
            editor.chain().focus().deleteRange({ from, to }).insertContent(text || "").run();
          } else {
             if (text) editor.chain().focus().insertContent(text).run();
          }
        } catch (e) {
          console.error(e);
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

          await ctx.alert('AI Draft failed.');
        }
      }
    });

    // 3. User Templates (Dynamic)
    ctx.registerCommandProvider(() => {
      const notes = ctx.getAllNotes();
      const templateNotes = notes.filter(n => {
         const parts = (n.description || '').split(' ::: ');
         return parts.length > 1 && parts[1].trim() === 'Templates';
      });

      return templateNotes.map(n => ({
          title: `Template: ${n.name}`,
          description: 'Insert user template',
          searchTerms: ['template', n.name.toLowerCase()],
          icon: <span className="text-lg">📄</span>,
          section: 'User Templates',
          command: async ({ editor, range }) => {
              editor.chain().focus().deleteRange(range).run();
              try {
                  const note = await StorageService.getNoteContent(n.id);
                  if (note && note.content) {
                      const filled = await processTemplate(note.content, ctx);
                      if (filled) {
                           editor.chain().focus().insertContent(filled).run();
                      }
                  }
              } catch (e) {
                  console.error('Failed to load template', e);
                  await ctx.alert('Failed to load template content.');
              }
          }
      }));
    });
  }
};
