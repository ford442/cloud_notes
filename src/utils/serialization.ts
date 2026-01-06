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
