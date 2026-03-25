import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Configure Turndown service
const turndownService = new TurndownService({
  headingStyle: 'atx', // Use # for headings
  codeBlockStyle: 'fenced', // Use ``` for code blocks
  bulletListMarker: '-', // Use - for bullets
});

// Use the GFM plugin to handle tables, strikethrough, and task lists
turndownService.use(gfm);

// Custom Rule for Tiptap Task Lists
// Tiptap renders <ul data-type="taskList">...</ul>
turndownService.addRule('tiptapTaskList', {
  filter: (node) => {
    return node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList';
  },
  replacement: (content) => {
    return content;
  }
});

// Custom Rule for Tiptap Task Items
// Tiptap renders <li data-type="taskItem" data-checked="true/false">...</li>
turndownService.addRule('tiptapTaskItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem';
  },
  replacement: (content, node) => {
    const isChecked = (node as HTMLElement).getAttribute('data-checked') === 'true';
    // Clean up content (remove newlines usually added by block elements inside li)
    const cleanContent = content.trim();
    return `${isChecked ? '- [x]' : '- [ ]'} ${cleanContent}\n`;
  }
});


// Keep iframe tags to support YouTube embeds and other rich content
// We removed 'div' from keep because Tiptap wraps task items in divs which caused them to be serialized as HTML instead of Markdown.
// Instead, we use a specific keep filter for divs with data-type="prompt-section"
turndownService.keep((node) => {
  return node.nodeName === 'IFRAME' || (node.nodeName === 'DIV' && node.getAttribute('data-type') === 'prompt-section');
});

/**
 * Converts Markdown string to HTML string
 */
export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  // marked.parse returns a string or Promise<string>. synchronous by default unless async is enabled.
  // We cast to string because we are not using async features of marked.
  return marked.parse(markdown) as string;
};

/**
 * Converts HTML string to Markdown string
 */
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  return turndownService.turndown(html);
};
