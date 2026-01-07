import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { useEffect, useRef } from 'react'
import { markdownToHtml, htmlToMarkdown } from '../utils/serialization'
import { SlashCommand, getSlashSuggestionOptions } from './editor/slash-command'
import { NoteLink, getNoteLinkSuggestionOptions } from './editor/note-link'
import type { CommandItem } from './editor/slash-command'
import type { CloudItemMeta } from '../services/api'

interface BlockEditorProps {
  value: string;
  onChange: (val: string) => void;
  availableNotes?: CloudItemMeta[];
  onNavigate?: (id: string) => void;
}

const commands: CommandItem[] = [
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
]

export const BlockEditor = ({ value, onChange, availableNotes = [], onNavigate }: BlockEditorProps) => {
  // Use refs to keep track of latest props without triggering re-init
  const notesRef = useRef(availableNotes);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    notesRef.current = availableNotes;
  }, [availableNotes]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions that clash with our custom ones if needed
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'Type / for commands or @ to link notes...',
      }),
      Image,
      Link.configure({
        openOnClick: false, // We handle navigation manually
        HTMLAttributes: {
          class: 'cursor-pointer text-blue-500 hover:text-blue-600 underline',
        },
      }),
      SlashCommand.configure({
        suggestion: getSlashSuggestionOptions(commands),
      }),
      NoteLink.configure({
        suggestion: {
           ...getNoteLinkSuggestionOptions([]),
           items: ({ query }) => {
              // Override items to use the ref
              const items = notesRef.current;
              return items.filter((item) => {
                const parts = (item.description || '').split(' ::: ');
                const subject = parts[0] || '';
                return (item.name || '').toLowerCase().includes(query.toLowerCase()) ||
                       subject.toLowerCase().includes(query.toLowerCase());
              }).slice(0, 10);
           }
        },
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8',
      },
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement).closest('a');
        if (link && link.getAttribute('href')) {
          const href = link.getAttribute('href');
          // If it's an external link (starts with http), let it open in new tab (if target=_blank) or standard behavior
          // If it looks like an ID (no protocol), intercept it.
          const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

          if (!isExternal && href && onNavigateRef.current) {
            // Prevent default navigation
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
  })

  useEffect(() => {
    if (!editor) return

    if (editor.isFocused) return

    const currentMarkdown = htmlToMarkdown(editor.getHTML())
    // Simple check to see if we should update content from props
    if (currentMarkdown.trim() !== value.trim()) {
       editor.commands.setContent(markdownToHtml(value))
    }
  }, [editor, value])

  return (
    <div className="w-full h-full overflow-auto" onClick={() => editor?.commands.focus()}>
      <EditorContent editor={editor} />
    </div>
  )
}
