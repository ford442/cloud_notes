import type { Plugin } from '../services/plugin';
import { computeStats, formatReadingTime, formatStatsAlert } from '../utils/stats';

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

        const stats = computeStats(note.content || '');
        ctx.alert(formatStatsAlert(note.title || 'Untitled', stats));
      }
    });

    ctx.registerCommand({
      title: 'Note Statistics',
      description: 'Show word count, reading time and stats',
      searchTerms: ['stats', 'count', 'word', 'reading', 'time'],
      icon: <span className="text-lg">📊</span>,
      section: 'Tools',
      command: async ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        const content = editor.getText();
        const stats = computeStats(content);
        const summary = `**Note Statistics:**\n- ${stats.words} words\n- ${stats.characters} characters\n- ${stats.lines} lines\n- ${formatReadingTime(stats.readingTimeMinutes)}`;

        editor.chain().focus().insertContent(summary).run();
      },
    });
  }
};
