import type { Plugin } from '../services/plugin';

export const TasksPlugin: Plugin = {
  id: 'task-dashboard',
  name: 'Task Dashboard',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-task-dashboard',
      title: 'Task Dashboard',
      section: 'View',
      icon: <span className="text-lg">☑</span>,
      perform: () => {
        ctx.setMode('tasks');
      }
    });

    ctx.registerCommand({
      title: 'Tasks',
      description: 'Open task dashboard',
      searchTerms: ['tasks', 'todo', 'checklist'],
      icon: <span className="text-lg">☑</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setMode('tasks');
      }
    });
  }
};
