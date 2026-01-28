import { useState, useEffect } from 'react';
import type { CloudItemMeta } from '../services/api';
import { SemanticService } from '../services/semantic';

interface RelatedNotesProps {
  notes: CloudItemMeta[];
  currentId: string | null;
  content: string;
  onNavigate: (id: string) => void;
}

export const RelatedNotes = ({ notes, currentId, content, onNavigate }: RelatedNotesProps) => {
  const [relatedIds, setRelatedIds] = useState<{ id: string; score: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only search if we have content and an ID
    if (!content || !currentId || content.length < 30) {
      setRelatedIds([]);
      return;
    }

    // Debounce to prevent rapid firing while typing
    const timer = setTimeout(async () => {
      setLoading(true);
      const similar = await SemanticService.findSimilar(content, currentId);
      setRelatedIds(similar);
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, currentId]);

  const relatedNotes = relatedIds
    .map(r => {
      const note = notes.find(n => n.id === r.id);
      return note ? { ...note, score: r.score } : null;
    })
    .filter((n): n is CloudItemMeta & { score: number } => !!n);

  if (relatedNotes.length === 0) return null;

  return (
    <div className="border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 p-6 backdrop-blur-sm">
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-4 uppercase tracking-widest flex items-center gap-2">
        <span className="text-purple-500">🧠</span> Related Notes {loading && <span className="animate-pulse opacity-50">...</span>}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {relatedNotes.map(note => (
          <div
            key={note.id}
            onClick={() => onNavigate(note.id)}
            className="p-3 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-xl cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500/50 transition-all group relative overflow-hidden"
          >
            {/* Relevance Score Indicator */}
            <div
              className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-purple-400 to-blue-500"
              style={{ opacity: Math.max(0.3, note.score) }}
            />

            <div className="font-medium text-slate-700 dark:text-slate-200 text-sm group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate flex items-center gap-2 pl-2">
               {note.name}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate pl-2">
              {(note.description?.split(' ::: ')[0]) || 'General'} • {Math.round(note.score * 100)}% Match
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
