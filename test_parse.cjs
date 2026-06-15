const { marked } = require('marked');

const tiptapRenderer = {
  checkbox() {
    return '';
  },
  list(token) {
    const isTaskList = token.items && token.items.some(item => item.task);
    if (isTaskList) {
      let body = '';
      for (let i = 0; i < token.items.length; i++) {
        body += this.listitem(token.items[i]);
      }
      return `<ul data-type="taskList">\n${body}</ul>\n`;
    }
    return false; // fallback to default
  },
  listitem(token) {
    let pContent = '';
    let restContent = '';

    if (token.tokens) {
      for (const t of token.tokens) {
        if (t.type === 'text') {
           let parsed = t.tokens ? this.parser.parseInline(t.tokens).trim() : this.parser.parseInline([t]).trim();
           parsed = parsed.replace(/\u200B/g, '').trim();
           pContent += parsed;
        } else if (t.type === 'paragraph') {
           let parsed = t.tokens ? this.parser.parseInline(t.tokens).trim() : this.parser.parseInline([t]).trim();
           parsed = parsed.replace(/\u200B/g, '').trim();
           pContent += parsed;
        } else if (t.type === 'list') {
           restContent += this.list(t);
        } else {
           restContent += this.parser.parse([t]);
        }
      }
    }

    if (!pContent?.trim() && !restContent?.trim()) {
        pContent = '&nbsp;';
    }

    if (token.task) {
      const isChecked = token.checked ? 'true' : 'false';
      return `<li data-type="taskItem" data-checked="${isChecked}"><p>${pContent}</p>${restContent}</li>\n`;
    }
    return `<li><p>${pContent}</p>${restContent}</li>\n`;
  }
};

marked.use({ renderer: tiptapRenderer });

function markdownToHtml(markdown) {
  if (!markdown) return '';
  const processedMarkdown = markdown
    .replace(/^(\s*- \[[ x]\])\s*$/gm, '$1 &nbsp;')
    .replace(/^(\s*-)\s*$/gm, '$1 &nbsp;')
    .replace(/^(\s*\d+\.)\s*$/gm, '$1 &nbsp;');
  return marked.parse(processedMarkdown);
}

console.log(markdownToHtml('- [ ] '));
