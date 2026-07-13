import type { Plugin } from '../services/plugin';

export const EffectsMediaPlugin: Plugin = {
  id: 'effects-media-panel',
  name: 'Effects Media Panel',
  init: (ctx) => {
    ctx.registerAction({
      id: 'open-effects-media-panel',
      title: 'Effects Media',
      section: 'View',
      icon: <span className="text-lg">🎬</span>,
      keywords: ['effects', 'media', 'images', 'videos', 'gcs', 'pixelocity', 'image_video_effects', 'bucket'],
      perform: () => {
        ctx.setMode('effects-media');
      }
    });

    ctx.registerCommand({
      title: 'Effects Media',
      description: 'Browse and manage image/video effects media in GCS',
      searchTerms: ['effects', 'media', 'images', 'videos', 'gcs', 'pixelocity', 'bucket'],
      icon: <span className="text-lg">🎬</span>,
      section: 'View',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        ctx.setMode('effects-media');
      }
    });
  }
};
