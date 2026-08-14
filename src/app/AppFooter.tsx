import type { Note } from '../services/api';
import type { EditorMode } from './AppTypes';

interface AppFooterProps {
  isFocusMode: boolean;
  editorMode: EditorMode;
  currentNote: Note;
  setCurrentNote: (note: Note) => void;
  isAiLoading: boolean;
  onAutoTag: () => void;
  onSettingsOpen: () => void;
}

export function AppFooter({
  isFocusMode,
  editorMode,
  currentNote,
  setCurrentNote,
  isAiLoading,
  onAutoTag,
  onSettingsOpen,
}: AppFooterProps) {
  return (
    <div
      className={`${
        isFocusMode || editorMode === 'named-notes' || editorMode === 'music' || editorMode === 'playlists' || editorMode === 'mod-songs' || editorMode === 'presets' || editorMode === 'textures' || editorMode === 'library-browser' || editorMode === 'effects-media'
          ? 'hidden'
          : 'block'
      } bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl transition-colors duration-200`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span className="text-sm font-medium">Tags</span>
          </div>
          <input
            value={currentNote.tags}
            onChange={(e) => setCurrentNote({ ...currentNote, tags: e.target.value })}
            placeholder="Add tags separated by commas..."
            className="bg-transparent text-sm text-slate-600 dark:text-slate-300 flex-1 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:text-slate-900 dark:focus:text-white transition-colors"
          />

          {/* AI Tag Button */}
          <button
            onClick={onAutoTag}
            disabled={isAiLoading || !currentNote.content}
            className="p-2 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 transition-colors disabled:opacity-50"
            title="Auto-Suggest Tags"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <button
            onClick={onSettingsOpen}
            className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Settings"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
