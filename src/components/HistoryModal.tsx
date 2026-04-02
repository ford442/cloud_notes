import { useState, useEffect } from 'react';
import { db, STORE_HISTORY } from '../utils/db';
import { PluginRegistry } from '../services/plugin';
import { diffWords, diffLines } from 'diff';
import type { Change } from 'diff';

interface HistoryEntry {
  timestamp: number;
  content: string;
  author: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onRestore: (content: string) => void;
}

export const HistoryModal = ({ isOpen, onClose, noteId, onRestore }: HistoryModalProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<HistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [diffMode, setDiffMode] = useState<'words' | 'lines' | 'none'>('words');

  useEffect(() => {
    if (isOpen && noteId) {
      setIsLoading(true);
      db.get<HistoryEntry[]>(STORE_HISTORY, noteId)
        .then((data) => {
          const sorted = (data || []).sort((a, b) => b.timestamp - a.timestamp);
          setHistory(sorted);
          if (sorted.length > 0) {
            setSelectedVersion(sorted[0]);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, noteId]);

  const handleRestore = async () => {
    if (selectedVersion) {
      if (await PluginRegistry.confirm(`Are you sure you want to restore the version from ${new Date(selectedVersion.timestamp).toLocaleString()}? Unsaved changes will be lost.`)) {
        onRestore(selectedVersion.content);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[80vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🕰️</span> Note History
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select a version to preview and restore.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0">

          {/* Sidebar: List of Versions */}
          <div className="w-1/3 border-r border-slate-100 dark:border-slate-700 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <div className="text-4xl mb-2">📜</div>
                <p>No history available for this note.</p>
                <p className="text-xs mt-2">History is saved automatically when you edit.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((entry) => (
                  <button
                    key={entry.timestamp}
                    onClick={() => setSelectedVersion(entry)}
                    className={`w-full text-left p-4 transition-all hover:bg-slate-100 dark:hover:bg-slate-700/50 flex flex-col gap-1 ${
                      selectedVersion?.timestamp === entry.timestamp
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                      {new Date(entry.timestamp).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{entry.author || 'Unknown'}</span>
                      <span>{entry.content.length} chars</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main: Preview */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 min-w-0">
            {selectedVersion ? (
              <>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-500">
                      Previewing version from <strong>{new Date(selectedVersion.timestamp).toLocaleString()}</strong>
                    </div>
                    <div className="flex bg-slate-200/50 dark:bg-slate-700/50 rounded-lg p-1 text-xs font-medium">
                      <button
                        onClick={() => setDiffMode('none')}
                        className={`px-3 py-1 rounded-md transition-colors ${diffMode === 'none' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Raw
                      </button>
                      <button
                        onClick={() => setDiffMode('words')}
                        className={`px-3 py-1 rounded-md transition-colors ${diffMode === 'words' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Word Diff
                      </button>
                      <button
                        onClick={() => setDiffMode('lines')}
                        className={`px-3 py-1 rounded-md transition-colors ${diffMode === 'lines' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        Line Diff
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleRestore}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Restore This Version
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-8 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {diffMode === 'none' ? (
                     selectedVersion.content
                  ) : (
                    (() => {
                      // Find the previous version to diff against.
                      // history array is sorted newest first.
                      const currentIndex = history.findIndex(h => h.timestamp === selectedVersion.timestamp);
                      const previousVersion = history[currentIndex + 1];

                      if (!previousVersion) {
                        return <span className="text-green-600 dark:text-green-400">{selectedVersion.content}</span>; // All new if no previous
                      }

                      const changes = diffMode === 'lines'
                          ? diffLines(previousVersion.content, selectedVersion.content)
                          : diffWords(previousVersion.content, selectedVersion.content);

                      return (
                        <>
                          {changes.map((part: Change, index: number) => {
                            const colorClass = part.added
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : part.removed
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 line-through'
                              : 'text-slate-600 dark:text-slate-300';
                            return (
                              <span key={index} className={`transition-colors duration-150 rounded-sm px-0.5 ${colorClass}`}>
                                {part.value}
                              </span>
                            );
                          })}
                        </>
                      );
                    })()
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                Select a version to preview
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
