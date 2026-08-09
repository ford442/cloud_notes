import type { Plugin } from '../services/plugin';

export const TimeTravelPlugin: Plugin = {
  id: 'core-time-travel',
  name: 'Time Travel',
  init: (ctx) => {
    ctx.registerAction({
      id: 'time-travel',
      title: 'Time Travel (History)',
      section: 'Actions',
      icon: <span className="text-lg">🕰️</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) {
          ctx.alert('No note selected');
          return;
        }
        window.dispatchEvent(new CustomEvent('open-history'));
      }
    });

    ctx.registerCommand({
      title: 'Time Travel',
      description: 'View and restore previous versions of this note',
      searchTerms: ['time', 'travel', 'history', 'version', 'restore', 'undo'],
      icon: <span className="text-lg">🕰️</span>,
      section: 'Tools',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        window.dispatchEvent(new CustomEvent('open-history'));
      },
    });
  }
};
