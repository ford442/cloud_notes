import type { Plugin } from '../services/plugin';

export const MusicPlugin: Plugin = {
  id: 'music-library',
  name: 'Music Library',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-music-library',
      title: 'Music Library',
      section: 'View',
      icon: <span className="text-lg">🎵</span>,
      keywords: ['music', 'flac', 'audio', 'songs', 'player'],
      perform: () => {
        ctx.setMode('music');
      }
    });

    ctx.registerCommand({
      title: 'Music Library',
      description: 'Open the music library manager',
      searchTerms: ['music', 'flac', 'audio', 'songs'],
      icon: <span className="text-lg">🎵</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setMode('music');
      }
    });
  }
};
