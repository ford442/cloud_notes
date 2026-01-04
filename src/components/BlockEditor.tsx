import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'
import { markdownToHtml, htmlToMarkdown } from '../utils/serialization'

interface BlockEditorProps {
  value: string;
  onChange: (val: string) => void;
}

export const BlockEditor = ({ value, onChange }: BlockEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure extensions here if needed
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

  // Sync value from parent if it changes externally
  // We need to be careful to avoid loops. Only update if content is significantly different.
  // A simple way is to check if the editor is focused. If focused, we assume the user is typing
  // and we don't need to sync from props (unless we really want collaborative sync later).
  // For now, let's just sync on mount or if value changes drastically (e.g. note switch).
  useEffect(() => {
    if (editor && value) {
        // We get current markdown from editor to compare
        const currentContent = htmlToMarkdown(editor.getHTML());

        // Only set content if it's different to avoid cursor jumps / loops
        // This simple check might not be perfect for realtime collaboration but is fine for single user
        if (currentContent.trim() !== value.trim()) {
           // However, converting back and forth might result in slight differences (e.g. newlines).
           // If we are strictly "value" driven, this is hard.
           // Better strategy for "Note Switch": The parent component changes the 'key' of the Editor component
           // to force a re-mount when the Note ID changes.
           // For now, let's just update if the editor is empty (initial load).

           // Actually, the best way for a "controlled" input like this in a simple app
           // is to only update from props if the internal state is wildly different
           // (meaning we probably switched notes).
           // But since we are reusing the component, we should rely on the parent to unmount/remount
           // or use a `key` prop on the `BlockEditor` in `App.tsx`.
           // Let's rely on the `key` prop strategy in App.tsx!
           // So here we only set content once on mount (handled by useEditor's content option)
           // or if we really need to update.

           // Let's do a safe update:
           // editor.commands.setContent(markdownToHtml(value))
        }
    }
  }, [value, editor])

  // Actually, relying on `key` in parent is cleaner for note switching.
  // I will add a `useEffect` that listens to `value` ONLY if we assume the parent handles `key`.
  // If `key` changes, the component remounts, so `useEditor` is called again with new initial content.
  // If we don't use `key`, we need this effect.
  // Let's add the effect but guard it.

  useEffect(() => {
    if (!editor) return

    // If the editor is focused, we assume the user is typing, so we don't overwrite
    // (unless we are implementing real-time collab, which we aren't yet).
    if (editor.isFocused) return

    const currentMarkdown = htmlToMarkdown(editor.getHTML())
    if (currentMarkdown !== value) {
       // This comparison is flaky because markdown conversion isn't 1:1 reversible (whitespace etc)
       // So for now, I will NOT auto-update from props while editing.
       // I will strictly rely on `key` changing in the parent for loading new notes.
    }
  }, [editor, value])

  // But what if we switch notes and the component is NOT remounted?
  // We should definitely use `key={selectedId}` in App.tsx.

  return (
    <div className="w-full h-full overflow-auto" onClick={() => editor?.commands.focus()}>
      <EditorContent editor={editor} />
    </div>
  )
}
