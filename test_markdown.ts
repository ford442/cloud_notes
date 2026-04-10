import { marked } from 'marked';
import { markdownToHtml } from './src/utils/serialization.ts';

const processedMarkdown = markdownToHtml(`
- [ ]
`);
console.log(processedMarkdown);
