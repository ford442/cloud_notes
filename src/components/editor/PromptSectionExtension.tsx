import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// The React Component for the Node View
const PromptSectionComponent = ({ node }: any) => {
  const maxLength = node.attrs.maxLength || 2000;

  // Calculate text length recursively from the node content
  const textContent = node.textContent;
  const currentLength = textContent.length;

  const isOverLimit = currentLength > maxLength;

  return (
    <NodeViewWrapper className={`relative my-4 p-4 border-2 rounded-lg transition-colors duration-200 ${isOverLimit ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'}`}>
      <div className="absolute top-0 right-0 -mt-3 mr-3 bg-white dark:bg-slate-800 px-2 text-xs font-semibold rounded-full border shadow-sm flex items-center gap-1 z-10">
        <span className="text-indigo-500">Prompt Section</span>
      </div>

      {/* The actual content area where Tiptap puts the nested blocks */}
      <NodeViewContent className="min-h-[3rem] pt-2 pb-6 outline-none" />

      {/* Character Counter */}
      <div className={`absolute bottom-2 right-3 text-xs font-mono transition-colors duration-200 ${isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
        {currentLength} / {maxLength}
      </div>
    </NodeViewWrapper>
  );
};

export const PromptSectionExtension = Node.create({
  name: 'promptSection',

  group: 'block',
  content: 'block+', // Allow nested blocks (paragraphs, lists, etc.)

  addAttributes() {
    return {
      maxLength: {
        default: 2000,
        parseHTML: (element: HTMLElement) => parseInt(element.getAttribute('data-max-length') || '2000', 10),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.maxLength) {
            return {};
          }
          return {
            'data-max-length': attributes.maxLength,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="prompt-section"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'prompt-section' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PromptSectionComponent);
  },
});
