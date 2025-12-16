// src/components/Sidebar.tsx
import type { CloudItemMeta } from '../services/api'

interface SidebarProps {
  notes: CloudItemMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading: boolean;
}

export const Sidebar = ({ notes, selectedId, onSelect, onNew, isLoading }: SidebarProps) => {
  return (
    <div className="w-80 border-r border-gray-800 bg-neutral-950 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-neutral-900">
        <h1 className="font-bold text-gray-100 tracking-widest text-sm flex items-center gap-2">
          <span className="text-indigo-500">☁</span> CLOUD NOTES
        </h1>
        <button
          onClick={onNew}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
        >
          + NEW
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && notes.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs animate-pulse">Connecting to Space...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs">No notes found</div>
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all border group
                ${selectedId === note.id
                  ? 'bg-indigo-900/20 border-indigo-500/50'
                  : 'bg-transparent border-transparent hover:bg-gray-900 hover:border-gray-800'
                }`}
            >
              <div className={`font-medium mb-1 truncate ${selectedId === note.id ? 'text-indigo-300' : 'text-gray-300'}`}>
                {note.name}
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-600 group-hover:text-gray-500">
                <span>{note.author}</span>
                <span className="font-mono">{note.date}</span>
              </div>
              {note.description && (
                <div className="mt-1 text-[10px] text-gray-500 truncate">{note.description}</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Status Footer */}
      <div className="p-2 border-t border-gray-800 text-[10px] text-gray-600 text-center font-mono">
        Connected to 1ink.us Storage
      </div>
    </div>
  )
}
