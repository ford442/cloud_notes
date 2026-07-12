import { useMemo } from 'react';
import { computeNoteStats, formatStatsSummary } from '../utils/stats';

interface EditorStatusBarProps {
  content: string;
}

export function EditorStatusBar({ content }: EditorStatusBarProps) {
  const summary = useMemo(() => formatStatsSummary(computeNoteStats(content)), [content]);

  return (
    <div
      className="flex items-center justify-end px-4 py-1.5 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/20 text-xs font-medium text-slate-400 dark:text-slate-500 select-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {summary}
    </div>
  );
}
