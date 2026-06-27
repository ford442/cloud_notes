import { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';
import { motion, AnimatePresence } from 'framer-motion';
import type { CloudItemMeta, Note } from '../services/api';
import { SemanticService } from '../services/semantic';
import { PluginRegistry } from '../services/plugin';
import { db, STORE_NOTES_CONTENT } from '../utils/db';

export interface ActionItem {
  id: string;
  title: string;
  section: string; // "Actions" or "Notes" or "Semantic"
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
  onNewNote?: () => void;
  onSearchOpen?: () => void;
}

// Icons
const NoteIcon = () => (
  <svg width="18" height="18" className="text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
);
const ActionIcon = () => (
  <svg width="18" height="18" className="text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
);

export const CommandPalette = ({ isOpen, onClose, notes, actions, onNavigate, onNewNote, onSearchOpen }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<ActionItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fullNotesContent, setFullNotesContent] = useState<Map<string, Note>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and load content when opened
  useEffect(() => {
    if (isOpen) {
      const loadContents = async () => {
        try {
          const contents = await db.getAll<Note>(STORE_NOTES_CONTENT);
          const map = new Map<string, Note>();
          contents.forEach(n => {
             // In db.getAll, if the wrapper extracts the values, n is the Note.
             // If it returns { key, value }, n is the wrapper.
             // Looking at SearchModal, `const allNotes = await db.getAll<Note>(STORE_NOTES_CONTENT); setNotes(allNotes.map(n => n.value));` implies it returns {value: Note} objects or similar wrapper. Let's handle both cases to be safe.

             const note = (n as any).value || n;
             if (note && note.id) map.set(note.id, note as Note);
          });
          setFullNotesContent(map);
        } catch (e) {
          console.error("Failed to load full note content for command palette", e);
        }
      };
      loadContents();

      setTimeout(() => {
        inputRef.current?.focus();
        setQuery('');
        setSelectedIndex(0);
      }, 50);
    }
  }, [isOpen]);


  // Combine actions and notes into one searchable list
  const allItems = useMemo(() => {
    const noteItems: ActionItem[] = notes.map(note => {
      // Parse description for better display
      const parts = note.description?.split(' ::: ') || [];
      const tags = parts[2] ? parts[2].split(',').filter(Boolean) : [];
      let snippet = tags.length > 0 ? tags.join(', ') : (note.description || '');

      const fullNote = fullNotesContent.get(note.id);
      let contentToIndex = note.description || '';

      if (fullNote && fullNote.content) {
          contentToIndex = fullNote.content.substring(0, 500); // Index first 500 chars for fuzzy matching

          if (tags.length === 0) {
              snippet = fullNote.content.substring(0, 120).replace(/\n/g, ' ').trim();
              if (snippet.length > 100) snippet = snippet.substring(0, 100) + '...';
          }
      }

      return {
        id: note.id,
        title: note.name,
        section: 'Notes',
        icon: <NoteIcon />,
        perform: () => onNavigate(note.id),
        keywords: [contentToIndex], // Use snippet/content for fuzzy search
        content: fullNote?.content || '', // Keep raw content for highlight matches
        // Store snippet and date for rendering
        snippet: snippet,
        date: note.date
      } as ActionItem & { snippet: string, date: string, content: string, matches?: readonly FuseResultMatch[] };
    });

    const defaultActions: ActionItem[] = [
      {
        id: 'default-new-note',
        title: 'New Note',
        section: 'Commands',
        icon: <span className="text-lg">✍️</span>,
        perform: () => {
          if (onNewNote) onNewNote();
        },
        keywords: ['create', 'make', 'add']
      },
      {
        id: 'default-search',
        title: 'Search in all notes',
        section: 'Commands',
        icon: <span className="text-lg">🔍</span>,
        perform: () => {
          if (onSearchOpen) onSearchOpen();
        },
        keywords: ['find', 'search', 'query']
      },
      {
        id: 'default-show-backlinks',
        title: 'Show Backlinks',
        section: 'Commands',
        icon: <span className="text-lg">🔗</span>,
        perform: () => {
          const panel = document.getElementById('backlinks-panel');
          if (panel) {
            panel.scrollIntoView({ behavior: 'smooth' });
          }
        },
        keywords: ['links', 'references', 'backlinks', 'graph']
      },
      {
        id: 'default-insert-link',
        title: 'Insert Link',
        section: 'Commands',
        icon: <span className="text-lg">🔗</span>,
        perform: () => {
          if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('insert-wiki-link'));
          }
        },
        keywords: ['link', 'wiki', 'insert', 'reference']
      }
    ];

    // Actions come first, then notes
    // Ensure Decrypt Note is always available if any note is selected
    let finalActions = [...defaultActions, ...actions, ...noteItems];
    const currentNote = typeof window !== 'undefined' ? ((window as any).__DEBUG_GET_CURRENT_NOTE ? (window as any).__DEBUG_GET_CURRENT_NOTE() : PluginRegistry.getCurrentNote()) : null;
    if ((currentNote && currentNote.content && currentNote.content.includes('---ENCRYPTED_V1---')) || (typeof window !== 'undefined' && (window as any).__E2E_NOTE_IS_ENCRYPTED)) {
        const decryptAction = actions.find(a => a.id === 'decrypt-note');
        if (decryptAction) {
            finalActions = [decryptAction, ...finalActions.filter(a => a.id !== 'decrypt-note')];
        }
    }
    return finalActions;
  }, [actions, notes, onNavigate, fullNotesContent, onNewNote, onSearchOpen]);

  // Fuse.js setup
  const fuse = useMemo(() => new Fuse(allItems, {
    keys: ['title', 'section', 'keywords', 'content'],
    threshold: 0.3,
    ignoreLocation: true,
    includeMatches: true,
  }), [allItems]);

  // Hybrid Search Effect
  useEffect(() => {
    let isActive = true;

    const sectionOrder = ['Semantic', 'Commands', 'View', 'Editor', 'Actions', 'Notes', 'Integrations'];

    const sortResults = (items: ActionItem[]) => {
      return items.sort((a, b) => {
          const aSection = a.section || 'Other';
          const bSection = b.section || 'Other';

          let aIndex = sectionOrder.indexOf(aSection);
          let bIndex = sectionOrder.indexOf(bSection);

          if (aIndex === -1) aIndex = 99;
          if (bIndex === -1) bIndex = 99;

          if (aIndex !== bIndex) return aIndex - bIndex;
          return 0; // Preserve existing relevance order
      });
    };

    if (!query.trim()) {
      // Wrap in timeout to avoid "setState during render" warning
      const t = setTimeout(() => {
        if (isActive) {
           setResults(sortResults([...allItems]).slice(0, 50));
           setIsSearching(false);
        }
      }, 0);
      return () => {
        isActive = false;
        clearTimeout(t);
      };
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      // 1. Fuzzy Search (Fast, Local)
      const fuzzyResults = fuse.search(query).map(r => r.item);

      // Immediate update with fuzzy results
      if (isActive) {
          setResults(sortResults([...fuzzyResults]).slice(0, 50));
          setSelectedIndex(0);
      }

      // 2. Semantic Search (Async, Smart)
      let semanticItems: ActionItem[] = [];
      try {
        if (!isActive) return;
        const similar = await SemanticService.findSimilar(query, undefined, 5);
        if (!isActive) return;

        semanticItems = similar.map(s => {
          const note = notes.find(n => n.id === s.id);
          if (!note) return null;

          const parts = note.description?.split(' ::: ') || [];
          const tags = parts[2] ? parts[2].split(',').filter(Boolean) : [];
          let snippet = tags.length > 0 ? tags.join(', ') : (note.description || '');
          if (snippet && snippet.length > 50) {
              snippet = snippet.substring(0, 50) + '...';
          }

           return {
            id: note.id,
            title: note.name,
            section: 'Semantic',
            icon: <span className="text-lg">✨</span>,
            perform: () => onNavigate(note.id),
            keywords: [note.description || ''],
            snippet: snippet,
            date: note.date
          } as ActionItem & { snippet: string, date: string };
        }).filter((item): item is (ActionItem & { snippet: string, date: string }) => item !== null) as ActionItem[];
      } catch (e) {
        console.warn('Semantic search failed', e);
      }

      if (!isActive) return;

      // 3. Merge Results
      const seen = new Set(fuzzyResults.map(i => i.id));
      const merged = [...fuzzyResults];

      for (const item of semanticItems) {
        if (!seen.has(item.id)) {
          merged.push(item);
          seen.add(item.id);
        }
      }

      // Sort the final results to group by section (Semantic first, then Commands, then Notes)
      const sortedMerged = sortResults(merged);

      setResults(sortedMerged.slice(0, 50));
      setIsSearching(false);
    }, 300); // 300ms Debounce

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [query, fuse, allItems, notes, onNavigate]);

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

  // Helper to extract a snippet with the matched text highlighted
  const renderSnippet = (match: FuseResultMatch | undefined, fallbackSnippet?: string) => {
    if (!match || !match.value) {
      if (fallbackSnippet) return <span className="truncate opacity-80">{fallbackSnippet}</span>;
      return null;
    }

    // Find the first match indices
    const indices = match.indices[0];
    if (!indices) return <span className="truncate opacity-80">{match.value.substring(0, 100)}...</span>;

    const start = Math.max(0, indices[0] - 40);
    const end = Math.min(match.value.length, indices[1] + 40);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < match.value.length ? '...' : '';

    const before = match.value.substring(start, indices[0]);
    const highlighted = match.value.substring(indices[0], indices[1] + 1);
    const after = match.value.substring(indices[1] + 1, end);

    return (
      <span className="truncate opacity-80">
        {prefix}
        {before}
        <strong className="text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-900/30 px-0.5 rounded">{highlighted}</strong>
        {after}
        {suffix}
      </span>
    );
  };

  return (
    <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} // nice spring curve
          className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border border-slate-200/50 dark:border-slate-700/50 overflow-hidden flex flex-col max-h-[70vh]"
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-slate-200/50 dark:border-slate-700/50 p-5 gap-4 bg-transparent">
            <svg className="w-6 h-6 text-slate-400 dark:text-slate-500 animate-pulse-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-xl font-medium text-slate-900 dark:text-white placeholder:text-slate-400/80 dark:placeholder:text-slate-500/80 outline-none transition-all duration-200"
            placeholder="Type to search notes, commands, or ask AI..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setIsSearching(true);
            }}
          />
          <div className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 shadow-sm uppercase">ESC</div>
        </div>

        {/* Loading Indicator */}
        {isSearching && (
           <div className="px-5 py-2.5 text-xs text-indigo-500 dark:text-indigo-400 font-semibold bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-100/50 dark:border-indigo-800/30 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
               <div className="w-3.5 h-3.5 border-2 border-indigo-500 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
               Scanning semantic network...
           </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {results.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500">
              <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium tracking-wide">No notes found — press <button className="font-bold underline text-indigo-500" onClick={() => { if(onNewNote) { onNewNote(); onClose(); } }}>N</button> to create one</span>
            </div>
          ) : (
            results.map((item, index) => {
              const isSectionStart = index === 0 || item.section !== results[index - 1].section;

              const extendedItem = item as any; // To access our injected properties safely
              const contentMatch = extendedItem.matches?.find((m: FuseResultMatch) => m.key === 'content' || m.key === 'keywords');

              return (
              <div key={`${item.section}-${item.id}`}>
                {isSectionStart && (
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-4 py-2 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                        {item.section || 'Actions'}
                    </div>
                )}
                <button
                  onClick={() => {
                    item.perform();
                    onClose();
                  }}
                  className={`group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all duration-150 ease-out outline-none ${
                    index === selectedIndex
                      ? 'bg-indigo-50/80 dark:bg-indigo-500/10 text-indigo-900 dark:text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-indigo-200 dark:ring-indigo-500/30 scale-[1.01]'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`p-2.5 rounded-lg shadow-sm transition-colors duration-200 ${
                    index === selectedIndex
                      ? 'bg-white dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20'
                      : 'bg-slate-100/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-transparent'
                  }`}>
                    {item.icon || <ActionIcon />}
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className={`text-[15px] truncate transition-all duration-200 ${
                      index === selectedIndex ? 'font-semibold' : 'font-medium'
                    }`}>
                      {item.title}
                    </div>
                    {/* Placeholder badge logic, we can check a 'pinned' tag or subject */}
                    {extendedItem.snippet && extendedItem.snippet.toLowerCase().includes('pinned') && (
                       <span className="text-[9px] font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-sm uppercase">Pinned</span>
                    )}
                    {(extendedItem.snippet || item.section === 'Semantic' || contentMatch) && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-2 mt-0.5">
                          {item.section === 'Semantic' && (
                              <span className="text-amber-500/90 font-bold text-[9px] uppercase tracking-widest border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-sm shrink-0">Semantic Match</span>
                          )}
                          {renderSnippet(contentMatch, extendedItem.snippet)}
                        </div>
                    )}
                  </div>

                  {extendedItem.date && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap opacity-60 ml-2">
                        {new Date(extendedItem.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  )}

                  {index === selectedIndex && (
                     <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400 opacity-70 drop-shadow-sm animate-in fade-in slide-in-from-left-2 duration-300 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  )}
                </button>
              </div>
            )})
          )}
        </div>

          {/* Footer */}
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200/50 dark:border-slate-700/50 p-2.5 px-5 text-xs text-slate-400 dark:text-slate-500 flex justify-between items-center backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 rounded shadow-sm">↑↓</span> to navigate
              </span>
              <span className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 rounded shadow-sm">↵</span> to select
              </span>
          </div>
        </motion.div>
      </div>
    )}
    </AnimatePresence>
  );
};