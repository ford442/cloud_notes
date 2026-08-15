import { lazy, Suspense } from 'react';
import type { Note, CloudItemMeta } from '../services/api';
import type { EditorMode } from './AppTypes';

// Lazy load editors
const BlockEditor = lazy(() => import('../components/BlockEditor').then((m) => ({ default: m.BlockEditor })));
const CanvasEditor = lazy(() => import('../components/CanvasEditor').then((m) => ({ default: m.CanvasEditor })));
const GraphView = lazy(() => import('../components/GraphView').then((m) => ({ default: m.GraphView })));
const FlashcardView = lazy(() => import('../components/FlashcardView').then((m) => ({ default: m.FlashcardView })));
const TaskView = lazy(() => import('../components/TaskView').then((m) => ({ default: m.TaskView })));
const NamedNotesBrowser = lazy(() => import('../components/NamedNotesBrowser').then((m) => ({ default: m.NamedNotesBrowser })));
const MusicLibraryView = lazy(() => import('../components/MusicLibraryView').then((m) => ({ default: m.MusicLibraryView })));
const PlaylistView = lazy(() => import('../components/PlaylistView').then((m) => ({ default: m.PlaylistView })));
const ModSongsView = lazy(() => import('../components/ModSongsView').then((m) => ({ default: m.ModSongsView })));
const PresetsPanel = lazy(() => import('../components/PresetsPanel').then((m) => ({ default: m.PresetsPanel })));
const TexturesPanel = lazy(() => import('../components/TexturesPanel').then((m) => ({ default: m.TexturesPanel })));
const LibraryBrowser = lazy(() => import('../components/LibraryBrowser').then((m) => ({ default: m.LibraryBrowser })));
const EffectsMediaPanel = lazy(() => import('../components/EffectsMediaPanel').then((m) => ({ default: m.EffectsMediaPanel })));

import { Editor } from '../components/Editor';
import { RelatedNotes } from '../components/RelatedNotes';
import { Backlinks } from '../components/Backlinks';
import { EditorStatusBar } from '../components/EditorStatusBar';

interface AppEditorsProps {
  isFocusMode: boolean;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  currentNote: Note;
  setCurrentNote: (note: Note) => void;
  selectedId: string | null;
  notes: CloudItemMeta[];
  onSelectNote: (id: string) => void;
  theme: 'light' | 'dark';
  isAiLoading: boolean;
  aiStatus: string;
  lastRestoreTs: number;
  statsSummary: string;
  onExitFocusMode: () => void;
}

export function AppEditors({
  isFocusMode,
  editorMode,
  setEditorMode,
  currentNote,
  setCurrentNote,
  selectedId,
  notes,
  onSelectNote,
  theme,
  isAiLoading,
  aiStatus,
  lastRestoreTs,
  statsSummary,
  onExitFocusMode,
}: AppEditorsProps) {
  return (
    <>
      {/* Focus Mode Overlay Controls */}
      {isFocusMode && (
        <div className="absolute bottom-6 right-6 z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full shadow-lg text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-3">
            <span className="font-mono">{statsSummary}</span>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"></div>
            <button
              onClick={onExitFocusMode}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Exit Focus
            </button>
          </div>
        </div>
      )}

      {/* Editor Card */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isFocusMode
            ? 'max-w-4xl mx-auto w-full bg-transparent'
            : 'bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden'
        }`}
      >
        <div className="flex-1 relative min-h-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            }
          >
            {editorMode === 'graph' ? (
              <GraphView
                notes={notes}
                currentId={selectedId}
                onNodeClick={(id) => {
                  onSelectNote(id);
                  setEditorMode('rich');
                }}
                theme={theme}
              />
            ) : editorMode === 'canvas' ? (
              <CanvasEditor
                key={selectedId || 'new'}
                initialData={currentNote.content}
                onChange={(val) => setCurrentNote({ ...currentNote, content: val })}
                theme={theme}
              />
            ) : editorMode === 'flashcards' ? (
              <FlashcardView notes={notes} onClose={() => setEditorMode('rich')} />
            ) : editorMode === 'tasks' ? (
              <TaskView
                notes={notes}
                onClose={() => setEditorMode('rich')}
                onNavigate={(id) => {
                  onSelectNote(id);
                  setEditorMode('rich');
                }}
              />
            ) : editorMode === 'named-notes' ? (
              <NamedNotesBrowser />
            ) : editorMode === 'music' || editorMode === 'playlists' || editorMode === 'mod-songs' ? (
              <div className="h-full flex flex-col">
                <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <button
                    onClick={() => setEditorMode('music')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      editorMode === 'music'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Library
                  </button>
                  <button
                    onClick={() => setEditorMode('playlists')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      editorMode === 'playlists'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Playlists
                  </button>
                  <button
                    onClick={() => setEditorMode('mod-songs')}
                    className={`px-4 py-2 font-medium transition-colors ${
                      editorMode === 'mod-songs'
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    MOD Songs
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {editorMode === 'music' ? (
                    <MusicLibraryView onClose={() => setEditorMode('rich')} />
                  ) : editorMode === 'playlists' ? (
                    <PlaylistView onClose={() => setEditorMode('rich')} />
                  ) : (
                    <ModSongsView onClose={() => setEditorMode('rich')} />
                  )}
                </div>
              </div>
            ) : editorMode === 'presets' ? (
              <PresetsPanel onClose={() => setEditorMode('rich')} />
            ) : editorMode === 'textures' ? (
              <TexturesPanel onClose={() => setEditorMode('rich')} />
            ) : editorMode === 'library-browser' ? (
              <LibraryBrowser onClose={() => setEditorMode('rich')} />
            ) : editorMode === 'effects-media' ? (
              <EffectsMediaPanel onClose={() => setEditorMode('rich')} />
            ) : editorMode === 'simple' ? (
              <Editor value={currentNote.content} onChange={(val) => setCurrentNote({ ...currentNote, content: val })} />
            ) : (
              <BlockEditor
                key={selectedId || 'new'}
                noteId={selectedId || 'draft'}
                value={currentNote.content}
                onChange={(val) => setCurrentNote({ ...currentNote, content: val })}
                availableNotes={notes}
                onNavigate={onSelectNote}
                lastExternalUpdate={lastRestoreTs}
              />
            )}
          </Suspense>

          {isAiLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-blue-500 dark:text-blue-400 font-medium">{aiStatus || 'AI is thinking...'}</div>
              </div>
            </div>
          )}
        </div>

        {!isFocusMode && editorMode !== 'graph' && editorMode !== 'canvas' && (
          <>
            <RelatedNotes notes={notes} currentId={selectedId} content={currentNote.content} onNavigate={onSelectNote} />
            <div id="backlinks-panel">
              <Backlinks notes={notes} currentId={selectedId} onNavigate={onSelectNote} />
            </div>
          </>
        )}

        {(editorMode === 'simple' || editorMode === 'rich') && !isFocusMode && <EditorStatusBar content={currentNote.content || ''} />}
      </div>
    </>
  );
}
