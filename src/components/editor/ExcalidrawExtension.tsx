import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Excalidraw } from '@excalidraw/excalidraw'
import { useMemo } from 'react'

const ExcalidrawComponent = (props: any) => {
  const node = props.node;
  const dataString = node.attrs.data;

  const parsedData = useMemo(() => {
      try {
          return JSON.parse(dataString);
      } catch (e) {
          return null;
      }
  }, [dataString]);

  if (!parsedData) {
    return (
      <NodeViewWrapper className="excalidraw-component my-4 relative">
         <div className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 text-center rounded border border-slate-200 dark:border-slate-700">
            Invalid Excalidraw Data
         </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="excalidraw-component border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden my-4 shadow-sm relative group">
      {/* Label */}
      <div className="absolute top-2 right-2 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur px-2 py-1 rounded text-xs font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none">
        Excalidraw Preview
      </div>

      <div style={{ height: '400px', width: '100%', position: 'relative' }}>
         <Excalidraw
            initialData={{
                elements: parsedData.elements,
                appState: {
                    ...parsedData.appState,
                    viewBackgroundColor: 'transparent',
                    scrollX: 0,
                    scrollY: 0
                },
                scrollToContent: true
            }}
            viewModeEnabled={true}
            zenModeEnabled={true}
            gridModeEnabled={false}
         />
      </div>
    </NodeViewWrapper>
  )
}

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
        getAttrs: (node) => {
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

  renderHTML({ node }) {
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
