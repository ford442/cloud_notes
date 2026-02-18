import type { CommandItem } from './slash-command'
import { AIService } from '../../services/ai'
import { PluginRegistry } from '../../services/plugin'
import { SemanticService } from '../../services/semantic'
import { StorageService } from '../../services/api'

export const defaultCommands: CommandItem[] = [
  {
    title: 'Heading 1',
    icon: <strong>H1</strong>,
    section: 'Text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    icon: <strong>H2</strong>,
    section: 'Text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    icon: <strong>H3</strong>,
    section: 'Text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    icon: <strong>•</strong>,
    section: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Ordered List',
    icon: <strong>1.</strong>,
    section: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Task List',
    icon: <strong>☑</strong>,
    section: 'Lists',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Quote',
    icon: <strong>❝</strong>,
    section: 'Text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Callout',
    icon: <strong>ℹ️</strong>,
    section: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().insertContent('**Note:** ').run()
    },
  },
  {
    title: 'Code Block',
    icon: <strong>{'<>'}</strong>,
    section: 'Blocks',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Divider',
    icon: <strong>—</strong>,
    section: 'Text',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Excalidraw',
    icon: <strong>🎨</strong>,
    section: 'Media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
         type: 'excalidraw',
         attrs: {
           data: JSON.stringify({ elements: [], appState: { viewBackgroundColor: '#ffffff' } })
         }
      }).run()
    },
  },
  {
    title: 'Image',
    icon: <strong>🖼️</strong>,
    section: 'Media',
    command: async ({ editor, range }) => {
      // Clear slash command first to close the menu
      editor.chain().focus().deleteRange(range).run()

      const url = await PluginRegistry.prompt('Enter image URL:')
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    },
  },
  {
    title: 'YouTube',
    icon: <strong>📺</strong>,
    section: 'Media',
    command: async ({ editor, range }) => {
      // Clear slash command first to close the menu
      editor.chain().focus().deleteRange(range).run()

      const url = await PluginRegistry.prompt('Enter YouTube URL:')
      if (url) {
        editor.chain().focus().setYoutubeVideo({ src: url }).run()
      }
    },
  },
  {
    title: 'Table',
    icon: <strong>📊</strong>,
    section: 'Media',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    title: 'Date',
    icon: <strong>📅</strong>,
    section: 'Insert',
    command: ({ editor, range }) => {
      const date = new Date().toISOString().split('T')[0]
      editor.chain().focus().deleteRange(range).insertContent(date).run()
    },
  },
  {
    title: 'Time',
    icon: <strong>⌚</strong>,
    section: 'Insert',
    command: ({ editor, range }) => {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      editor.chain().focus().deleteRange(range).insertContent(time).run()
    },
  },
  {
    title: 'Summarize Note',
    icon: <strong>✨</strong>,
    section: 'AI',
    command: async ({ editor, range }) => {
      // 1. Delete the slash command text
      editor.chain().focus().deleteRange(range).run();

      // 2. Get content
      const content = editor.getText();
      if (!content.trim()) return;

      // 3. Insert unique placeholder
      const placeholderId = Math.random().toString(36).substring(7);
      const placeholderText = `[AI SUMMARIZING ${placeholderId}]`;
      editor.chain().focus().insertContent(`\n${placeholderText}\n`).run();

      try {
        // 4. Call AI
        const summary = await AIService.summarize(content);
        const formattedSummary = `\n> **Summary:** ${summary}\n`;

        // 5. Find and replace placeholder
        let pos = -1;
        editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText);
            return false;
          }
        });

        if (pos >= 0) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length }).insertContent(formattedSummary).run();
        } else {
          // Fallback: just append if placeholder lost
          editor.chain().focus().insertContent(formattedSummary).run();
        }

      } catch (e) {
        console.error(e);
        let pos = -1;
        editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText);
            return false;
          }
        });
        if (pos >= 0) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length }).insertContent(`\n*AI Summarization failed.*\n`).run();
        }
      }
    },
  },
  {
    title: 'Continue Writing',
    icon: <strong>🤖</strong>,
    section: 'AI',
    command: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();

      const { from } = editor.state.selection;
      const start = Math.max(0, from - 1000);
      const context = editor.state.doc.textBetween(start, from, '\n');

      if (!context.trim()) return;

      const placeholderId = Math.random().toString(36).substring(7);
      const placeholderText = `[AI WRITING ${placeholderId}]`;
      editor.chain().focus().insertContent(` ${placeholderText} `).run();

      try {
        const result = await AIService.generateText(context);

        let pos = -1;
        editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText);
            return false;
          }
        });

        if (pos >= 0) {
          const tr = editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length });
          if (result) {
            tr.insertContent(result);
          }
          tr.run();
        }

      } catch (e) {
        console.error(e);
        let pos = -1;
        editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText);
            return false;
          }
        });
        if (pos >= 0) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length }).run();
        }
      }
    },
  },
  {
    title: 'Smart Meeting',
    icon: <strong>🗓️</strong>,
    section: 'AI',
    command: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const topic = await PluginRegistry.prompt('Meeting Topic:') || 'Untitled Meeting'
      const attendees = await PluginRegistry.prompt('Attendees (comma separated):') || 'Unknown'

      const template = `
# Meeting: ${topic}
**Date:** ${new Date().toLocaleDateString()}
**Attendees:** ${attendees}

## Agenda
- [ ]

## Notes
-

## Action Items
- [ ]
`
      editor.chain().focus().insertContent(template).run()
    }
  },
  {
    title: 'Ask AI',
    icon: <strong>🧠</strong>,
    section: 'AI',
    command: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const question = await PluginRegistry.prompt('What is your question?')
      if (!question) return

      const placeholderId = Math.random().toString(36).substring(7)
      const placeholderText = `[AI THINKING ${placeholderId}...]`
      editor.chain().focus().insertContent(`\n${placeholderText}\n`).run()

      try {
        // 1. Find relevant notes
        const similar = await SemanticService.findSimilar(question, undefined, 3)

        let context = ""
        for (const item of similar) {
            const note = await StorageService.getCachedNote(item.id) || await StorageService.getNoteContent(item.id).catch(() => null)
            if (note) {
                context += `Note: ${note.title}\nContent: ${note.content.substring(0, 500)}...\n\n`
            }
        }

        // 2. Construct Prompt
        const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`

        // 3. Generate
        const answer = await AIService.generateText(prompt, 300)

        const formattedAnswer = `\n> **Q:** ${question}\n> **A:** ${answer}\n`

        // 4. Replace placeholder
        let pos = -1
        editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText)
            return false
          }
        })

        if (pos >= 0) {
          editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length }).insertContent(formattedAnswer).run()
        } else {
          editor.chain().focus().insertContent(formattedAnswer).run()
        }

      } catch (e) {
         console.error(e)
         // Remove placeholder on error
         let pos = -1
         editor.state.doc.descendants((node, position) => {
          if (node.isText && node.text?.includes(placeholderText)) {
            pos = position + node.text.indexOf(placeholderText)
            return false
          }
         })
         if (pos >= 0) {
           editor.chain().focus().deleteRange({ from: pos, to: pos + placeholderText.length }).insertContent('\n*AI Error*\n').run()
         }
      }
    }
  },
]
