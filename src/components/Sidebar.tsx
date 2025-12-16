import { useState, useMemo } from 'react'
import { CloudItemMeta } from '../services/api'

interface SidebarProps {
  notes: CloudItemMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
}

// Helper to parse the packed description
const parseMeta = (desc: string) => {
  if (!desc) return { subject: 'General', section: 'Notes' };
  const parts = desc.split(' ::: ');
  // Handle legacy notes that might just have tags
  if (parts.length < 2) return { subject: 'General', section: 'Notes' };
  return { subject: parts[0] || 'General', section: parts[1] || 'Notes' };
};

export const Sidebar = ({ notes, selectedId, onSelect, onNew, isLoading }: SidebarProps) => {
  // Collapsed state tracking
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSubject = (sub: string) => setCollapsedSubjects(p => ({...p, [sub]: !p[sub]}));
  const toggleSection = (sec: string) => setCollapsedSections(p => ({...p, [sec]: !p[sec]}));

  // Build Tree Structure efficiently
  const tree = useMemo(() => {
    const structure: Record<string, Record<string, CloudItemMeta[]>> = {};
    
    notes.forEach(note => {
      const { subject, section } = parseMeta(note.description);
      if (!structure[subject]) structure[subject] = {};
      if (!structure[subject][section]) structure[subject][section] = [];
      structure[subject][section].push(note);
    });
    
    // Sort keys for consistent display
    const sortedSubjects = Object.keys(structure).sort();
    const sortedTree: typeof structure = {};
    
    sortedSubjects.forEach(sub => {
      sortedTree[sub] = {};
      Object.keys(structure[sub]).sort().forEach(sec => {
        sortedTree[sub][sec] = structure[sub][sec];
      });
    });

    return sortedTree;
  }, [notes]);

  return (
    <div className="w-80 border-r border-gray-800 bg-[#0f0f11] flex flex-col h-full shrink-0 select-none">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#131315]">
        <h1 className="font-bold text-gray-200 text-sm tracking-widest flex items-center gap-2">
          <span className="text-cyan-500">❖</span> KNOWLEDGE
        </h1>
        <button 
          onClick={onNew}
          className="text-[10px] font-bold bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-400 border border-cyan-800/50 px-3 py-1.5 rounded transition-all"
        >
          + NEW NOTE
        </button>
      </div>

      {/* Tree List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs animate-pulse">Syncing...</div>
        ) : (
          Object.entries(tree).map(([subject, sections]) => (
            <div key={subject} className="mb-2">
              {/* SUBJECT HEADER */}
              <div 
                onClick={() => toggleSubject(subject)}
                className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer text-gray-400 hover:text-gray-200 transition-colors"
              >
                <span className="text-[10px] transform transition-transform duration-200" style={{ transform: collapsedSubjects[subject] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
                <span className="font-bold text-xs uppercase tracking-wide">{subject}</span>
              </div>

              {!collapsedSubjects[subject] && (
                <div className="ml-2 border-l border-gray-800 pl-2 mt-1 space-y-1">
                  {Object.entries(sections).map(([section, sectionNotes]) => (
                    <div key={section}>
                      {/* SECTION HEADER */}
                      <div 
                        onClick={() => toggleSection(`${subject}-${section}`)}
                        className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded cursor-pointer text-gray-500 hover:text-gray-300"
                      >
                        <span className="text-[9px] transform transition-transform duration-200" style={{ transform: collapsedSections[`${subject}-${section}`] ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                          ▼
                        </span>
                        <span className="text-xs font-medium">{section}</span>
                        <span className="text-[9px] bg-gray-800 px-1 rounded-full text-gray-500">{sectionNotes.length}</span>
                      </div>

                      {/* NOTES LIST */}
                      {!collapsedSections[`${subject}-${section}`] && (
                        <div className="ml-4 space-y-0.5">
                          {sectionNotes.map(note => (
                            <div
                              key={note.id}
                              onClick={() => onSelect(note.id)}
                              className={`
                                group px-3 py-2 rounded text-sm cursor-pointer transition-all border-l-2
                                ${selectedId === note.id 
                                  ? 'bg-cyan-900/10 border-cyan-500 text-cyan-100' 
                                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                                }
                              `}
                            >
                              <div className="truncate">{note.name}</div>
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
      
      {/* Footer */}
      <div className="p-3 border-t border-gray-800 bg-[#0a0a0c] text-[10px] text-gray-600 flex justify-between">
        <span>{notes.length} Notes</span>
        <span>Synced</span>
      </div>
    </div>
  )
}
