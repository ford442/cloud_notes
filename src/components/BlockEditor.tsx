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
import { defaultCommands } from './editor/commands'

interface BlockEditorProps {
  noteId: string;
  value: string;
  onChange: (val: string) => void;
  availableNotes?: CloudItemMeta[];
  onNavigate?: (id: string) => void;
}


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
