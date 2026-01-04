import { marked } from 'marked';
import TurndownService from 'turndown';

// Configure Turndown service
const turndownService = new TurndownService({
  headingStyle: 'atx', // Use # for headings
  codeBlockStyle: 'fenced', // Use ``` for code blocks
  bulletListMarker: '-', // Use - for bullets
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
