const WORDS_PER_MINUTE = 200;

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

export function formatStatsSummary(stats: NoteStats): string {
  return `${stats.words.toLocaleString()} words · ~${stats.readingTimeMinutes} min read`;
}

export function formatStatsAlert(title: string, stats: NoteStats): string {
  return `Statistics for "${title}"\n\nWords: ${stats.words.toLocaleString()}\nCharacters: ${stats.chars.toLocaleString()}\nLines: ${stats.lines.toLocaleString()}\nReading Time: ~${stats.readingTimeMinutes} min`;
}
