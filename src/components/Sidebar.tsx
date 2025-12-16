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
  <svg className="w-3 h-3 text-cyan-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
)
const SectionIcon = () => (
  <svg className="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
)
const NoteIcon = () => (
  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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
    <div className="w-80 border-r border-gray-800 bg-[#0f0f11] flex flex-col h-full shrink-0 select-none text-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#131315]">
        <h1 className="font-bold text-gray-200 text-xs tracking-widest flex items-center gap-2">
          <span className="text-cyan-500 text-lg">❖</span> KNOWLEDGE
        </h1>
        <button 
          onClick={onNew}
          className="text-[10px] font-bold bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 px-3 py-1.5 rounded transition-all"
        >
          + NOTE
        </button>
      </div>

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs animate-pulse">Syncing...</div>
        ) : (
          Object.entries(tree).map(([subject, sections]) => (
            <div key={subject} className="mb-2">
              
              {/* SUBJECT (Root) */}
              <div 
                onClick={() => toggle(subject)}
                className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer text-gray-300 transition-colors group"
              >
                <span className={`text-[10px] text-gray-500 transition-transform ${collapsed[subject] ? '-rotate-90' : ''}`}>▼</span>
                <FolderIcon />
                <span className="font-bold text-xs uppercase tracking-wide group-hover:text-white">{subject}</span>
              </div>

              {!collapsed[subject] && (
                <div className="ml-2 border-l border-gray-800 pl-2 mt-1 space-y-1">
                  {Object.entries(sections).map(([section, sectionNotes]) => (
                    <div key={section}>
                      
                      {/* SECTION (Sub-folder) */}
                      <div 
                        onClick={() => toggle(`${subject}-${section}`)}
                        className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer text-gray-400 hover:text-gray-200"
                      >
                        <span className={`text-[9px] text-gray-600 transition-transform ${collapsed[`${subject}-${section}`] ? '-rotate-90' : ''}`}>▼</span>
                        <SectionIcon />
                        <span className="text-xs font-medium">{section}</span>
                        <span className="text-[9px] bg-gray-800 px-1.5 py-0.5 rounded-full text-gray-500">{sectionNotes.length}</span>
                      </div>

                      {/* NOTES (Leaf) */}
                      {!collapsed[`${subject}-${section}`] && (
                        <div className="ml-5 space-y-0.5 border-l border-gray-800/50 pl-1">
                          {sectionNotes.map(note => (
                            <div
                              key={note.id}
                              onClick={() => onSelect(note.id)}
                              className={`
                                group flex items-center gap-2 px-3 py-1.5 rounded text-xs cursor-pointer transition-all relative
                                ${selectedId === note.id 
                                  ? 'bg-cyan-900/20 text-cyan-200' 
                                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }
                              `}
                            >
                              <NoteIcon />
                              <div className="truncate">{note.name}</div>
                              {selectedId === note.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-cyan-500 rounded-r"></div>}
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
      <div className="p-3 border-t border-gray-800 bg-[#0a0a0c] text-[10px] text-gray-600 flex justify-between font-mono">
        <span>{notes.length} ITEMS</span>
        <span className="text-green-900">● SYNCED</span>
      </div>
    </div>
  )
}
