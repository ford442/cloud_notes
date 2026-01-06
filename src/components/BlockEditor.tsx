import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'
import { markdownToHtml, htmlToMarkdown } from '../utils/serialization'
import { SlashCommand, getSlashSuggestionOptions } from './editor/slash-command'
import type { CommandItem } from './editor/slash-command'

interface BlockEditorProps {
  value: string;
  onChange: (val: string) => void;
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
    title: 'Bullet List',
    icon: <strong>•</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Task List',
    icon: <strong>☑</strong>,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
]

export const BlockEditor = ({ value, onChange }: BlockEditorProps) => {
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
        placeholder: 'Type / for commands...',
      }),
      SlashCommand.configure({
        suggestion: getSlashSuggestionOptions(commands),
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8',
      },
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
    // We try to avoid resetting cursor position
    if (currentMarkdown.trim() !== value.trim()) {
       // Only update if significantly different
       editor.commands.setContent(markdownToHtml(value))
    }
  }, [editor, value])

  return (
    <div className="w-full h-full overflow-auto" onClick={() => editor?.commands.focus()}>
      <EditorContent editor={editor} />
    </div>
  )
}
