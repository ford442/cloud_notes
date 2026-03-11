import type { CommandItem } from './slash-command'
import { PluginRegistry } from '../../services/plugin'

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
    title: 'Link to Note',
    icon: <strong>🔗</strong>,
    section: 'Insert',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent('[[').run()
    },
  },
  {
    title: 'Twitter Embed',
    icon: <strong>🐦</strong>,
    section: 'Media',
    command: async ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()

      const url = await PluginRegistry.prompt('Enter Twitter/X URL:')
      if (url) {
        // Simple iframe embed for twitter
        const tweetId = url.split('/').pop()?.split('?')[0];
        if (tweetId) {
            const embedHtml = `<iframe border="0" frameborder="0" height="250" width="100%" src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}"></iframe>`;
            editor.chain().focus().insertContent(embedHtml).run();
        }
      }
    },
  },
]
