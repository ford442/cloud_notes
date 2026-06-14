import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
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
import type { Editor as TiptapEditor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { markdownToHtml, htmlToMarkdown } from '../utils/serialization'
import { SlashCommand, getSlashSuggestionOptions } from './editor/slash-command'
import { NoteLink, getNoteLinkSuggestionOptions } from './editor/note-link'
import { WikiLink, getWikiLinkSuggestionOptions } from './editor/wiki-link'
import type { CloudItemMeta } from '../services/api'
import { PluginRegistry } from '../services/plugin'
import { defaultCommands } from './editor/commands'
import { BlockHandle } from './editor/BlockHandle'
import { processImageToBlob } from '../utils/media'
import { ExcalidrawExtension } from './editor/ExcalidrawExtension'
import { AudioExtension } from './editor/AudioExtension'
import { AutoLinkExtension } from './editor/AutoLinkExtension'
import { PromptSectionExtension } from './editor/PromptSectionExtension'
import { StorageService, API_BASE_URL } from '../services/api'
import { AIBubbleMenu } from './editor/AIBubbleMenu'


interface BlockEditorProps {
  noteId: string;
  value: string;
  onChange: (val: string) => void;
  availableNotes?: CloudItemMeta[];
  onNavigate?: (id: string) => void;
  lastExternalUpdate?: number;
}

// Helper to handle image uploads and placeholder management
const handleImageUpload = (view: EditorView, file: File, pos: number) => {
  // Insert placeholder
  const id = Math.random().toString(36).substring(7);
  const placeholder = `[Uploading Image ${id}...]`;

  // Use transaction to insert text at specific position
  const tr = view.state.tr.insert(pos, view.state.schema.text(placeholder));
  view.dispatch(tr);

  processImageToBlob(file).then((blob: Blob) => {
    // Convert Blob back to File for upload API
    const fileName = (file.name || "image").replace(/\.[^/.]+$/, "") + ".webp";
    const uploadFile = new File([blob], fileName, { type: 'image/webp' });
    return StorageService.uploadFile(uploadFile, "User", "Uploaded Image");
  }).then((res: { success: boolean; id?: string }) => {
    if (res.success && res.id) {
      const url = `${API_BASE_URL}/api/samples/${res.id}`;

      // Find placeholder position
      let targetPos = -1;
      view.state.doc.descendants((node: ProseMirrorNode, position: number) => {
        if (node.isText && node.text?.includes(placeholder)) {
          targetPos = position + node.text.indexOf(placeholder);
          return false;
        }
      });

      if (targetPos !== -1) {
        const node = view.state.schema.nodes.image.create({ src: url });
        const tr = view.state.tr.replaceWith(targetPos, targetPos + placeholder.length, node);
        view.dispatch(tr);
      }
    } else {
      throw new Error("Upload failed");
    }
  }).catch((e: any) => {
    console.error("Image upload failed", e);
    // Remove placeholder on error
    let targetPos = -1;
    view.state.doc.descendants((node: ProseMirrorNode, position: number) => {
      if (node.isText && node.text?.includes(placeholder)) {
        targetPos = position + node.text.indexOf(placeholder);
        return false;
      }
    });

    if (targetPos !== -1) {
      const tr = view.state.tr.delete(targetPos, targetPos + placeholder.length);
      view.dispatch(tr);
    }
  });
};

export const BlockEditor = ({ noteId, value, onChange, availableNotes = [], onNavigate, lastExternalUpdate }: BlockEditorProps) => {
  // Use refs to keep track of latest props without triggering re-init
  const notesRef = useRef(availableNotes);
  const onNavigateRef = useRef(onNavigate);

  const isEncrypted = value.trim().startsWith('---ENCRYPTED_V1---');

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
    AutoLinkExtension.configure({
      debounceMs: 150,
    }),

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
      AudioExtension,
      ExcalidrawExtension,
      PromptSectionExtension,
      AutoLinkExtension.configure({
        debounceMs: 150,
      }),
      StarterKit.configure({
        history: false, // Disabled because we use Yjs + custom undo manager
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
        suggestion: getSlashSuggestionOptions(() => [
          ...defaultCommands,
          ...PluginRegistry.getSlashCommands()
        ]),
      }),

      NoteLink.configure({
        suggestion: {
           ...getNoteLinkSuggestionOptions([]),
           items: ({ query }: { query: string }) => {
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

      WikiLink.configure({
        suggestion: {
           ...getWikiLinkSuggestionOptions([]),
           items: ({ query }: { query: string }) => {
              const items = notesRef.current;
              const results = items.filter((item) => {
                const parts = (item.description || '').split(' ::: ');
                const subject = parts[0] || '';
                const tags = parts[2] || '';
                return (item.name || '').toLowerCase().includes(query.toLowerCase()) ||
                       subject.toLowerCase().includes(query.toLowerCase()) ||
                       tags.toLowerCase().includes(query.toLowerCase());
              }).slice(0, 10);

              const exactMatch = results.find(i => i.name.toLowerCase() === query.toLowerCase());
              if (!exactMatch && query.trim().length > 0) {
                  results.push({
                      id: 'CREATE_NEW',
                      name: query,
                      description: 'Create new note ::: Actions',
                      author: 'System',
                      date: new Date().toISOString(),
                      type: 'note'
                  });
              }
              return results;
           }
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-3xl mx-auto focus:outline-none min-h-[500px] p-10',
      },
      handleDrop: (view: EditorView, event: DragEvent) => {
        // 1. Handle Image Drop
        if (event.dataTransfer?.files?.length) {
           const file = event.dataTransfer.files[0];
           if (file.type.startsWith('image/')) {
               event.preventDefault(); // Stop browser from opening file

               const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
               const pos = coordinates?.pos ?? view.state.selection.from;

               handleImageUpload(view, file, pos);
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
      handlePaste: (view: EditorView, event: ClipboardEvent) => {
        const items = Array.from(event.clipboardData?.items || []) as DataTransferItem[];

        // 1. Audio Paste
        const audioItem = items.find((item: DataTransferItem) => item.type.startsWith('audio/'));
        if (audioItem) {
            const file = audioItem.getAsFile();
            if (file) {
                 event.preventDefault();
                 const id = Math.random().toString(36).substring(7);
                 const placeholder = `[Uploading Audio ${id}...]`;
                 const tr = view.state.tr.replaceSelectionWith(view.state.schema.text(placeholder));
                 view.dispatch(tr);

                 StorageService.uploadFile(file, "User", "Pasted Audio").then(res => {
                     if (res.success && res.id) {
                         const url = `${API_BASE_URL}/api/samples/${res.id}`;

                         let pos = -1;
                         view.state.doc.descendants((node: ProseMirrorNode, position: number) => {
                             if (node.isText && node.text?.includes(placeholder)) {
                                 pos = position + node.text.indexOf(placeholder);
                                 return false;
                             }
                         });

                         if (pos !== -1) {
                             const node = view.state.schema.nodes.audio.create({ src: url });
                             const tr = view.state.tr.replaceWith(pos, pos + placeholder.length, node);
                             view.dispatch(tr);
                         }
                     }
                 });
                 return true;
            }
        }

        // 2. Image Paste
        const imageItem = items.find((item: DataTransferItem) => item.type.startsWith('image/'));
        if (imageItem) {
            const file = imageItem.getAsFile();
            if (file) {
                 event.preventDefault();

                 // Replace selection if any
                 const { from, to } = view.state.selection;
                 if (from !== to) {
                     const tr = view.state.tr.delete(from, to);
                     view.dispatch(tr);
                 }

                 // Insert at cursor (after deletion)
                 const pos = view.state.selection.from;
                 handleImageUpload(view, file, pos);
                 return true;
            }
        }

        // 3. YouTube/Figma/Twitter Link Paste
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
             const trimmedText = text.trim();
             const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
             const figmaRegex = /https:\/\/([\w.-]+\.)?figma.com\/(file|proto)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;
             const twitterRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+$/;

             if (youtubeRegex.test(trimmedText)) {
                 event.preventDefault();
                 const node = view.state.schema.nodes.youtube.create({ src: trimmedText });
                 const tr = view.state.tr.replaceSelectionWith(node);
                 view.dispatch(tr);
                 return true;
             } else if (figmaRegex.test(trimmedText)) {
                 event.preventDefault();
                 const embedHtml = `<iframe style="border: 1px solid rgba(0, 0, 0, 0.1);" width="100%" height="450" src="https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(trimmedText)}" allowfullscreen></iframe>`;

                 // Replace selection if any
                 const { from, to } = view.state.selection;
                 if (from !== to) {
                     const tr = view.state.tr.delete(from, to);
                     view.dispatch(tr);
                 }

                 // We must schedule this for the next tick to allow the current transaction to complete
                 setTimeout(() => {
                     editor?.chain().focus().insertContent(embedHtml).run();
                 }, 0);
                 return true;
             } else if (twitterRegex.test(trimmedText)) {
                 event.preventDefault();
                 const tweetId = trimmedText.split('/').pop()?.split('?')[0];
                 if (tweetId) {
                     const embedHtml = `<iframe border="0" frameborder="0" height="250" width="100%" src="https://platform.twitter.com/embed/Tweet.html?id=${tweetId}"></iframe>`;

                     // Replace selection if any
                     const { from, to } = view.state.selection;
                     if (from !== to) {
                         const tr = view.state.tr.delete(from, to);
                         view.dispatch(tr);
                     }

                     setTimeout(() => {
                         editor?.chain().focus().insertContent(embedHtml).run();
                     }, 0);
                     return true;
                 }
             }
        }

        return false;
      },
      handleClick: (_view: EditorView, _pos: number, event: MouseEvent) => {
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
    onUpdate: ({ editor }: { editor: TiptapEditor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      onChange(markdown);
    },
  }, [ydoc]) // Re-create editor when ydoc changes


  useEffect(() => {
    if (editor && availableNotes) {
      editor.storage.autoLink.availableNotes = availableNotes;
    }
  }, [editor, availableNotes]);

  // Handle External Updates (e.g. Restore History)
  const lastProcessedRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (editor && lastExternalUpdate && lastExternalUpdate !== lastProcessedRef.current) {
       console.log('[BlockEditor] Force updating content from external source', lastExternalUpdate);
       editor.chain().clearContent().insertContent(markdownToHtml(value)).run();
       lastProcessedRef.current = lastExternalUpdate;
    }
  }, [lastExternalUpdate, editor, value]);

  // Hydrate Yjs doc from props if empty
  useEffect(() => {
    if (!editor || !ydoc || !provider) return;

    const initData = () => {
       // Check if the document has any content.
       // Tiptap's collaboration extension uses a 'default' XmlFragment.
       const fragment = ydoc.getXmlFragment('default');

       // Special handling for Excalidraw content transition
       const hasExcalidraw = editor.state.doc.content.firstChild?.type.name === 'excalidraw';
       const isExcalidrawValue = value.trim().startsWith('```excalidraw');

       if (isExcalidrawValue && !hasExcalidraw) {
           console.log('[BlockEditor] Force hydrating Excalidraw content');
           editor.chain().clearContent().insertContent(markdownToHtml(value)).run();
           return;
       }

       if (fragment.length === 0 && value) {
          // If empty, hydrate from props
          // We must be careful not to overwrite if we are just loading
          console.log('[BlockEditor] Hydrating Yjs from API content');
          editor.chain().clearContent().insertContent(markdownToHtml(value)).run();
       }
    };

    if (provider.synced) {
      initData();
    } else {
      provider.on('synced', initData);
    }
  }, [editor, ydoc, provider, value]);

  if (isEncrypted) {
    return (
      <div className="w-full h-full flex items-center justify-center p-10 bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
           <div className="text-5xl mb-4">🔒</div>
           <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Encrypted Note</h2>
           <p className="text-slate-500 dark:text-slate-400 mb-6">
             The contents of this note are encrypted. To view or edit it, press <strong>Cmd+K</strong> (or Ctrl+K), search for <strong>Decrypt Note</strong>, and enter your password.
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto relative" onClick={() => editor?.commands.focus()}>
      {editor && <AIBubbleMenu editor={editor} />}
      <BlockHandle editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
