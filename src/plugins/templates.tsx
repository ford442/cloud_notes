import type { Plugin } from '../services/plugin';
import { StorageService } from '../services/api';
import { AIService } from '../services/ai';

// Helper to handle variables in templates
const processTemplate = (content: string): string | null => {
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

    // We use window.prompt for simplicity.
    // In a future evolution, we could use a nice modal dialog via PluginRegistry.
    const value = window.prompt(`Enter value for '${variable}':`, defaultValue);

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
        command: ({ editor, range }) => {
            const filled = processTemplate(t.content);
            if (filled) {
                editor.chain().focus().deleteRange(range).insertContent(filled).run();
            }
        }
      });
    });

    // Smart Meeting Command
    ctx.registerCommand({
        title: 'Smart Meeting',
        description: 'AI-generated meeting agenda',
        searchTerms: ['meeting', 'agenda', 'ai'],
        icon: <span className="text-lg">🤖</span>,
        section: 'AI',
        command: async ({ editor, range }) => {
            const topic = window.prompt('Meeting Topic:');
            if (!topic) return;
            const attendees = window.prompt('Attendees:');

            const placeholder = `[Generating Agenda for "${topic}"...]`;
            editor.chain().focus().deleteRange(range).insertContent(placeholder).run();

            try {
                const prompt = `Generate a structured meeting agenda for a meeting about "${topic}" with attendees: ${attendees || 'Team'}.
                Include sections for:
                - Date: ${new Date().toLocaleDateString()}
                - Attendees
                - Objective
                - Agenda Items (Timeboxed)
                - Discussion Notes
                - Action Items
                Format as Markdown.`;

                const content = await AIService.generateText(prompt, 500);

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
                     editor.chain().focus().deleteRange({ from, to }).insertContent(content).run();
                 } else {
                     editor.chain().focus().insertContent(content).run();
                 }

            } catch (e) {
                console.error(e);
                alert('Failed to generate agenda');
            }
        }
    });

    // 2. AI Draft Command
    ctx.registerCommand({
      title: 'Draft with AI',
      description: 'Generate text from a prompt',
      searchTerms: ['ai', 'generate', 'draft', 'gpt'],
      icon: <span className="text-lg">✨</span>,
      section: 'AI',
      command: async ({ editor, range }) => {
        const prompt = window.prompt('What should I write?');
        if (!prompt) return;

        const uniqueId = Date.now().toString().slice(-4);
        const placeholder = `[AI DRAFTING ${uniqueId}]...`;

        editor.chain().focus().deleteRange(range).insertContent(placeholder).run();

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
            editor.chain().focus().deleteRange({ from, to }).run();
            if (text) editor.chain().insertContent(text).run();
          } else {
             // Placeholder not found (deleted by user?), just insert result at cursor
             if (text) editor.chain().focus().insertContent(text).run();
          }
        } catch (e) {
          console.error(e);
          // Cleanup placeholder if exists
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

          alert('AI Draft failed.');
        }
      }
    });

    // 3. User Templates (Dynamic)
    ctx.registerCommandProvider(() => {
      const notes = ctx.getAllNotes();
      console.log('InteractiveTemplates: notes count', notes.length);
      const templateNotes = notes.filter(n => {
         const parts = (n.description || '').split(' ::: ');
         // parts[1] is Section. We handle cases where description might be missing or malformed.
         return parts.length > 1 && parts[1].trim() === 'Templates';
      });

      return templateNotes.map(n => ({
          title: `Template: ${n.name}`,
          description: 'Insert user template',
          searchTerms: ['template', n.name.toLowerCase()],
          icon: <span className="text-lg">📄</span>,
          section: 'User Templates',
          command: async ({ editor, range }) => {
              // Fetch full content
              try {
                  const note = await StorageService.getNoteContent(n.id);
                  if (note && note.content) {
                      const filled = processTemplate(note.content);
                      if (filled) {
                           editor.chain().focus().deleteRange(range).insertContent(filled).run();
                      }
                  }
              } catch (e) {
                  console.error('Failed to load template', e);
                  alert('Failed to load template content.');
              }
          }
      }));
    });
  }
};
