import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps, SuggestionMatch } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import type { Instance as TippyInstance } from 'tippy.js'
import { NoteLinkList } from './NoteLinkList'
import type { Editor, Range } from '@tiptap/core'
import { type CloudItemMeta, StorageService } from '../../services/api'
import { PluginKey } from '@tiptap/pm/state'

interface WikiLinkOptions {
    suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const WikiLink = Extension.create<WikiLinkOptions>({
  name: 'wikiLink',

  addOptions() {
    return {
      suggestion: {
        char: '[',
        allowSpaces: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findSuggestionMatch: (config: { char: string, allowSpaces: boolean, startOfLine: boolean, $position: any }): SuggestionMatch | null => {
            const { $position } = config;

            // Look back 1000 chars max
            const text = $position.doc.textBetween(
                Math.max(0, $position.pos - 1000),
                $position.pos,
                '\n',
                '\0'
            );

            // Regex to match [[query
            const regexp = /(?:^|\s)(?:\[\[)([^\]]*)$/
            const match = text.match(regexp);

            if (match) {
                 const fullMatch = match[0];
                 const query = match[1];

                 // If fullMatch starts with space, the [[ starts at index + 1
                 // We trim start to find the real start of [[
                 const offset = fullMatch.length - fullMatch.trimStart().length;

                 // Absolute start of [[
                 // $position.pos is the end
                 // text.length is the length we looked back
                 // match.index is relative to the start of 'text'

                 const relativeStart = (match.index || 0) + offset;
                 const from = $position.pos - text.length + relativeStart;

                 return {
                     range: {
                         from,
                         to: $position.pos
                     },
                     query,
                     text: fullMatch.trimStart()
                 }
            }
            return null;
        },
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: CloudItemMeta }) => {
          const linkText = props.name || 'Untitled';
          let linkId = props.id;

          if (props.id === 'CREATE_NEW') {
              linkId = crypto.randomUUID();
              // Create note in background
              StorageService.saveNote({
                  id: linkId,
                  title: props.name,
                  content: '',
                  subject: 'General',
                  section: 'Inbox',
                  tags: ''
              }, 'User').catch(e => console.error('Failed to create linked note', e));
          }

          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'text',
                text: linkText,
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: linkId,
                      target: '_self',
                      class: 'cursor-pointer text-blue-500 hover:text-blue-600 underline',
                    },
                  },
                ],
              },
              {
                  type: 'text',
                  text: ' ',
              }
            ])
            .run()
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: new PluginKey('wikiLink'),
      }),
    ]
  },
})

// Re-use the renderer from NoteLink logic?
// Yes, we can reuse getNoteLinkSuggestionOptions logic for the render part,
// but we need to instantiate it separately because we need to configure 'items' differently (or same)
// actually we just need the 'render' function.
// But getNoteLinkSuggestionOptions returns an object with items and render.
// We can duplicate the render logic here or export it from note-link.ts if we want to be DRY.
// For safety/speed, I'll just duplicate the render logic here, it is small.

export const getWikiLinkSuggestionOptions = (items: CloudItemMeta[]): Omit<SuggestionOptions, 'editor'> => ({
  items: ({ query }: { query: string }) => {
    const results = items.filter((item) => {
      const parts = (item.description || '').split(' ::: ');
      const subject = parts[0] || '';
      return (item.name || '').toLowerCase().includes(query.toLowerCase()) ||
             subject.toLowerCase().includes(query.toLowerCase());
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
  },

  render: () => {
    let component: ReactRenderer
    let popup: TippyInstance[]

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(NoteLinkList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        const getReferenceClientRect = props.clientRect as () => DOMRect;

        popup = tippy('body', {
          getReferenceClientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props: SuggestionProps) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        const getReferenceClientRect = props.clientRect as () => DOMRect;

        popup[0].setProps({
          getReferenceClientRect,
        })
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0].hide()

          return true
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (component.ref as any)?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
})
