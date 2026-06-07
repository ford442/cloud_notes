import { Node, mergeAttributes } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ExcalidrawComponent } from './ExcalidrawComponent'

export const ExcalidrawExtension = Node.create({
  name: 'excalidraw',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      data: {
        default: '{}',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (node: HTMLElement) => {
            if (node instanceof HTMLElement) {
                const code = node.querySelector('code.language-excalidraw');
                if (code) {
                    return { data: code.textContent || '{}' }
                }
            }
            return false
        },
      },
    ]
  },

  renderHTML({ node }: { node: ProseMirrorNode }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes),
      ['code', { class: 'language-excalidraw' }, node.attrs.data]
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawComponent)
  },
})
