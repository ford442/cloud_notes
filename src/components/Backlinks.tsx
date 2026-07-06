import { useEffect, useState } from 'react';
import type { CloudItemMeta } from '../services/api';
import { BacklinkService, type BacklinkEntry } from '../services/BacklinkService';

interface BacklinksProps {
  notes: CloudItemMeta[];
  currentId: string | null;
  onNavigate: (id: string) => void;
}

export const Backlinks = ({ notes, currentId, onNavigate }: BacklinksProps) => {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (!currentId) {
      setBacklinks([]);
      return;
    }

    const fetchBacklinks = async () => {
      const byId = await BacklinkService.getBacklinks(currentId);

      // Deduplicate based on sourceId
      const uniqueIds = new Set<string>();
      const combined: BacklinkEntry[] = [];

      for (const entry of byId) {
        if (!uniqueIds.has(entry.sourceId)) {
          uniqueIds.add(entry.sourceId);
          combined.push(entry);
        }
      }

      setBacklinks(combined);
    };

    fetchBacklinks();
  }, [currentId, notes]);

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-4 backdrop-blur-sm">
      <div
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">
          <span className="text-blue-500">🔗</span> Linked References <span className="ml-1 bg-slate-200 dark:bg-slate-700 text-[10px] px-1.5 py-0.5 rounded-full text-slate-500 dark:text-slate-400">{backlinks.length}</span>
        </h3>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
          {backlinks.map(link => {
            const noteMeta = notes.find(n => n.id === link.sourceId);
            return (
              <div
                key={link.sourceId}
                onClick={() => onNavigate(link.sourceId)}
                className="p-3 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-xl cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500/50 transition-all group"
              >
                <div className="font-medium text-slate-700 dark:text-slate-200 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex items-center gap-2">
                   <svg width="14" height="14" className="opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                   {link.sourceName || 'Untitled Note'}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate pl-6">
                  {(noteMeta?.description?.split(' ::: ')[0]) || 'General'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};
