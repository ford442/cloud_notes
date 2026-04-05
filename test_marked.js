const { marked } = require('marked');

const markdown = "- [ ]\n- [x] Done";
console.log(marked.parse(markdown));
