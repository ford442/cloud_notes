import type { Plugin } from '../services/plugin';
import { computeNoteStats, formatStatsAlert } from '../utils/stats';

export const StatsPlugin: Plugin = {
  id: 'core-stats',
  name: 'Statistics',
  init: (ctx) => {
    ctx.registerAction({
      id: 'show-stats',
      title: 'Show Note Statistics',
      section: 'Actions',
      icon: <span className="text-lg">📊</span>,
      perform: () => {
        const note = ctx.getCurrentNote();
        if (!note) {
            ctx.alert('No note selected');
            return;
        }

        const stats = computeNoteStats(note.content || '');
        ctx.alert(formatStatsAlert(note.title || 'Untitled', stats));
      }
    });

    ctx.registerCommand({
      title: 'Note Statistics',
      description: 'Show word count, reading time, and stats',
      searchTerms: ['stats', 'count', 'word', 'reading', 'time'],
      icon: <span className="text-lg">📊</span>,
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        const stats = computeNoteStats(content);

        await ctx.alert(`Statistics\n\nWords: ${stats.words}\nCharacters: ${stats.chars}\nLines: ${stats.lines}\nReading Time: ~${stats.readingTimeMinutes} min`);
      }
    });
  }
};
