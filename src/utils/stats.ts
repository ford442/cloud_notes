export interface NoteStats {
  words: number;
  characters: number;
  lines: number;
  readingTimeMinutes: number;
}

export function computeStats(content: string): NoteStats {
  if (!content) {
    return { words: 0, characters: 0, lines: 0, readingTimeMinutes: 0 };
  }

  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const characters = content.length;
  const lines = content.split('\n').length;

  // Standard reading speed is generally assumed to be ~200 WPM
  const readingTimeMinutes = Math.ceil(words / 200);

  return { words, characters, lines, readingTimeMinutes };
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min read';
  return `~${minutes} min read`;
}
