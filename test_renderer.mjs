import { Marked } from 'marked';

const markedInstance = new Marked();

const renderer = {
  checkbox(token) {
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
    return false;
  },
  listitem(token) {
    if (token.task) {
      const isChecked = token.checked ? 'true' : 'false';

      let pContent = '';
      let restContent = '';

      for (const t of token.tokens) {
        if (t.type === 'text') {
           // We might need to manually parse the text tokens to handle nested inline tokens
           let parsed = this.parser.parseInline([t]).trim();
           parsed = parsed.replace(/\u200B/g, '').trim();
           pContent += parsed;
        } else if (t.type === 'paragraph') {
           // If it's already a paragraph, extract its contents
           let parsed = this.parser.parseInline(t.tokens).trim();
           parsed = parsed.replace(/\u200B/g, '').trim();
           pContent += parsed;
        } else if (t.type === 'list') {
           restContent += this.list(t);
        } else {
           restContent += this.parser.parse([t]);
        }
      }

      return `<li data-type="taskItem" data-checked="${isChecked}"><p>${pContent}</p>${restContent}</li>\n`;
    }
    return false;
  }
};

markedInstance.use({ renderer });

const markdown = "- [ ] Task\n  - [x] Child task\n- [ ] Another task\n- [ ] ";
console.log(markedInstance.parse(markdown.replace(/^(\s*- \[[ x]\])\s*$/gm, '$1 \u200B')));
