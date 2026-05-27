import type { Block } from '../types/blocks';

/**
 * BlockBridge: The safety valve between our legacy markdown strings and the new block graph.
 * This ensures 100% backward compatibility with api.ts.
 */
export const BlockBridge = {
  /**
   * Converts a legacy Markdown string into an array of Blocks.
   * MVP: Treats the entire string as one root block to guarantee zero data loss.
   */
  markdownToBlocks(markdown: string, author: string = 'System'): Block[] {
    if (!markdown) return [];

    const rootBlock: Block = {
      id: crypto.randomUUID(),
      type: 'text',
      content: markdown,
      parentId: null,
      children: [],
      backlinks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { createdBy: author, lastEditedBy: author },
      properties: {}
    };

    return [rootBlock];
  },

  /**
   * Converts an array of Blocks back into a single Markdown string.
   * This is sent to the existing api.ts save flow.
   */
  blocksToMarkdown(blocks: Block[]): string {
    if (!blocks || blocks.length === 0) return '';

    // MVP: Concatenate content safely.
    // As we evolve, this will recursively traverse block children.
    return blocks.map(b => b.content).join('\n\n');
  }
};
