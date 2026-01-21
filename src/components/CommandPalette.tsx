import { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { CloudItemMeta } from '../services/api';

export interface ActionItem {
  id: string;
  title: string;
  section: string; // "Actions" or "Notes"
  icon?: React.ReactNode;
  perform: () => void;
  keywords?: string[]; // Extra keywords for Fuse
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: CloudItemMeta[];
  actions: ActionItem[];
  onNavigate: (id: string) => void;
}

// Icons
const NoteIcon = () => (
  <svg width="18" height="18" className="text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const ActionIcon = () => (
  <svg width="18" height="18" className="text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
);

export const CommandPalette = ({ isOpen, onClose, notes, actions, onNavigate }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Use setTimeout to push state updates to next tick to avoid "cascading render" warning?
      // Actually, standard practice for "reset on open" is to use a key or just accept the cascade.
      // But linter complains.
      setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
      }, 0);
    }
  }, [isOpen]);


  // Combine actions and notes into one searchable list
  const allItems = useMemo(() => {
    const noteItems: ActionItem[] = notes.map(note => ({
      id: note.id,
      title: note.name,
      section: 'Notes',
      icon: <NoteIcon />,
      perform: () => onNavigate(note.id),
      keywords: [note.description] // Search in description too
    }));

    // Actions come first, then notes
    return [...actions, ...noteItems];
  }, [actions, notes, onNavigate]);

  // Fuse.js setup
  const fuse = useMemo(() => new Fuse(allItems, {
    keys: ['title', 'section', 'keywords'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [allItems]);

  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 50); // Show recent/all if empty
    return fuse.search(query).map(r => r.item).slice(0, 50);
  }, [query, allItems, fuse]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].perform();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Search Input */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-700 p-4 gap-3">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-lg text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <div className="text-xs font-medium text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">ESC</div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No results found.
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.section}-${item.id}`}
                onClick={() => {
                  item.perform();
                  onClose();
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className={`p-2 rounded-md ${
                  index === selectedIndex
                    ? 'bg-white dark:bg-blue-800/30 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
                }`}>
                  {item.icon || <ActionIcon />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {item.section === 'Notes' ? 'Jump to Note' : 'Command'}
                  </div>
                </div>

                {index === selectedIndex && (
                   <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 p-2 px-4 text-xs text-slate-400 flex justify-between items-center">
            <span>
                <span className="font-semibold text-slate-500 dark:text-slate-300">↑↓</span> to navigate
            </span>
            <span>
                <span className="font-semibold text-slate-500 dark:text-slate-300">↵</span> to select
            </span>
        </div>
      </div>
    </div>
  );
};
