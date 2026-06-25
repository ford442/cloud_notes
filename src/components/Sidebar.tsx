import { useState, useMemo, useEffect } from 'react'
import Fuse from 'fuse.js'
import type { CloudItemMeta } from '../services/api'
import { useToast } from './Toast'

interface SidebarProps {
  notes: CloudItemMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
  onMoveNote?: (id: string, newSubject: string, newSection: string) => void;
  onSearchOpen?: () => void;
  onVpsSync?: (onProgress?: (message: string) => void) => Promise<{ pulled: number; pushed: number; errors: string[] }>;
}

// Icons
const FolderIcon = () => (
  <svg width="16" height="16" className="w-4 h-4 flex-none text-cyan-500 dark:text-cyan-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
)
const SectionIcon = () => (
  <svg width="16" height="16" className="w-4 h-4 flex-none text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
)
const NoteIcon = () => (
  <svg width="16" height="16" className="w-4 h-4 flex-none text-slate-400 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
)

// Helper to parse "Subject ::: Section ::: Tags"
const parseMeta = (desc: string) => {
  if (!desc) return { subject: 'General', section: 'Inbox' };
  const parts = desc.split(' ::: ');
  if (parts.length < 2) return { subject: 'General', section: 'Inbox' };
  return { subject: parts[0] || 'General', section: parts[1] || 'Inbox' };
};

export const Sidebar = ({ notes, selectedId, onSelect, onNew, isLoading, onMoveNote, onSearchOpen, onVpsSync }: SidebarProps) => {
  const { addToast } = useToast();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Fuse Instance
  const fuse = useMemo(() => new Fuse(notes, {
    keys: ['name', 'description'],
    threshold: 0.3,
    ignoreLocation: true,
    includeScore: true
  }), [notes]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    return fuse.search(query).map(result => result.item);
  }, [notes, query, fuse]);

  // Build the Tree Structure
  const tree = useMemo(() => {
    const structure: Record<string, Record<string, CloudItemMeta[]>> = {};
    
    filteredNotes.forEach(note => {
      const { subject, section } = parseMeta(note.description);
      if (!structure[subject]) structure[subject] = {};
      if (!structure[subject][section]) structure[subject][section] = [];
      structure[subject][section].push(note);
    });
    
    // Sort Alphabetically
    const sorted: typeof structure = {};
    Object.keys(structure).sort().forEach(sub => {
      sorted[sub] = {};
      Object.keys(structure[sub]).sort().forEach(sec => {
        sorted[sub][sec] = structure[sub][sec];
      });
    });
    return sorted;
  }, [filteredNotes]);

  // Auto-expand if searching
  const isSearching = query.trim().length > 0;

  return (
    <div className="w-80 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col h-full shrink-0 select-none text-sm m-6 mr-0 rounded-2xl shadow-2xl transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 space-y-4 transition-colors">
        <div className="flex justify-between items-center">
          <h1 className="font-bold text-gray-800 dark:text-gray-100 text-sm tracking-widest flex items-center gap-3">
            <span className="text-blue-500 dark:text-blue-400 text-lg">📚</span> KNOWLEDGE
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onSearchOpen}
              className="text-xs p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-all shadow-sm flex items-center justify-center"
              title="Deep Search (Cmd+Shift+F)"
            >
              <SearchIcon />
            </button>
            <button
              onClick={onNew}
              className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-3 py-1.5 rounded-lg transition-all shadow-lg"
            >
              + New
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-2xl leading-5 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Syncing...
          </div>
        ) : filteredNotes.length === 0 && isSearching ? (
             <div className="text-center py-8 text-slate-500 dark:text-slate-400 italic">
               No matching notes found.
             </div>
        ) : (
          Object.entries(tree).map(([subject, sections]) => (
            <div key={subject} className="mb-4">
              
              {/* SUBJECT (Root) */}
              <div 
                onClick={() => toggle(subject)}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (onMoveNote) setDragOverTarget(subject);
                }}
                onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverTarget(null);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTarget(null);
                    const id = e.dataTransfer.getData('text/plain');
                    if (id && onMoveNote) onMoveNote(id, subject, 'Inbox');
                }}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer text-slate-700 dark:text-slate-200 transition-all group ${
                    dragOverTarget === subject
                    ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-500/30'
                    : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20 border border-transparent'
                }`}
              >
                <span className={`text-xs text-slate-400 dark:text-slate-400 transition-transform ${(!isSearching && collapsed[subject]) ? '-rotate-90' : ''}`}>▼</span>
                <FolderIcon />
                <span className="font-semibold text-sm uppercase tracking-wide group-hover:text-slate-900 dark:group-hover:text-white">{subject}</span>
              </div>

              {/* Always expand if searching, otherwise check state */}
              {(isSearching || !collapsed[subject]) && (
                <div className="ml-4 border-l border-slate-300/30 dark:border-slate-600/30 pl-4 mt-2 space-y-2">
                  {Object.entries(sections).map(([section, sectionNotes]) => (
                    <div key={section}>
                      
                      {/* SECTION (Sub-folder) */}
                      <div 
                        onClick={() => toggle(`${subject}-${section}`)}
                        onDragOver={(e) => {
                            e.preventDefault();
                            if (onMoveNote) setDragOverTarget(`${subject}-${section}`);
                        }}
                        onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                            setDragOverTarget(null);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragOverTarget(null);
                            const id = e.dataTransfer.getData('text/plain');
                            if (id && onMoveNote) onMoveNote(id, subject, section);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors ${
                            dragOverTarget === `${subject}-${section}`
                            ? 'bg-blue-100 dark:bg-blue-900/40'
                            : 'hover:bg-slate-200/50 dark:hover:bg-slate-700/20'
                        }`}
                      >
                        <span className={`text-xs text-slate-400 dark:text-slate-500 transition-transform ${(!isSearching && collapsed[`${subject}-${section}`]) ? '-rotate-90' : ''}`}>▼</span>
                        <SectionIcon />
                        <span className="text-sm font-medium">{section}</span>
                        <span className="text-xs bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400">{sectionNotes.length}</span>
                      </div>

                      {/* NOTES (Leaf) */}
                      {(isSearching || !collapsed[`${subject}-${section}`]) && (
                        <div className="ml-6 space-y-1 border-l border-slate-300/20 dark:border-slate-600/20 pl-3">
                          {sectionNotes.map(note => (
                            <div
                              key={`sidebar-${subject}-${section}-${note.id}`}
                              draggable="true"
                              onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', note.id);
                                  e.dataTransfer.effectAllowed = 'move';
                              }}
                              onClick={() => onSelect(note.id)}
                              className={`
                                group flex items-center gap-3 px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-200 hover:translate-x-1 relative
                                ${selectedId === note.id 
                                  ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium scale-[1.01]'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/20'
                                }
                              `}
                            >
                              <NoteIcon />
                              <div className="truncate">{note.name}</div>
                              {selectedId === note.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r transition-all duration-300"></div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      

      {/* Footer Status */}
      <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-900/30 text-xs text-slate-500 dark:text-slate-400 flex justify-between font-medium rounded-b-2xl transition-colors">
        <div className="flex items-center gap-3">
            <span>{filteredNotes.length} {filteredNotes.length === 1 ? 'Item' : 'Items'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${isOnline ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100/50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <span className="font-semibold text-[10px] uppercase tracking-wider">{isOnline ? (isSyncing ? 'Syncing...' : 'Online') : 'Offline'}</span>
          </div>
          {onVpsSync && (

            <button
              onClick={async () => {
                if (isSyncing) return;
                setIsSyncing(true);
                try {
                  await onVpsSync();
                } catch (e) {
                  console.error(e);
                  addToast('Sync failed', 'error');
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50 transition-colors"
              title="Sync with VPS"
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Syncing…</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span>Sync</span>
                </>
              )}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : 'bg-green-500 dark:bg-green-400'}`}></div>
            <span>{isSyncing ? 'Syncing…' : 'Synced'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
