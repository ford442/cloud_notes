import { useEffect, useState } from 'react';
import type { Note } from '../services/api';
import { computeStats, formatReadingTime } from '../utils/stats';

interface EditorStatusBarProps {
  currentNote?: Note | null;
  focusMode?: boolean;
  content?: string;
}

export const EditorStatusBar = ({ currentNote, focusMode = false, content }: EditorStatusBarProps) => {
  const [stats, setStats] = useState({ words: 0, readingTimeMinutes: 0 });

  useEffect(() => {
    const noteContent = currentNote?.content ?? content ?? '';
    if (!noteContent) {
      setStats({ words: 0, readingTimeMinutes: 0 });
      return;
    }

    const { words, readingTimeMinutes } = computeStats(noteContent);
    setStats({ words, readingTimeMinutes });
  }, [currentNote?.content, content]);

  if (focusMode) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 flex items-center px-4 justify-end text-xs text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 rounded-b-xl select-none z-10 pointer-events-none transition-opacity duration-300">
      <div className="flex items-center gap-2">
        <span>{stats.words} words</span>
        <span>·</span>
        <span>{formatReadingTime(stats.readingTimeMinutes)}</span>
      </div>
    </div>
  );
};
