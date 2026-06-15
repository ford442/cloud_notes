const { JSDOM } = require('jsdom');
const dom = new JSDOM('<li data-type="taskItem" data-checked="false">Unique Task 1</li>\n<li data-type="taskItem" data-checked="true">Unique Task 2</li>');
const document = dom.window.document;
const taskItems = document.querySelectorAll('li[data-type="taskItem"]');
taskItems.forEach(li => {
    console.log(li.textContent.trim(), li.getAttribute('data-checked') === 'true');
});
