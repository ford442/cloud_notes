import { marked } from 'marked';
import { gfm } from 'turndown-plugin-gfm';

const markdown = `
# 📅 Daily Journal: 2024-05-20

## 🎯 Top Priorities
- [ ]
- [ ]
- [ ]

## 📝 Notes
-

## 🧠 Reflections
-
`;

const processedMarkdown = markdown
    .replace(/^(\s*- \[[ x]\])\s*$/gm, '$1 &nbsp;')
    .replace(/^(\s*-)\s*$/gm, '$1 &nbsp;')
    .replace(/^(\s*\d+\.)\s*$/gm, '$1 &nbsp;');

console.log(processedMarkdown);
