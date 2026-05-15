import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { StorageService } from './services/api'
import { AIService } from './services/ai'
import type { Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'

// Lazy load heavy components
const BlockEditor = lazy(() => import('./components/BlockEditor').then(m => ({ default: m.BlockEditor })))
const CanvasEditor = lazy(() => import('./components/CanvasEditor').then(m => ({ default: m.CanvasEditor })))
const GraphView = lazy(() => import('./components/GraphView').then(m => ({ default: m.GraphView })))
const FlashcardView = lazy(() => import('./components/FlashcardView').then(m => ({ default: m.FlashcardView })))
const TaskView = lazy(() => import('./components/TaskView').then(m => ({ default: m.TaskView })))
const NamedNotesBrowser = lazy(() => import('./components/NamedNotesBrowser').then(m => ({ default: m.NamedNotesBrowser })))
const MusicLibraryView = lazy(() => import('./components/MusicLibraryView').then(m => ({ default: m.MusicLibraryView })))
const PlaylistView = lazy(() => import('./components/PlaylistView').then(m => ({ default: m.PlaylistView })))
const ModSongsView = lazy(() => import('./components/ModSongsView').then(m => ({ default: m.ModSongsView })))
const PresetsPanel = lazy(() => import('./components/PresetsPanel').then(m => ({ default: m.PresetsPanel })))

import { Backlinks } from './components/Backlinks'
import { RelatedNotes } from './components/RelatedNotes'
import { CommandPalette } from './components/CommandPalette'
import { SearchModal } from './components/SearchModal'
import { ChatModal } from './components/ChatModal'
import { PluginRegistry } from './services/plugin'
import { CorePlugins } from './plugins/core'
import { MusicPlugin } from './plugins/music'
import { ToastProvider, useToast } from './components/Toast'
import { SemanticService } from './services/semantic'
import { SettingsModal } from './components/SettingsModal'
import { createPackedDescription } from './utils/metadata'
import { Dialog } from './components/Dialog'
import type { DialogType } from './components/Dialog'
import { db, STORE_HISTORY } from './utils/db'
import { HistoryModal } from './components/HistoryModal'

// Initialize Core Plugins once
PluginRegistry.registerAll(CorePlugins);
PluginRegistry.register(MusicPlugin);

// Wrapper to provide toast context
function AppWrapper() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

function App() {
  const { addToast } = useToast()
  const [notes, setNotes] = useState<CloudItemMeta[]>([])
  const notesRef = useRef(notes)
  notesRef.current = notes

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(selectedId)

  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  
  // Command Palette
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [lastRestoreTs, setLastRestoreTs] = useState(0)

  // Global Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: DialogType;
    message: string;
    defaultValue?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void;
  } | null>(null);

  useEffect(() => {
     PluginRegistry.setDialogHandler((request) => {
         return new Promise((resolve) => {
             setDialogConfig({
                 isOpen: true,
                 type: request.type,
                 message: request.message,
                 defaultValue: request.defaultValue,
                 resolve: (val) => {
                     setDialogConfig(null);
                     resolve(val);
                 }
             });
         });
     });
  }, []);

  // Editor mode state
  const [editorMode, setEditorMode] = useState<'simple' | 'rich' | 'graph' | 'canvas' | 'flashcards' | 'tasks' | 'named-notes' | 'music' | 'playlists' | 'mod-songs' | 'presets'>('rich')

  // Initialize with default Subject/Section
  const [currentNote, setCurrentNote] = useState<Note>({ 
    title: '', content: '', tags: '', subject: 'General', section: 'Inbox' 
  })
  const currentNoteRef = useRef(currentNote)
  currentNoteRef.current = currentNote
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState('')
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('author_name') || 'Anon')
  const authorNameRef = useRef<string>(authorName)

  useEffect(() => {
    selectedIdRef.current = selectedId;
    authorNameRef.current = authorName;
  }, [selectedId, authorName]);

  useEffect(() => { refreshList() }, [])
  useEffect(() => { localStorage.setItem('author_name', authorName) }, [authorName])

  // Update Plugin Context
  useEffect(() => {
    PluginRegistry.setNoteGetter(() => currentNoteRef.current);
    PluginRegistry.setAllNotesGetter(() => notesRef.current);
    PluginRegistry.setNoteUpdater(async (updates) => {
      const currentAuthor = authorNameRef.current;
      const currentSelectedId = selectedIdRef.current;

      const updatedNote = { ...currentNoteRef.current, ...updates, updatedAt: new Date().toISOString() };
      setCurrentNote(updatedNote);

      if (currentSelectedId) {
        const res = await StorageService.updateNote(currentSelectedId, updatedNote, currentAuthor);
        if (res.success) {
          refreshList();
        } else {
          addToast("Failed to update note", "error");
        }
      }
    });
    PluginRegistry.setNavigator((id) => handleSelectNote(id));
    PluginRegistry.setNoteDeleter(async (id: string) => { await handleDelete(id); });
    PluginRegistry.setNoteCreator(async (updates) => {
      const currentAuthor = authorNameRef.current;
      const newNote = {
        title: '', content: '', tags: '', subject: 'General', section: 'Inbox',
        ...updates,
        updatedAt: new Date().toISOString()
      };
      const res = await StorageService.saveNote(newNote, currentAuthor);
      if (res.success && res.id) {
        setSelectedId(res.id);
        setCurrentNote({ ...newNote, id: res.id });
        refreshList();
      } else {
        addToast("Failed to create note", "error");
      }
    });
    PluginRegistry.setModeSetter((mode) => {
       if (['simple', 'rich', 'graph', 'canvas', 'flashcards', 'tasks', 'named-notes', 'music', 'playlists', 'mod-songs', 'presets'].includes(mode)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setEditorMode(mode as any);
       } else {
         console.warn(`Plugin attempted to set invalid mode: ${mode}`);
       }
    });
    PluginRegistry.setFocusModeSetter(setIsFocusMode);
  }, []);

  // Sync Pending Ops on Mount & Online
  useEffect(() => {
    StorageService.syncPending();

    const handleOnline = async () => {
      console.log('App is online, syncing pending ops...');
      await StorageService.syncPending();
      refreshList();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Global Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (((e.metaKey || e.ctrlKey) && e.key === 'K' && e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === 'j')) {
        e.preventDefault()
        setIsChatOpen(prev => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCmdPaletteOpen(prev => !prev)
      }
      // Ctrl+Shift+F or Cmd+Shift+F for Search
      if (e.key === 'F' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const refreshList = async () => {
    setIsLoading(true)

    // 1. Instant Load from Cache
    const cached = await StorageService.getCachedNotes();
    if (cached.length > 0) {
      setNotes(cached);
      setIsLoading(false); // Immediate user feedback
    }

    // 2. Background Sync
    try {
      const fresh = await StorageService.getNotes();
      setNotes(fresh);
    } catch {
      if (cached.length === 0) addToast("Failed to fetch notes", "error");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSelectNote = async (id: string) => {
    setIsLoading(true)
    let loadedFromCache = false;

    try {
      // 1. Try Cache First
      const cached = await StorageService.getCachedNote(id);
      if (cached) {
        setCurrentNote(cached);
        setSelectedId(id);
        setIsLoading(false);
        loadedFromCache = true;
      }

      // 2. Fetch Fresh Content
      const content = await StorageService.getNoteContent(id)

      // Only update if we didn't have cache, or if we want to force update
      // For now, let's always update to ensure freshness, but user won't see a spinner if cached
      setCurrentNote(content)
      setSelectedId(id)
    } catch {
      if (!loadedFromCache) {
        addToast("Failed to load note", "error");
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleNew = () => {
    setSelectedId(null)
    // Keep current subject/section for rapid entry, or reset to defaults
    setCurrentNote({ 
      title: '', content: '', tags: '', 
      subject: 'General', section: 'Inbox' 
    })
  }


  const handleDelete = async (id?: string) => {
    // If it's a click event, `id` might be the event object, so ensure it's a string
    const targetId = typeof id === 'string' ? id : selectedId;
    if (!targetId) return;
    if (!(await PluginRegistry.confirm("Are you sure you want to delete this note?"))) return;

    setIsSaving(true);
    try {
      await StorageService.deleteNote(targetId);
      addToast("Note deleted", "success");
      if (selectedId === targetId) {
        handleNew();
      }
      refreshList();
    } catch (e) {
      addToast("Failed to delete note", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const handleSave = async () => {
    if (!currentNote.title.trim()) return addToast("Title required", "error")
    
    setIsSaving(true)
    
    // Stamp updatedAt so sync comparisons are reliable
    const noteToSave = { ...currentNote, updatedAt: new Date().toISOString() };
    setCurrentNote(noteToSave);
    
    // Check if we are updating an existing note or creating a new one
    // Logic:
    // 1. If we have a selectedId AND the title matches the original title -> Update (PUT)
    // 2. Otherwise (No ID, or Title Changed) -> Create New (POST)

    let isUpdate = false;
    let savedId = '';
    let success = false;

    if (selectedId) {
       const originalNote = notes.find(n => n.id === selectedId);
       // If title matches original name, we update
       if (originalNote && originalNote.name === noteToSave.title) {
           isUpdate = true;
       }
    }

    if (isUpdate && selectedId) {
        // UPDATE EXISTING
        const res = await StorageService.updateNote(selectedId, noteToSave, authorName);
        if (res.success) {
            savedId = selectedId;
            success = true;
            addToast("Note updated successfully", "success")
        }
    } else {
        // CREATE NEW
        const res = await StorageService.saveNote(noteToSave, authorName);
        if (res.success && res.id) {
            savedId = res.id;
            success = true;
            addToast(isUpdate ? "Note saved as copy (title changed)" : "Note created successfully", "success")
        }
    }

    if (success) {
      // Optimistic Update: Update list state immediately
      if (savedId) {
          const packedDesc = createPackedDescription(noteToSave);

          const newItem: CloudItemMeta = {
             id: savedId,
             name: noteToSave.title,
             type: 'note',
             author: authorName,
             date: new Date().toISOString(),
             description: packedDesc
          };

          setNotes(prev => {
              // If updating, replace. If new, add to top.
              // Note: If title changed (Save As), we might want to keep the old one too?
              // Yes, Save As implies a new copy. The old note remains.
              // But 'isUpdate' logic handles this.

              if (isUpdate) {
                  const index = prev.findIndex(n => n.id === savedId);
                  if (index >= 0) {
                      const copy = [...prev];
                      copy[index] = { ...copy[index], ...newItem };
                      return copy;
                  }
                  return prev;
              } else {
                  return [newItem, ...prev];
              }
          });
      }

      // await refreshList() // Removed to prevent overwriting optimistic update with stale API data
      if (savedId) setSelectedId(savedId)

      // Index for Semantic Search (Fire and Forget)
      if (savedId && currentNote.content.length > 30) {
         SemanticService.indexNote(savedId, currentNote.content);
      }

      // Save to History (Fire and Forget)
      if (savedId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          db.get<any[]>(STORE_HISTORY, savedId).then((history) => {
             const newHistory = [...(history || []), {
                 timestamp: Date.now(),
                 content: noteToSave.content,
                 author: authorName
             }].slice(-50); // Keep last 50
             db.set(STORE_HISTORY, savedId, newHistory);
          });
      }
    } else {
      addToast("Save failed", "error")
    }
    setIsSaving(false)
  }

  const handleVpsSync = async (onProgress?: (message: string) => void) => {
    try {
      const res = await StorageService.syncWithVps(onProgress);
      if (res.errors.length > 0) {
        addToast(`Sync completed with ${res.errors.length} errors`, 'error');
      } else {
        addToast(`Synced: ${res.pulled} pulled, ${res.pushed} pushed`, 'success');
      }
      // Refresh sidebar list after sync
      const fresh = await StorageService.getCachedNotes();
      setNotes(fresh);
      return res;
    } catch (e) {
      addToast('Sync failed unexpectedly', 'error');
      console.error(e);
      return { pulled: 0, pushed: 0, errors: ['Unexpected error'] };
    }
  };

  const handleAutoTag = async () => {
    if (!currentNote.content.trim()) return addToast("Write some content first!", "info");

    setIsAiLoading(true);
    setAiStatus('Initializing AI...');
    try {
      const currentTags = currentNote.tags.split(',').map(t => t.trim()).filter(Boolean);
      // Collect all existing tags from all notes to give context
      const allTags = new Set<string>();
      notes.forEach(n => {
        const parts = n.description?.split(' ::: ');
        if (parts && parts[2]) {
          parts[2].split(',').forEach(t => allTags.add(t.trim()));
        }
      });

      const suggested = await AIService.suggestTags(currentNote.content, Array.from(allTags), (msg) => setAiStatus(msg));

      // Merge with existing
      const newTags = Array.from(new Set([...currentTags, ...suggested])).join(', ');
      setCurrentNote(prev => ({ ...prev, tags: newTags }));
      addToast("AI Tagging complete", "success");
    } catch (e) {
      console.error(e);
      addToast("AI Tagging failed", "error");
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  const handleSummarize = async () => {
    if (!currentNote.content.trim()) return addToast("Write some content first!", "info");

    setIsAiLoading(true);
    setAiStatus('Initializing AI...');
    try {
      const summary = await AIService.summarize(currentNote.content, (msg) => setAiStatus(msg));
      // Append summary to content
      const newContent = currentNote.content + '\n\n> **Summary:** ' + summary;
      setCurrentNote(prev => ({ ...prev, content: newContent }));
      addToast("Summary generated", "success");
    } catch (e) {
      console.error(e);
      addToast("AI Summary failed", "error");
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  const handleMoveNote = async (id: string, newSubject: string, newSection: string) => {
    setIsLoading(true);
    try {
      // 1. Find existing meta
      const noteMeta = notes.find(n => n.id === id);
      if (!noteMeta) throw new Error("Note not found");

      // 2. Get Content (Cache or Network)
      let fullNote = await StorageService.getCachedNote(id);
      if (!fullNote) {
         fullNote = await StorageService.getNoteContent(id);
      }

      if (!fullNote) throw new Error("Failed to load note content");

      // 3. Update Metadata
      const updatedNote: Note = {
          ...fullNote,
          subject: newSubject,
          section: newSection
      };

      // 4. Save
      const res = await StorageService.updateNote(id, updatedNote, authorName);

      if (res.success) {
          // 5. Optimistic Update of List
          const packedDesc = createPackedDescription(updatedNote);
          const newItem = { ...noteMeta, description: packedDesc };

          setNotes(prev => prev.map(n => n.id === id ? newItem : n));

          // Update current note if it's the one being moved
          if (currentNote?.id === id) {
              setCurrentNote(updatedNote);
          }

          addToast(`Moved to ${newSubject}/${newSection}`, "success");
      } else {
          throw new Error("Update failed");
      }

    } catch (e) {
        console.error(e);
        addToast("Failed to move note", "error");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRestore = (content: string) => {
    setCurrentNote(prev => ({ ...prev, content }));
    setLastRestoreTs(Date.now());
    addToast("Version restored. Don't forget to save!", "success");
  };

  const wordCount = currentNote.content ? currentNote.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className={`h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
        
        {/* Settings Modal */}
        {isSettingsOpen && (
           <SettingsModal
             isOpen={isSettingsOpen}
             onClose={() => setIsSettingsOpen(false)}
             authorName={authorName}
             setAuthorName={setAuthorName}
             theme={theme}
             setTheme={(t) => setTheme(t as 'light' | 'dark')}
             onVpsSync={handleVpsSync}
           />
        )}

        {/* History Modal */}
        {isHistoryOpen && selectedId && (
            <HistoryModal
              isOpen={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
              noteId={selectedId}
              onRestore={handleRestore}
            />
        )}

        {/* Global Dialog */}
        {dialogConfig && (
            <Dialog
                key={dialogConfig.message + dialogConfig.type}
                isOpen={dialogConfig.isOpen}
                type={dialogConfig.type}
                message={dialogConfig.message}
                defaultValue={dialogConfig.defaultValue}
                onConfirm={(val) => {
                    if (dialogConfig.type === 'confirm') dialogConfig.resolve(true);
                    else if (dialogConfig.type === 'prompt') dialogConfig.resolve(val);
                    else dialogConfig.resolve(undefined); // alert
                }}
                onCancel={() => {
                    if (dialogConfig.type === 'confirm') dialogConfig.resolve(false);
                    else dialogConfig.resolve(null); // prompt or alert
                }}
            />
        )}

        {/* Command Palette */}
        <CommandPalette
          isOpen={isCmdPaletteOpen}
          onClose={() => setIsCmdPaletteOpen(false)}
          notes={notes}
          onNavigate={handleSelectNote}
          actions={PluginRegistry.getActions()}
        />

        {/* Search Modal */}
        <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onNavigate={(id) => {
            setIsChatOpen(false);
            setSelectedId(id);
        }}
      />

      <SearchModal
        isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={handleSelectNote}
        />

        {/* Sidebar */}
        <div className={`${isFocusMode ? 'hidden' : 'block h-full'}`}>
          <Sidebar
            notes={notes}
            selectedId={selectedId}
            onSelect={handleSelectNote}
            onNew={handleNew}
            isLoading={isLoading}
            onMoveNote={handleMoveNote}
            onSearchOpen={() => setIsSearchOpen(true)}
            onVpsSync={handleVpsSync}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full min-w-0 p-4 gap-4 relative transition-all duration-300">

          {/* Focus Mode Overlay Controls */}
          {isFocusMode && (
             <div className="absolute bottom-6 right-6 z-50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
                 <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-full shadow-lg text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-3">
                     <span className="font-mono">{wordCount} words</span>
                     <div className="w-px h-4 bg-slate-300 dark:bg-slate-600"></div>
                     <button
                       onClick={() => setIsFocusMode(false)}
                       className="hover:text-slate-900 dark:hover:text-white transition-colors"
                     >
                        Exit Focus
                     </button>
                 </div>
             </div>
          )}

          {/* Header Card */}
          <div className={`${isFocusMode || editorMode === 'named-notes' || editorMode === 'music' || editorMode === 'playlists' || editorMode === 'mod-songs' || editorMode === 'presets' ? 'hidden' : 'block'} bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl transition-colors duration-200 z-10`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-4 min-w-[300px]">
                 <input
                   value={currentNote.title}
                   onChange={e => setCurrentNote({...currentNote, title: e.target.value})}
                   placeholder="Note Title..."
                   className="text-3xl font-extrabold tracking-tight bg-transparent outline-none w-full placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
                 />
                 <div className="flex gap-2">
                   <input
                     value={currentNote.subject}
                     onChange={e => setCurrentNote({...currentNote, subject: e.target.value})}
                     placeholder="Subject"
                     className="bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl text-xs font-medium w-24 outline-none transition-colors text-center focus:ring-2 focus:ring-blue-500/50"
                   />
                   <input
                     value={currentNote.section}
                     onChange={e => setCurrentNote({...currentNote, section: e.target.value})}
                     placeholder="Section"
                     className="bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl text-xs font-medium w-24 outline-none transition-colors text-center focus:ring-2 focus:ring-blue-500/50"
                   />
                 </div>
              </div>

              <div className="flex items-center gap-3">
                 {/* AI Actions */}
                 <button
                   onClick={handleSummarize}
                   disabled={isAiLoading || !currentNote.content}
                   className="p-2 text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-30"
                   title="Summarize Note"
                 >
                   <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                   </svg>
                 </button>

                 <button
                   onClick={() => setIsHistoryOpen(true)}
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
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'simple' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setEditorMode('rich')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'rich' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Rich
                  </button>
                  <button
                    onClick={() => setEditorMode('graph')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'graph' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Graph
                  </button>
                  <button
                    onClick={() => setEditorMode('canvas')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'canvas' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Canvas
                  </button>
                  <button
                    onClick={() => setEditorMode('tasks')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'tasks' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Tasks
                  </button>
                  <button
                    onClick={() => setEditorMode('named-notes')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'named-notes' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Cloud Notes
                  </button>
                  <button
                    onClick={() => setEditorMode('music')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'music' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Music
                  </button>
                  <button
                    onClick={() => setEditorMode('presets')}
                    className={`px-3 py-2 rounded-lg transition-all ${editorMode === 'presets' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white font-semibold' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    🎨 Presets
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
                    onClick={() => handleDelete()}
                    disabled={isSaving || !selectedId}
                    className="px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
                  >
                    Delete
                  </button>

                  <button
                    onClick={handleSave}
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
                    ) : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Editor Card */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ${
              isFocusMode
              ? 'max-w-4xl mx-auto w-full bg-transparent'
              : 'bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden'
          }`}>
            <div className="flex-1 relative min-h-0">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              }>
              {editorMode === 'graph' ? (
                <GraphView
                  notes={notes}
                  currentId={selectedId}
                  onNodeClick={(id) => {
                    handleSelectNote(id);
                    setEditorMode('rich');
                  }}
                  theme={theme}
                />
              ) : editorMode === 'canvas' ? (
                <CanvasEditor
                  key={selectedId || 'new'}
                  initialData={currentNote.content}
                  onChange={val => setCurrentNote({...currentNote, content: val})}
                  theme={theme}
                />
              ) : editorMode === 'flashcards' ? (
                <FlashcardView
                  notes={notes}
                  onClose={() => setEditorMode('rich')}
                />
              ) : editorMode === 'tasks' ? (
                <TaskView
                  notes={notes}
                  onClose={() => setEditorMode('rich')}
                  onNavigate={(id) => {
                      handleSelectNote(id);
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
              ) : editorMode === 'simple' ? (
                <Editor
                  value={currentNote.content}
                  onChange={val => setCurrentNote({...currentNote, content: val})}
                />
              ) : (
                <BlockEditor
                  key={selectedId || 'new'}
                  noteId={selectedId || 'draft'}
                  value={currentNote.content}
                  onChange={val => setCurrentNote({...currentNote, content: val})}
                  availableNotes={notes}
                  onNavigate={handleSelectNote}
                  lastExternalUpdate={lastRestoreTs}
                />
              )}
              </Suspense>

              {isAiLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-blue-500 dark:text-blue-400 font-medium">
                      {aiStatus || 'AI is thinking...'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(!isFocusMode && editorMode !== 'graph' && editorMode !== 'canvas') && (
              <>
                <RelatedNotes
                  notes={notes}
                  currentId={selectedId}
                  content={currentNote.content}
                  onNavigate={handleSelectNote}
                />
                <Backlinks
                  notes={notes}
                  currentId={selectedId}
                  onNavigate={handleSelectNote}
                />
              </>
            )}
          </div>

          {/* Footer Card */}
          <div className={`${isFocusMode || editorMode === 'named-notes' || editorMode === 'music' || editorMode === 'playlists' || editorMode === 'mod-songs' || editorMode === 'presets' ? 'hidden' : 'block'} bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl transition-colors duration-200`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="text-sm font-medium">Tags</span>
                </div>
                <input 
                  value={currentNote.tags}
                  onChange={e => setCurrentNote({...currentNote, tags: e.target.value})}
                  placeholder="Add tags separated by commas..."
                  className="bg-transparent text-sm text-slate-600 dark:text-slate-300 flex-1 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:text-slate-900 dark:focus:text-white transition-colors"
                />

                {/* AI Tag Button */}
                <button
                  onClick={handleAutoTag}
                  disabled={isAiLoading || !currentNote.content}
                  className="p-2 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 transition-colors disabled:opacity-50"
                  title="Auto-Suggest Tags"
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Settings"
                >
                   <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppWrapper
