import { useState, useMemo } from 'react'
import type { CloudItemMeta } from '../services/api'

interface SidebarProps {
  notes: CloudItemMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
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

// Helper to parse "Subject ::: Section ::: Tags"
const parseMeta = (desc: string) => {
  if (!desc) return { subject: 'General', section: 'Inbox' };
  const parts = desc.split(' ::: ');
  if (parts.length < 2) return { subject: 'General', section: 'Inbox' };
  return { subject: parts[0] || 'General', section: parts[1] || 'Inbox' };
};

export const Sidebar = ({ notes, selectedId, onSelect, onNew, isLoading }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  // Build the Tree Structure
  const tree = useMemo(() => {
    const structure: Record<string, Record<string, CloudItemMeta[]>> = {};
    
    notes.forEach(note => {
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
  }, [notes]);

  return (
    <div className="w-80 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50 flex flex-col h-full shrink-0 select-none text-sm m-6 mr-0 rounded-2xl shadow-2xl transition-colors duration-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center transition-colors">
        <h1 className="font-bold text-gray-800 dark:text-gray-100 text-sm tracking-widest flex items-center gap-3">
          <span className="text-blue-500 dark:text-blue-400 text-lg">📚</span> KNOWLEDGE
        </h1>
        <button 
          onClick={onNew}
          className="text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg"
        >
          + New Note
        </button>
      </div>

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Syncing...
          </div>
        ) : (
          Object.entries(tree).map(([subject, sections]) => (
            <div key={subject} className="mb-4">
              
              {/* SUBJECT (Root) */}
              <div 
                onClick={() => toggle(subject)}
                className="flex items-center gap-3 p-3 hover:bg-slate-200/50 dark:hover:bg-slate-700/30 rounded-xl cursor-pointer text-slate-700 dark:text-slate-200 transition-all group"
              >
                <span className={`text-xs text-slate-400 dark:text-slate-400 transition-transform ${collapsed[subject] ? '-rotate-90' : ''}`}>▼</span>
                <FolderIcon />
                <span className="font-semibold text-sm uppercase tracking-wide group-hover:text-slate-900 dark:group-hover:text-white">{subject}</span>
              </div>

              {!collapsed[subject] && (
                <div className="ml-4 border-l border-slate-300/30 dark:border-slate-600/30 pl-4 mt-2 space-y-2">
                  {Object.entries(sections).map(([section, sectionNotes]) => (
                    <div key={section}>
                      
                      {/* SECTION (Sub-folder) */}
                      <div 
                        onClick={() => toggle(`${subject}-${section}`)}
                        className="flex items-center gap-3 p-2 hover:bg-slate-100/50 dark:hover:bg-slate-700/20 rounded-lg cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                      >
                        <span className={`text-xs text-slate-400 dark:text-slate-500 transition-transform ${collapsed[`${subject}-${section}`] ? '-rotate-90' : ''}`}>▼</span>
                        <SectionIcon />
                        <span className="text-sm font-medium">{section}</span>
                        <span className="text-xs bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-full text-slate-500 dark:text-slate-400">{sectionNotes.length}</span>
                      </div>

                      {/* NOTES (Leaf) */}
                      {!collapsed[`${subject}-${section}`] && (
                        <div className="ml-6 space-y-1 border-l border-slate-300/20 dark:border-slate-600/20 pl-3">
                          {sectionNotes.map(note => (
                            <div
                              key={note.id}
                              onClick={() => onSelect(note.id)}
                              className={`
                                group flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all relative
                                ${selectedId === note.id 
                                  ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-700 dark:text-blue-100 border border-blue-500/30'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/20'
                                }
                              `}
                            >
                              <NoteIcon />
                              <div className="truncate">{note.name}</div>
                              {selectedId === note.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r"></div>}
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
        <span>{notes.length} Items</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
          <span>Synced</span>
        </div>
      </div>
    </div>
  )
}
