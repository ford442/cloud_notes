import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import type { Instance as TippyInstance } from 'tippy.js'
import { NoteLinkList } from './NoteLinkList'
import type { Editor, Range } from '@tiptap/core'
import { type CloudItemMeta, StorageService } from '../../services/api'
import { PluginKey } from '@tiptap/pm/state'

interface NoteLinkOptions {
    suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const NoteLink = Extension.create<NoteLinkOptions>({
  name: 'noteLink',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: CloudItemMeta }) => {
          // Insert a link with the note ID
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
                      href: linkId, // Store ID in href for now
                      target: '_self',
                      class: 'internal-wiki-link',
                      'data-id': linkId,
                    },
                  },
                ],
              },
              {
                  type: 'text',
                  text: ' ', // Add a space after the link
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
        pluginKey: new PluginKey('noteLink'),
      }),
    ]
  },
})

export const getNoteLinkSuggestionOptions = (items: CloudItemMeta[]): Omit<SuggestionOptions, 'editor'> => ({
  items: ({ query }: { query: string }) => {
    const results = items.filter((item) => {
      const parts = (item.description || '').split(' ::: ');
      const subject = parts[0] || '';
      return (item.name || '').toLowerCase().includes(query.toLowerCase()) ||
             subject.toLowerCase().includes(query.toLowerCase());
    }).slice(0, 10);

    const exactMatch = results.find(i => (i.name || '').toLowerCase() === query.toLowerCase());
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


        return (component.ref as any)?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
})
