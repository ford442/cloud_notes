import type { Plugin } from '../services/plugin';

export const TexturesPlugin: Plugin = {
  id: 'textures-panel',
  name: 'Textures Panel',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-textures-panel',
      title: 'Textures',
      section: 'View',
      icon: <span className="text-lg">🖼️</span>,
      keywords: ['textures', 'images', 'assets', 'panel', 'gallery'],
      perform: () => {
        ctx.setMode('textures');
      }
    });

    ctx.registerCommand({
      title: 'Textures',
      description: 'Open the textures gallery panel',
      searchTerms: ['textures', 'images', 'assets', 'panel'],
      icon: <span className="text-lg">🖼️</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setMode('textures');
      }
    });
  }
};
