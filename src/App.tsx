import { useState, useEffect, useRef, useMemo } from 'react'
import { StorageService } from './services/api'
import { SyncBridge } from './services/SyncBridge'
import { AIService } from './services/ai'
import type { Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { PluginRegistry } from './services/plugin'
import { CorePlugins } from './plugins/core'
import { MusicPlugin } from './plugins/music'
import { ToastProvider, useToast } from './components/Toast'
import { SemanticService } from './services/semantic'
import { createPackedDescription } from './utils/metadata'
import { HoverLinkPreview } from './components/editor/HoverLinkPreview'
import { LibraryPlugin } from './plugins/library'
import { EffectsMediaPlugin } from './plugins/effects-media'
import { computeStats, formatStatsSummary } from './utils/stats'

import type { EditorMode } from './app/AppTypes'
import { formatSyncMessage } from './app/AppHelpers'
import { AppDialogs, type DialogConfig } from './app/AppDialogs'
import { AppHeader } from './app/AppHeader'
import { AppFooter } from './app/AppFooter'
import { AppEditors } from './app/AppEditors'

// Initialize Core Plugins once
PluginRegistry.registerAll(CorePlugins);
PluginRegistry.register(MusicPlugin);
PluginRegistry.register(LibraryPlugin);
PluginRegistry.register(EffectsMediaPlugin);

// Wrapper to provide toast context
function AppWrapper() {
  return (
    <ToastProvider>
      <HoverLinkPreview />
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
  const [dialogConfig, setDialogConfig] = useState<DialogConfig | null>(null);

  // Editor mode state
  const [editorMode, setEditorMode] = useState<EditorMode>('rich')
  const { getDueFlashcardsCount } = useFlashcardStats(editorMode)
  const [dueFlashcardsCount, setDueFlashcardsCount] = useState<number>(0)

  // Fetch due count on mount and when editorMode changes (i.e. leaving flashcards)
  useEffect(() => {
    getDueFlashcardsCount().then(setDueFlashcardsCount);
  }, [editorMode, getDueFlashcardsCount]);

  // Initialize with default Subject/Section
  const [currentNote, setCurrentNote] = useState<Note>({ 
    title: '', content: '', tags: '', subject: 'General', section: 'Inbox' 
  })

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saving' | 'saved' | ''>('');
  const lastSavedNoteRef = useRef<Note>({ title: '', content: '', subject: '', section: '', tags: '' });
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentNoteRef = useRef(currentNote)
  currentNoteRef.current = currentNote

  // Expose for command palette workaround
  useEffect(() => {
    (window as any).__DEBUG_GET_CURRENT_NOTE = () => currentNoteRef.current;
    (window as any).PluginRegistry = PluginRegistry;
  }, []);
  
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
       if (['simple', 'rich', 'graph', 'canvas', 'flashcards', 'tasks', 'named-notes', 'music', 'playlists', 'mod-songs', 'presets', 'textures', 'library-browser', 'effects-media'].includes(mode)) {
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

  useEffect(() => {
    const handleOpenHistory = () => setIsHistoryOpen(true);
    window.addEventListener('open-history', handleOpenHistory);
    return () => window.removeEventListener('open-history', handleOpenHistory);
  }, []);

  // Global Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (((e.metaKey || e.ctrlKey) && e.key === 'L' && e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j')) {
        e.preventDefault()
        setIsChatOpen(prev => !prev)
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && !e.shiftKey) {
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

    // 1. Instant Load from Cache (Immediate Feedback - "The Juice")
    const cached = await StorageService.getCachedNotes();
    if (cached.length > 0) {
      setNotes(cached);
      setIsLoading(false);
    }

    // 2. Safe Background Sync via Bridge
    try {
      const { notes: safeNotes, protectedCount, synced } = await SyncBridge.safeGetNotes();
      setNotes(safeNotes);

      // Tasteful feedback if the safety valve activated
      if (synced && protectedCount > 0) {
         addToast(`Protected ${protectedCount} local note(s) missing from server`, "info");
      }
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
        lastSavedNoteRef.current = cached;
        setSelectedId(id);
        setIsLoading(false);
        loadedFromCache = true;
      }

      // 2. Fetch Fresh Content
      const content = await StorageService.getNoteContent(id)

      // Only update if we didn't have cache, or if we want to force update
      // For now, let's always update to ensure freshness, but user won't see a spinner if cached
      setCurrentNote(content)
      lastSavedNoteRef.current = content
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
    const newNoteState = {
      title: '', content: '', tags: '', 
      subject: 'General', section: 'Inbox' 
    };
    setCurrentNote(newNoteState);
    lastSavedNoteRef.current = newNoteState;
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

  const handleSave = async (isAutoSave = false) => {
    if (!currentNote.title.trim()) return addToast("Title required", "error")
    
    if (!isAutoSave) setIsSaving(true)

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
            if (!isAutoSave) addToast("Note updated successfully", "success")
        }
    } else {
        // CREATE NEW
        console.log("Saving note with content length:", noteToSave.content.length);
        console.log("Saving note with content:", noteToSave.content);
        const res = await StorageService.saveNote(noteToSave, authorName);
        if (res.success && res.id) {
            savedId = res.id;
            success = true;
            if (!isAutoSave) addToast(isUpdate ? "Note saved as copy (title changed)" : "Note created successfully", "success")
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
          lastSavedNoteRef.current = noteToSave;
      }

      // await refreshList() // Removed to prevent overwriting optimistic update with stale API data
      if (savedId) setSelectedId(savedId)

      // Index for Semantic Search (Fire and Forget)
      if (savedId && currentNote.content.length > 30) {
         SemanticService.indexNote(savedId, currentNote.content);
      }

    } else {
      addToast("Save failed", "error")
    }
    if (!isAutoSave) setIsSaving(false)
    return success;
  }

  const handleVpsSync = async (onProgress?: (message: string) => void) => {
    try {
      const res = await StorageService.syncWithVps(onProgress);
      const { message, tone } = formatSyncMessage(res);
      addToast(message, tone);
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

  // Auto-save logic
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const hasMeaningfulChange = () => {
      const last = lastSavedNoteRef.current;
      const current = currentNote;
      return last.title !== current.title ||
             last.content !== current.content ||
             last.subject !== current.subject ||
             last.section !== current.section ||
             last.tags !== current.tags;
    };

    if (currentNote.title.trim() && hasMeaningfulChange()) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

      autoSaveTimerRef.current = setTimeout(async () => {
        setAutoSaveStatus('saving');
        const success = await handleSaveRef.current(true);
        if (success) {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus(''), 2000); // Clear after 2 seconds
        } else {
          setAutoSaveStatus('');
        }
      }, 1200);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [currentNote]);

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
    PluginRegistry.updateNote({ content }).then(() => {
      addToast("Version restored.", "success");
    }).catch((e) => {
      console.error("Failed to persist restored note:", e);
      addToast("Version restored, but auto-save failed. Don't forget to save!", "error");
    });
  };

  const statsSummary = useMemo(() => formatStatsSummary(computeStats(currentNote.content || '')), [currentNote.content]);

  return (
    <div className={`h-screen w-screen overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="h-full w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
        
        <AppDialogs
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          isHistoryOpen={isHistoryOpen}
          setIsHistoryOpen={setIsHistoryOpen}
          isCmdPaletteOpen={isCmdPaletteOpen}
          setIsCmdPaletteOpen={setIsCmdPaletteOpen}
          isSearchOpen={isSearchOpen}
          setIsSearchOpen={setIsSearchOpen}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          dialogConfig={dialogConfig}
          setDialogConfig={setDialogConfig}
          authorName={authorName}
          setAuthorName={setAuthorName}
          theme={theme}
          setTheme={setTheme}
          notes={notes}
          selectedId={selectedId}
          onSelectNote={handleSelectNote}
          onNewNote={handleNew}
          onVpsSync={handleVpsSync}
          onRestore={handleRestore}
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
            onChatOpen={() => setIsChatOpen(true)}
            onVpsSync={handleVpsSync}
            onToggleGraph={() => setEditorMode('graph')}
            onToggleFlashcards={() => setEditorMode('flashcards')}
            dueFlashcardsCount={dueFlashcardsCount}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full min-w-0 p-4 gap-4 relative transition-all duration-300">
          <AppHeader
            isFocusMode={isFocusMode}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            currentNote={currentNote}
            setCurrentNote={setCurrentNote}
            theme={theme}
            setTheme={setTheme}
            isLoading={isLoading}
            isSaving={isSaving}
            isAiLoading={isAiLoading}
            autoSaveStatus={autoSaveStatus}
            selectedId={selectedId}
            onSave={handleSave}
            onDelete={handleDelete}
            onSummarize={handleSummarize}
            onOpenHistory={() => setIsHistoryOpen(true)}
            statsSummary={statsSummary}
          />

          <AppEditors
            isFocusMode={isFocusMode}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            currentNote={currentNote}
            setCurrentNote={setCurrentNote}
            selectedId={selectedId}
            notes={notes}
            onSelectNote={handleSelectNote}
            theme={theme}
            isAiLoading={isAiLoading}
            aiStatus={aiStatus}
            lastRestoreTs={lastRestoreTs}
            statsSummary={statsSummary}
          />

          <AppFooter
            isFocusMode={isFocusMode}
            editorMode={editorMode}
            currentNote={currentNote}
            setCurrentNote={setCurrentNote}
            isAiLoading={isAiLoading}
            onAutoTag={handleAutoTag}
            onSettingsOpen={() => setIsSettingsOpen(true)}
          />
        </div>
      </div>
    </div>
  )
}

// Helper hook to import getDueFlashcardsCount
function useFlashcardStats(editorMode: EditorMode) {
  const [getDueFlashcardsCount, setGetDueFlashcardsCount] = useState<() => Promise<number>>(() => Promise.resolve(0))
  
  useEffect(() => {
    import('./components/FlashcardView').then(m => {
      setGetDueFlashcardsCount(() => m.getDueFlashcardsCount)
    })
  }, [])

  return { getDueFlashcardsCount }
}

export default AppWrapper
