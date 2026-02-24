import type { Plugin } from '../services/plugin';

export const FocusPlugin: Plugin = {
  id: 'focus-mode',
  name: 'Focus Mode',
  init: (ctx) => {
    ctx.registerAction({
      id: 'toggle-focus-mode',
      title: 'Toggle Focus Mode',
      section: 'View',
      icon: <span className="text-lg">👁️</span>,
      perform: () => {
         // This action is tricky because we don't have a getter for focus mode state in context.
         // But we can just set it to true for now as the main entry point.
         ctx.setFocusMode(true);
      }
    });

    ctx.registerCommand({
      title: 'Focus Mode',
      description: 'Enter distraction-free mode',
      searchTerms: ['focus', 'zen', 'hide', 'fullscreen'],
      icon: <span className="text-lg">👁️</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setFocusMode(true);
      }
    });

    ctx.registerCommand({
      title: 'Exit Focus',
      description: 'Exit distraction-free mode',
      searchTerms: ['exit', 'unfocus', 'show'],
      icon: <span className="text-lg">❎</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setFocusMode(false);
      }
    });
  }
};
