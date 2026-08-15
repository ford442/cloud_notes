import type { Note } from '../services/api';
import type { EditorMode } from './AppTypes';

interface AppHeaderProps {
  isFocusMode: boolean;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  currentNote: Note;
  setCurrentNote: (note: Note) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isLoading: boolean;
  isSaving: boolean;
  isAiLoading: boolean;
  autoSaveStatus: 'saving' | 'saved' | '';
  selectedId: string | null;
  onSave: () => void;
  onDelete: () => void;
  onSummarize: () => void;
  onOpenHistory: () => void;
}

export function AppHeader({
  isFocusMode,
  editorMode,
  setEditorMode,
  currentNote,
  setCurrentNote,
  theme,
  setTheme,
  isLoading,
  isSaving,
  isAiLoading,
  autoSaveStatus,
  selectedId,
  onSave,
  onDelete,
  onSummarize,
  onOpenHistory,
}: AppHeaderProps) {
  return (
    <div
      className={`${
        isFocusMode || editorMode === 'named-notes' || editorMode === 'music' || editorMode === 'playlists' || editorMode === 'mod-songs' || editorMode === 'presets' || editorMode === 'textures' || editorMode === 'library-browser' || editorMode === 'effects-media'
          ? 'hidden'
          : 'block'
      } bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl transition-colors duration-200 z-10`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-4 min-w-[300px]">
          <input
            value={currentNote.title}
            onChange={(e) => setCurrentNote({ ...currentNote, title: e.target.value })}
            placeholder="Note Title..."
            className="text-3xl font-extrabold tracking-tight bg-transparent outline-none w-full placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
          />
          <div className="flex gap-2">
            <input
              value={currentNote.subject}
              onChange={(e) => setCurrentNote({ ...currentNote, subject: e.target.value })}
              placeholder="Subject"
              className="bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl text-xs font-medium w-24 outline-none transition-colors text-center focus:ring-2 focus:ring-blue-500/50"
            />
            <input
              value={currentNote.section}
              onChange={(e) => setCurrentNote({ ...currentNote, section: e.target.value })}
              placeholder="Section"
              className="bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl text-xs font-medium w-24 outline-none transition-colors text-center focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Actions */}
          <button
            onClick={onSummarize}
            disabled={isAiLoading || !currentNote.content}
            className="p-2 text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-30"
            title="Summarize Note"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>

          <button
            onClick={onOpenHistory}
            disabled={!selectedId}
            className="p-2 text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-30"
            title="View History"
          >
            <span className="text-xl">🕰️</span>
          </button>

          {/* Editor Mode Toggle */}
          <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-xl flex text-xs font-medium shadow-inner">
            <button
              onClick={() => setEditorMode('simple')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'simple'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setEditorMode('rich')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'rich'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Rich
            </button>
            <button
              onClick={() => setEditorMode('graph')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'graph'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setEditorMode('canvas')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'canvas'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Canvas
            </button>
            <button
              onClick={() => setEditorMode('tasks')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'tasks'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Tasks
            </button>
            <button
              onClick={() => setEditorMode('named-notes')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'named-notes'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Cloud Notes
            </button>
            <button
              onClick={() => setEditorMode('music')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'music'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Music
            </button>
            <button
              onClick={() => setEditorMode('presets')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'presets'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🎨 Presets
            </button>
            <button
              onClick={() => setEditorMode('textures')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'textures'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🖼️ Textures
            </button>
            <button
              onClick={() => setEditorMode('effects-media')}
              className={`px-3 py-2 rounded-lg transition-all ${
                editorMode === 'effects-media'
                  ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              🎬 Effects
            </button>
          </div>

          {/* Theme Toggle */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-3 outline-none cursor-pointer transition-colors"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium animate-pulse bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Syncing...
              </div>
            )}

            <button
              onClick={onDelete}
              disabled={isSaving || !selectedId}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
            >
              Delete
            </button>

            <div className="flex items-center gap-3">
              {autoSaveStatus && (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 animate-in fade-in transition-opacity">
                  {autoSaveStatus === 'saving' ? 'Saving...' : 'Saved'}
                </span>
              )}
              <button
                onClick={onSave}
                disabled={isSaving}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
                  isSaving
                    ? 'bg-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-500/25'
                }`}
              >
                {isSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  'Save Note'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
