export const WORDS_PER_MINUTE = 200;

export interface NoteStats {
  words: number;
  chars: number;
  lines: number;
  readingTimeMinutes: number;
}

export function computeNoteStats(content: string): NoteStats {
  const text = content || '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const readingTimeMinutes = Math.ceil(words / WORDS_PER_MINUTE);

  return { words, chars, lines, readingTimeMinutes };
}

export function formatReadingTime(minutes: number): string {
  if (minutes <= 1) return '~1 min';
  return `~${minutes} min`;
}

export function formatStatsSummary(stats: NoteStats): string {
  const wordLabel = stats.words === 1 ? 'word' : 'words';
  return `${stats.words.toLocaleString()} ${wordLabel} · ${formatReadingTime(stats.readingTimeMinutes)} read`;
}

export function formatStatsAlert(title: string, stats: NoteStats): string {
  return [
    `Statistics for "${title}"`,
    '',
    `Words: ${stats.words.toLocaleString()}`,
    `Characters: ${stats.chars.toLocaleString()}`,
    `Lines: ${stats.lines.toLocaleString()}`,
    `Reading Time: ${formatReadingTime(stats.readingTimeMinutes)}`,
  ].join('\n');
}
