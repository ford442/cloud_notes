import type { CommandItem } from './slash-command'
import { AIService } from '../../services/ai'

export const defaultCommands: CommandItem[] = [
  {
    title: 'Heading 1',
    icon: <strong>H1</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    icon: <strong>H2</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    icon: <strong>H3</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    icon: <strong>•</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Ordered List',
    icon: <strong>1.</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Task List',
    icon: <strong>☑</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Quote',
    icon: <strong>❝</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Callout',
    icon: <strong>ℹ️</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().insertContent('**Note:** ').run()
    },
  },
  {
    title: 'Code Block',
    icon: <strong>{'<>'}</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    title: 'Divider',
    icon: <strong>—</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Image',
    icon: <strong>🖼️</strong>,
    command: ({ editor, range }) => {
      const url = window.prompt('Enter image URL:')
      if (url) {
        editor.chain().focus().deleteRange(range).setImage({ src: url }).run()
      } else {
        editor.chain().focus().deleteRange(range).run()
      }
    },
  },
  {
    title: 'YouTube',
    icon: <strong>📺</strong>,
    command: ({ editor, range }) => {
      const url = window.prompt('Enter YouTube URL:')
      if (url) {
        editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run()
      } else {
        editor.chain().focus().deleteRange(range).run()
      }
    },
  },
  {
    title: 'Table',
    icon: <strong>📊</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    title: 'Date',
    icon: <strong>📅</strong>,
    command: ({ editor, range }) => {
      const date = new Date().toISOString().split('T')[0]
      editor.chain().focus().deleteRange(range).insertContent(date).run()
    },
  },
  {
    title: 'Summarize Note',
    icon: <strong>✨</strong>,
    command: async ({ editor, range }) => {
      // 1. Delete the slash command text
      editor.chain().focus().deleteRange(range).run();

      // 2. Get content
      const content = editor.getText();
      if (!content.trim()) return;

      // 3. Insert placeholder
      const placeholderId = `summary-placeholder-${Date.now()}`;
      editor.chain().focus().insertContent(`<p id="${placeholderId}"><em>Summarizing...</em></p>`).run();

      try {
        // 4. Call AI
        const summary = await AIService.summarize(content);

        // 5. Replace placeholder with summary
        editor.chain().focus().undo().run();

        // Let's just append.
        editor.chain().focus().insertContent(`\n> **Summary:** ${summary}\n`).run();

      } catch (e) {
        console.error(e);
        editor.chain().focus().insertContent(`\n*AI Summarization failed.*\n`).run();
      }
    },
  },
  {
    title: 'Continue Writing',
    icon: <strong>🤖</strong>,
    command: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();

      const { from } = editor.state.selection;
      const start = Math.max(0, from - 1000);
      const context = editor.state.doc.textBetween(start, from, '\n');

      if (!context.trim()) return;

      editor.chain().focus().insertContent('<em>...writing...</em>').run();

      try {
        const result = await AIService.generateText(context);
        editor.chain().focus().undo().run(); // Undo placeholder
        if (result) editor.chain().focus().insertContent(result).run();
      } catch (e) {
        console.error(e);
        editor.chain().focus().undo().run();
      }
    },
  },
]
