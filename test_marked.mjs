import { marked } from 'marked';
import { markdownToHtml } from './src/utils/serialization.js';

const template = `
# 📅 Daily Journal: 2024-05-20

## 🎯 Top Priorities
- [ ]
- [ ]
- [ ]

## 📝 Notes
-

## 🧠 Reflections
-
`.trim();

console.log(markdownToHtml(template));
