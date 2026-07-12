export const WORDS_PER_MINUTE = 200;

export interface NoteStats {
  words: number;
  characters: number;
  chars: number;
  lines: number;
  readingTimeMinutes: number;
}

export function computeStats(content: string): NoteStats {
  const text = content || '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const characters = text.length;
  const chars = text.length;
  const lines = text ? text.split('\n').length : 0;
  const readingTimeMinutes = words > 0 ? Math.ceil(words / WORDS_PER_MINUTE) : 0;

  return { words, characters, chars, lines, readingTimeMinutes };
}

export function computeNoteStats(content: string): NoteStats {
  return computeStats(content);
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min read';
  return `~${minutes} min read`;
}

export function formatStatsSummary(stats: NoteStats): string {
  const wordLabel = stats.words === 1 ? 'word' : 'words';
  return `${stats.words.toLocaleString()} ${wordLabel} · ${formatReadingTime(stats.readingTimeMinutes)}`;
}

export function formatStatsAlert(title: string, stats: NoteStats): string {
  return [
    `Statistics for "${title}"`,
    '',
    `Words: ${stats.words.toLocaleString()}`,
    `Characters: ${stats.characters.toLocaleString()}`,
    `Lines: ${stats.lines.toLocaleString()}`,
    `Reading Time: ${formatReadingTime(stats.readingTimeMinutes)}`,
  ].join('\n');
}
