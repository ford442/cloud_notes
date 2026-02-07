import { useEditor, EditorContent, Extension } from '@tiptap/react'
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
import { WikiLink, getWikiLinkSuggestionOptions } from './editor/wiki-link'
import type { CloudItemMeta } from '../services/api'
import { PluginRegistry } from '../services/plugin'
import { defaultCommands } from './editor/commands'
import { BlockHandle } from './editor/BlockHandle'
import { processImage } from '../utils/media'

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
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const persistence = new IndexeddbPersistence(noteId, doc);
    const um = new Y.UndoManager(doc.getXmlFragment('default'));

    setYdoc(doc);
    setProvider(persistence);
    undoManagerRef.current = um;

    return () => {
      persistence.destroy();
      doc.destroy();
      um.destroy();
      undoManagerRef.current = null;
    }
  }, [noteId]);

  const editor = useEditor({
    extensions: [
      // Custom extension to bind Yjs UndoManager to keyboard shortcuts
      Extension.create({
        name: 'yjs-undo',
        addKeyboardShortcuts() {
          return {
            'Mod-z': () => {
              undoManagerRef.current?.undo();
              return true;
            },
            'Mod-y': () => {
              undoManagerRef.current?.redo();
              return true;
            },
            'Shift-Mod-z': () => {
              undoManagerRef.current?.redo();
              return true;
            },
          }
        }
      }),
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
      // eslint-disable-next-line react-hooks/refs
      WikiLink.configure({
        suggestion: {
           ...getWikiLinkSuggestionOptions([]),
           items: ({ query }) => {
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
      handleDrop: (view, event, _slice, moved) => {
        // 1. Handle Image Drop
        if (event.dataTransfer?.files?.length) {
           const file = event.dataTransfer.files[0];
           if (file.type.startsWith('image/')) {
               event.preventDefault(); // Stop browser from opening file

               const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });

               processImage(file).then(src => {
                   if (coordinates) {
                       const node = view.state.schema.nodes.image.create({ src });
                       const tr = view.state.tr.insert(coordinates.pos, node);
                       view.dispatch(tr);
                   }
               }).catch(e => console.error("Image drop failed", e));

               return true;
           }
        }

        const isBlockMove = event.dataTransfer?.getData('text/plain') === 'Block Move';

        if (isBlockMove) {
            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (!coordinates) return false;

            const { from, to } = view.state.selection;
            const dropPos = coordinates.pos;

            // Check if dropping on itself
            if (dropPos >= from && dropPos <= to) return false;

            const tr = view.state.tr;
            const slice = view.state.doc.slice(from, to);

            // Determine target position (Start of the block at drop coordinates)
            const $pos = view.state.doc.resolve(dropPos);
            // Default to inserting before the block at depth 1
            const targetPos = $pos.depth >= 1 ? $pos.before(1) : dropPos;

            tr.delete(from, to);

            // Map the target position because of the deletion
            const newPos = tr.mapping.map(targetPos);

            tr.insert(newPos, slice.content);
            view.dispatch(tr);
            return true;
        }
        return false;
      },
      handlePaste: (view, event, _slice) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith('image/'));

        if (imageItem) {
            const file = imageItem.getAsFile();
            if (file) {
                 event.preventDefault();
                 processImage(file).then(src => {
                     const node = view.state.schema.nodes.image.create({ src });
                     const tr = view.state.tr.replaceSelectionWith(node);
                     view.dispatch(tr);
                 }).catch(e => console.error("Image paste failed", e));
                 return true;
            }
        }
        return false;
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
    <div className="w-full h-full overflow-auto relative" onClick={() => editor?.commands.focus()}>
      <BlockHandle editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
