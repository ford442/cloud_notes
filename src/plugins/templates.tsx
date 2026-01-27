import type { Plugin } from '../services/plugin';
import { StorageService } from '../services/api';

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
        command: ({ editor, range }) => {
            const filled = processTemplate(t.content);
            if (filled) {
                editor.chain().focus().deleteRange(range).insertContent(filled).run();
            }
        }
      });
    });

    // 2. User Templates (Dynamic)
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
