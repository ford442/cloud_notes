import type { Plugin } from '../services/plugin';

export const LibraryPlugin: Plugin = {
  id: 'cloud-library',
  name: 'Cloud Library Browser',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-library-browser',
      title: 'Cloud Library Browser',
      section: 'View',
      icon: <span className="text-lg">☁️</span>,
      keywords: ['library', 'cloud', 'assets', 'samples', 'songs', 'patterns'],
      perform: () => {
        ctx.setMode('library-browser');
      }
    });

    ctx.registerCommand({
      title: 'Library Browser',
      description: 'Browse cloud assets, songs, and samples',
      searchTerms: ['library', 'cloud', 'assets', 'samples', 'songs', 'patterns'],
      icon: <span className="text-lg">☁️</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setMode('library-browser');
      }
    });
  }
};
