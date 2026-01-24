import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Collaboration from '@tiptap/extension-collaboration'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { useEffect, useRef, useState } from 'react'
import { markdownToHtml, htmlToMarkdown } from '../utils/serialization'
import { SlashCommand, getSlashSuggestionOptions } from './editor/slash-command'
import { NoteLink, getNoteLinkSuggestionOptions } from './editor/note-link'
import type { CommandItem } from './editor/slash-command'
import type { CloudItemMeta } from '../services/api'
import { AIService } from '../services/ai'
import { PluginRegistry } from '../services/plugin'

interface BlockEditorProps {
  noteId: string;
  value: string;
  onChange: (val: string) => void;
  availableNotes?: CloudItemMeta[];
  onNavigate?: (id: string) => void;
}

const defaultCommands: CommandItem[] = [
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

        // 5. Replace placeholder with summary (or just append if simpler, but let's try to replace)
        // Since finding by ID in Tiptap is hard without custom node, we'll just append to the end
        // or insert at current position.
        // Actually, let's just insert the result.
        // But we want to remove "Summarizing...".
        // Simpler approach: Just insert the summary. The user sees the cursor wait or we can use a toast.
        // But for "juice", let's just insert.

        // Better:
        editor.chain().focus().undo().run(); // Undo the placeholder insert? No, risky.

        // Let's just append.
        editor.chain().focus().insertContent(`\n> **Summary:** ${summary}\n`).run();

      } catch (e) {
        console.error(e);
        editor.chain().focus().insertContent(`\n*AI Summarization failed.*\n`).run();
      }
    },
  },
]

export const BlockEditor = ({ noteId, value, onChange, availableNotes = [], onNavigate }: BlockEditorProps) => {
  // Use refs to keep track of latest props without triggering re-init
  const notesRef = useRef(availableNotes);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    notesRef.current = availableNotes;
  }, [availableNotes]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  // Yjs document setup
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<IndexeddbPersistence | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(noteId, doc);

    setYdoc(doc);
    setProvider(persistence);

    return () => {
      persistence.destroy();
      doc.destroy();
    }
  }, [noteId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions that clash with our custom ones if needed
        // @ts-expect-error - history is not in the type definition but might be needed for older versions or use undoRedo
        history: false,
      }),
      ...(ydoc ? [Collaboration.configure({
        document: ydoc,
      })] : []),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type / for commands or @ to link notes...',
      }),
      Image,
      Youtube.configure({
        controls: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false, // We handle navigation manually
        HTMLAttributes: {
          class: 'cursor-pointer text-blue-500 hover:text-blue-600 underline',
        },
      }),
      SlashCommand.configure({
        suggestion: getSlashSuggestionOptions([
          ...defaultCommands,
          ...PluginRegistry.getSlashCommands()
        ]),
      }),
      // eslint-disable-next-line react-hooks/refs
      NoteLink.configure({
        suggestion: {
           ...getNoteLinkSuggestionOptions([]),
           items: ({ query }) => {
              // Override items to use the ref
              const items = notesRef.current;
              return items.filter((item) => {
                const parts = (item.description || '').split(' ::: ');
                const subject = parts[0] || '';
                const tags = parts[2] || '';
                return (item.name || '').toLowerCase().includes(query.toLowerCase()) ||
                       subject.toLowerCase().includes(query.toLowerCase()) ||
                       tags.toLowerCase().includes(query.toLowerCase());
              }).slice(0, 10);
           }
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8',
      },
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement).closest('a');
        if (link && link.getAttribute('href')) {
          const href = link.getAttribute('href');
          const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

          if (!isExternal && href && onNavigateRef.current) {
            event.preventDefault();
            onNavigateRef.current(href);
            return true;
          }
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  }, [ydoc]) // Re-create editor when ydoc changes

  // Hydrate Yjs doc from props if empty
  useEffect(() => {
    if (!editor || !ydoc || !provider) return;

    const initData = () => {
       // Check if the document has any content.
       // Tiptap's collaboration extension uses a 'default' XmlFragment.
       const fragment = ydoc.getXmlFragment('default');

       if (fragment.length === 0 && value) {
          // If empty, hydrate from props
          // We must be careful not to overwrite if we are just loading
          console.log('[BlockEditor] Hydrating Yjs from API content');
          editor.commands.setContent(markdownToHtml(value));
       }
    };

    if (provider.synced) {
      initData();
    } else {
      provider.on('synced', initData);
    }
  }, [editor, ydoc, provider, value]);

  return (
    <div className="w-full h-full overflow-auto" onClick={() => editor?.commands.focus()}>
      <EditorContent editor={editor} />
    </div>
  )
}
