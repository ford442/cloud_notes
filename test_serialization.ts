import { marked } from 'marked';

const tiptapRenderer = {
  checkbox() {
    return '';
  },
  list(token: any) {
    const isTaskList = token.items && token.items.some((item: any) => item.task);
    if (isTaskList) {
      let body = '';
      for (let i = 0; i < token.items.length; i++) {
        // @ts-ignore - this is bound to the renderer context
        body += this.listitem(token.items[i]);
      }
      return `<ul data-type="taskList">\n${body}</ul>\n`;
    }
    return false; // fallback to default
  },
  listitem(token: any) {
    let pContent = '';
    let restContent = '';

    for (const t of token.tokens) {
      if (t.type === 'text') {
         // @ts-ignore
         let parsed = t.tokens ? this.parser.parseInline(t.tokens) : this.parser.parseInline([t]);
         parsed = parsed.replace(/\u200B/g, ''); // Do not trim here to preserve &nbsp; spaces
         pContent += parsed;
      } else if (t.type === 'paragraph') {
         // @ts-ignore
         let parsed = t.tokens ? this.parser.parseInline(t.tokens) : this.parser.parseInline([t]);
         parsed = parsed.replace(/\u200B/g, ''); // Do not trim here to preserve spaces
         pContent += parsed;
      } else if (t.type === 'list') {
         // @ts-ignore
         restContent += this.list(t);
      } else {
         // @ts-ignore
         restContent += this.parser.parse([t]);
      }
    }

    // Trim pContent after everything to clean up newlines, but keeping &nbsp;
    pContent = pContent.trim();

    if (!pContent && !restContent) {
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

const processedMarkdown = `
- [ ] &nbsp;
`.trim();

console.log(marked.parse(processedMarkdown));
