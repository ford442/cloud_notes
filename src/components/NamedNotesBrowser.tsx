// src/components/NamedNotesBrowser.tsx

import { useState, useEffect, useCallback } from 'react';
import { StorageService } from '../services/api';

const RAIN_EDIT_URL = 'https://rain-edit.noahcohn.com'; // configurable

interface NamedNote {
  name: string;
  updated_at: string;
  size: number;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function NamedNotesBrowser() {
  const [notes, setNotes] = useState<NamedNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Loaded note preview state: maps note name → content string (or null while loading)
  const [loadedContents, setLoadedContents] = useState<Record<string, string | null>>({});
  const [loadingNames, setLoadingNames] = useState<Set<string>>(new Set());

  const refreshList = useCallback(async () => {
    setIsLoading(true);
    const list = await StorageService.listNamedNotes();
    setNotes(list);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleSave = async () => {
    if (!newName.trim()) {
      setSaveStatus('Note name is required.');
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    const result = await StorageService.saveNamedNote(newName.trim(), newContent);
    if (result) {
      setSaveStatus(`Saved "${result.name}" (${formatSize(result.size)})`);
      setNewName('');
      setNewContent('');
      await refreshList();
    } else {
      setSaveStatus('Save failed. Please try again.');
    }
    setIsSaving(false);
  };

  const handleLoad = async (name: string) => {
    if (loadedContents[name] !== undefined) {
      // Toggle off
      setLoadedContents(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      return;
    }
    setLoadingNames(prev => new Set(prev).add(name));
    const result = await StorageService.loadNamedNote(name);
    setLoadingNames(prev => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    setLoadedContents(prev => ({ ...prev, [name]: result ? result.content : null }));
  };

  const handleDelete = async (name: string) => {
    const ok = await StorageService.deleteNamedNote(name);
    if (ok) {
      setNotes(prev => prev.filter(n => n.name !== name));
      setLoadedContents(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-6">

      {/* ── New Named Note Form ──────────────────────────────────────── */}
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-md flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">New Named Note</h2>

        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Note name (e.g. my-note)"
          className="bg-slate-100/80 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
        />

        <textarea
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          placeholder="Note content..."
          rows={4}
          className="bg-slate-100/80 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y transition-colors"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          {saveStatus && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{saveStatus}</span>
          )}
        </div>
      </div>

      {/* ── Notes List ──────────────────────────────────────────────── */}
      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Named Notes</h2>
          <button
            onClick={refreshList}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading…' : '↺ Refresh'}
          </button>
        </div>

        {isLoading && notes.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && notes.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
            No named notes found. Create one above!
          </p>
        )}

        {notes.map(note => (
          <div key={note.name} className="flex flex-col gap-2 border border-slate-200/60 dark:border-slate-700/60 rounded-xl p-4 bg-white/40 dark:bg-slate-900/40">
            {/* Note header row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{note.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {formatRelativeTime(note.updated_at)} · {formatSize(note.size)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Open in rain_edit */}
                <a
                  href={`${RAIN_EDIT_URL}/?note=${encodeURIComponent(note.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-sm transition-all"
                  title={`Open "${note.name}" in rain_edit`}
                >
                  🌧️ Open in rain_edit
                </a>

                {/* Load here */}
                <button
                  onClick={() => handleLoad(note.name)}
                  disabled={loadingNames.has(note.name)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
                >
                  {loadingNames.has(note.name)
                    ? '…'
                    : loadedContents[note.name] !== undefined
                    ? 'Hide'
                    : 'Load here'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(note.name)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                  title={`Delete "${note.name}"`}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Loaded content preview */}
            {loadedContents[note.name] !== undefined && (
              <textarea
                readOnly
                value={loadedContents[note.name] ?? '(Failed to load)'}
                rows={6}
                className="w-full mt-1 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 resize-y outline-none"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
