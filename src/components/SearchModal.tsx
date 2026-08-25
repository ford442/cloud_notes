import { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';
import { db, STORE_NOTES_CONTENT } from '../utils/db';
import type { Note } from '../services/api';
import { SemanticService } from '../services/semantic';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

interface SearchResult {
  item: Note;
  matches?: readonly FuseResultMatch[];
  isSemantic?: boolean;
}

export const SearchModal = ({ isOpen, onClose, onNavigate }: SearchModalProps) => {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all notes from local DB when opened
  useEffect(() => {
    if (isOpen) {
      const loadNotes = async () => {
        setIsLoading(true);
        try {
          const allNotes = await db.getAll<Note>(STORE_NOTES_CONTENT);
          setNotes(allNotes.map(n => n.value));
        } catch (e) {
          console.error('Failed to load notes for search', e);
        } finally {
          setIsLoading(false);
        }
      };
      loadNotes();

      setTimeout(() => {
        inputRef.current?.focus();
        setQuery('');
        setSemanticResults([]);
        setSelectedIndex(0);
      }, 50);
    }
  }, [isOpen]);

  // Set up Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(notes, {
      keys: ['title', 'content'],
      includeMatches: true,
      threshold: 0.3,
      ignoreLocation: true,
    });
  }, [notes]);

  const fuzzyResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 20);
  }, [query, fuse]);

  useEffect(() => {
    let isActive = true;
    if (!query.trim()) {
      setSemanticResults([]);
      setIsSearchingSemantic(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSemantic(true);
      try {
        const similar = await SemanticService.findSimilar(query, undefined, 5);
        if (!isActive) return;

        const fuzzyIds = new Set(fuzzyResults.map(r => r.item.id));

        const newSemanticResults = similar
          .filter(s => !fuzzyIds.has(s.id))
          .map(s => {
             const note = notes.find(n => n.id === s.id);
             if (!note) return null;
             return {
               item: note,
               isSemantic: true
             } as SearchResult;
          })
          .filter((s): s is SearchResult => s !== null);

        setSemanticResults(newSemanticResults);
      } catch (e) {
        console.error('Semantic search failed in SearchModal', e);
      } finally {
        if (isActive) {
           setIsSearchingSemantic(false);
        }
      }
    }, 500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [query, notes, fuzzyResults]);

  const results = useMemo(() => {
    return [...fuzzyResults, ...semanticResults];
  }, [fuzzyResults, semanticResults]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (results.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % (results.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          const id = results[selectedIndex].item.id;
          if (id) {
             onNavigate(id);
             onClose();
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, onNavigate]);

  if (!isOpen) return null;

  // Helper to extract a snippet with the matched text highlighted
  const renderSnippet = (match: FuseResultMatch | undefined) => {
    if (!match || !match.value) return null;

    // Find the first match indices
    const indices = match.indices[0];
    if (!indices) return <span className="truncate">{match.value.substring(0, 100)}...</span>;

    const start = Math.max(0, indices[0] - 40);
    const end = Math.min(match.value.length, indices[1] + 40);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < match.value.length ? '...' : '';

    const before = match.value.substring(start, indices[0]);
    const highlighted = match.value.substring(indices[0], indices[1] + 1);
    const after = match.value.substring(indices[1] + 1, end);

    return (
      <span className="text-sm text-slate-500 dark:text-slate-400 block truncate">
        {prefix}
        {before}
        <strong className="text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/30 px-0.5 rounded">{highlighted}</strong>
        {after}
        {suffix}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Search Input */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-700 p-4 gap-3">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-lg text-slate-800 dark:text-white placeholder:text-slate-400 outline-none"
            placeholder="Search inside all notes..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {(isLoading || isSearchingSemantic) && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          )}
          <div className="text-xs font-medium text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">ESC</div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {!query.trim() ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
               <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               Search through the full content of your notes
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No results found for "{query}"
            </div>
          ) : (
            results.map((result, index) => {
               // Find the content match to show as a snippet, fallback to title match
               const contentMatch = result.matches?.find(m => m.key === 'content');
               const titleMatch = result.matches?.find(m => m.key === 'title');

               return (
                  <button
                    key={result.item.id}
                    onClick={() => {
                      if (result.item.id) {
                         onNavigate(result.item.id);
                         onClose();
                      }
                    }}
                    className={`w-full flex flex-col gap-1 px-4 py-3 rounded-lg text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-100/50 dark:bg-blue-900/40 border border-blue-200/50 dark:border-blue-700/50'
                        : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                        <div className={`font-semibold ${index === selectedIndex ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'} flex items-center gap-2`}>
                           {result.item.title || 'Untitled Note'}
                           {result.isSemantic ? (
                             <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">✨ Semantic Match</span>
                           ) : (
                             <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800/50">🎯 Exact Match</span>
                           )}
                        </div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                           {result.item.subject} / {result.item.section}
                        </div>
                    </div>

                    {result.isSemantic && !contentMatch && !titleMatch ? (
                      <span className="text-sm text-slate-500 dark:text-slate-400 block truncate">
                        {result.item.content.substring(0, 100)}...
                      </span>
                    ) : contentMatch ? renderSnippet(contentMatch) : titleMatch ? renderSnippet(titleMatch) : null}
                  </button>
               );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 p-2 px-4 text-xs text-slate-400 flex justify-between items-center">
            <span>
                <span className="font-semibold text-slate-500 dark:text-slate-300">↑↓</span> to navigate
            </span>
            <span>
                <span className="font-semibold text-slate-500 dark:text-slate-300">↵</span> to open note
            </span>
        </div>
      </div>
    </div>
  );
};
