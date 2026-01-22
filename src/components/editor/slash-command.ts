import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import type { Instance as TippyInstance } from 'tippy.js'
import { SlashCommandList } from './SlashCommandList'
import type { Editor, Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'

interface CommandProps {
  editor: Editor;
  range: Range;
}

export interface CommandItem {
  title: string;
  description?: string;
  searchTerms?: string[];
  icon: React.ReactNode;
  command: (props: CommandProps) => void;
}

interface SuggestionItem {
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SuggestionItem }) => {
          props.command({ editor, range })
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: new PluginKey('slashCommand'),
      }),
    ]
  },
})

export const getSlashSuggestionOptions = (items: CommandItem[]): Omit<SuggestionOptions, 'editor'> => ({
  items: ({ query }: { query: string }) => {
    return items.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 50)
  },

  render: () => {
    let component: ReactRenderer
    let popup: TippyInstance[]

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(SlashCommandList, {
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
