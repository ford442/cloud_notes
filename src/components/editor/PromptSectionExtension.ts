import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { PromptSectionComponent } from './PromptSectionComponent';

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
