import { useState, useEffect, useRef } from 'react'
import { StorageService } from './services/api'
import { AIService } from './services/ai'
import { EncryptionService } from './utils/encryption'
import type { Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { BlockEditor } from './components/BlockEditor'
import { CanvasEditor } from './components/CanvasEditor'
import { Backlinks } from './components/Backlinks'
import { RelatedNotes } from './components/RelatedNotes'
import { GraphView } from './components/GraphView'
import { FlashcardView } from './components/FlashcardView'
import { CommandPalette } from './components/CommandPalette'
import type { ActionItem } from './components/CommandPalette'
import { PluginRegistry } from './services/plugin'
import { CorePlugins } from './plugins/core'
import { ToastProvider, useToast } from './components/Toast'
import { SemanticService } from './services/semantic'
import { SettingsModal } from './components/SettingsModal'

// Initialize Core Plugins once
PluginRegistry.registerAll(CorePlugins);

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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  
  // Command Palette
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Editor mode state
  const [editorMode, setEditorMode] = useState<'simple' | 'rich' | 'graph' | 'canvas' | 'flashcards'>('rich')

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

  useEffect(() => { refreshList() }, [])
  useEffect(() => { localStorage.setItem('author_name', authorName) }, [authorName])

  // Update Plugin Context
  useEffect(() => {
    PluginRegistry.setNoteGetter(() => currentNoteRef.current);
    PluginRegistry.setAllNotesGetter(() => notesRef.current);
    PluginRegistry.setNoteUpdater((updates) => setCurrentNote(prev => ({ ...prev, ...updates })));
    PluginRegistry.setNavigator((id) => handleSelectNote(id));
    PluginRegistry.setNoteCreator((updates) => {
      setSelectedId(null);
      setCurrentNote({
        title: '', content: '', tags: '', subject: 'General', section: 'Inbox',
        ...updates
      });
    });
    PluginRegistry.setModeSetter((mode) => {
       if (['simple', 'rich', 'graph', 'canvas', 'flashcards'].includes(mode)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setEditorMode(mode as any);
       } else {
         console.warn(`Plugin attempted to set invalid mode: ${mode}`);
       }
    });
  }, []);

  // Global Command Palette Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCmdPaletteOpen(prev => !prev)
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

  const handleSave = async () => {
    if (!currentNote.title.trim()) return addToast("Title required", "error")
    
    setIsSaving(true)
    const res = await StorageService.saveNote(currentNote, authorName)
    
    if (res.success) {
      // Optimistic Update: Update list state immediately
      const savedId = currentNote.id || res.id;
      if (savedId) {
          const packedDesc = `${currentNote.subject || 'General'} ::: ${currentNote.section || 'Inbox'} ::: ${currentNote.tags || ''}`;

          const newItem: CloudItemMeta = {
             id: savedId,
             name: currentNote.title,
             type: 'note',
             author: authorName,
             date: new Date().toISOString(),
             description: packedDesc
          };

          setNotes(prev => {
              const index = prev.findIndex(n => n.id === savedId);
              if (index >= 0) {
                  const copy = [...prev];
                  copy[index] = { ...copy[index], ...newItem };
                  return copy;
              } else {
                  return [newItem, ...prev];
              }
          });
      }

      // await refreshList() // Removed to prevent overwriting optimistic update with stale API data
      if (!selectedId && res.id) setSelectedId(res.id)

      // Index for Semantic Search (Fire and Forget)
      if (savedId && currentNote.content.length > 30) {
         SemanticService.indexNote(savedId, currentNote.content);
      }

      addToast("Note saved successfully", "success")
    } else {
      addToast("Save failed", "error")
    }
    setIsSaving(false)
  }

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
      addToast("AI Summarization failed", "error");
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  const actions: ActionItem[] = [
    {
      id: 'new-note',
      title: 'Create New Note',
      section: 'Actions',
      perform: handleNew
    },
    {
      id: 'toggle-theme',
      title: 'Toggle Theme',
      section: 'Actions',
      perform: () => setTheme(prev => prev === 'light' ? 'dark' : 'light')
    },
    {
      id: 'mode-simple',
      title: 'Switch to Simple Editor',
      section: 'Actions',
      perform: () => setEditorMode('simple')
    },
    {
      id: 'mode-rich',
      title: 'Switch to Rich Editor',
      section: 'Actions',
      perform: () => setEditorMode('rich')
    },
    {
      id: 'mode-graph',
      title: 'Switch to Graph View',
      section: 'Actions',
      perform: () => setEditorMode('graph')
    },
    {
      id: 'mode-canvas',
      title: 'Switch to Canvas Mode',
      section: 'Actions',
      perform: () => setEditorMode('canvas')
    },
    {
      id: 'save-note',
      title: 'Save Current Note',
      section: 'Actions',
      perform: handleSave
    },
    {
      id: 'open-settings',
      title: 'Open Settings',
      section: 'Actions',
      perform: () => setIsSettingsOpen(true)
    },
    ...PluginRegistry.getActions()
  ];

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        authorName={authorName}
        setAuthorName={setAuthorName}
        theme={theme}
        setTheme={setTheme}
      />
      <CommandPalette
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        notes={notes}
        actions={actions}
        onNavigate={(id) => {
          handleSelectNote(id)
          // If we are in graph mode, switch back to rich?
          // Actually, let's respect the current mode unless it's graph,
          // because graph view doesn't allow editing easily.
          if (editorMode === 'graph') setEditorMode('rich')
        }}
      />
      <div className="flex h-screen w-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
        
        <Sidebar
          notes={notes}
          selectedId={selectedId}
          onSelect={handleSelectNote}
          onNew={handleNew}
          isLoading={isLoading}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full relative p-6 gap-6">

          {/* Header Card */}
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-6 shadow-2xl transition-colors duration-200">
            <div className="flex items-center gap-6">

              {/* Breadcrumb Navigation */}
              <div className="flex items-center bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-600/30 rounded-xl overflow-hidden">
                <input
                  type="text"
                  value={currentNote.subject}
                  onChange={e => setCurrentNote({...currentNote, subject: e.target.value})}
                  className="bg-transparent px-4 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 w-32 outline-none text-center border-r border-slate-200/50 dark:border-slate-600/30 focus:bg-slate-200/30 dark:focus:bg-slate-700/30 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Subject"
                />
                <div className="px-3 text-slate-400 dark:text-slate-500 text-sm">›</div>
                <input
                  type="text"
                  value={currentNote.section}
                  onChange={e => setCurrentNote({...currentNote, section: e.target.value})}
                  className="bg-transparent px-4 py-3 text-sm text-purple-600 dark:text-purple-400 w-36 outline-none text-center focus:bg-slate-200/30 dark:focus:bg-slate-700/30 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Section"
                />
              </div>

              <div className="h-8 w-px bg-slate-300/50 dark:bg-slate-600/50"></div>

              {/* Title Input */}
              <input 
                type="text"
                value={currentNote.title}
                onChange={e => setCurrentNote({...currentNote, title: e.target.value})}
                placeholder="Untitled Note..."
                className="flex-1 bg-transparent text-2xl font-bold text-gray-800 dark:text-white placeholder:text-slate-400 outline-none"
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                 {/* AI Summarize Button */}
                 <button
                    onClick={handleSummarize}
                    disabled={isAiLoading || !currentNote.content}
                    title="Summarize Note"
                    className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 disabled:opacity-50 transition-all"
                 >
                   <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                   </svg>
                 </button>

                 {/* Editor Mode Toggle */}
                 <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex text-xs font-medium">
                  <button
                    onClick={() => setEditorMode('simple')}
                    className={`px-3 py-2 rounded-md transition-all ${editorMode === 'simple' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Simple
                  </button>
                  <button
                    onClick={() => setEditorMode('rich')}
                    className={`px-3 py-2 rounded-md transition-all ${editorMode === 'rich' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Rich
                  </button>
                  <button
                    onClick={() => setEditorMode('graph')}
                    className={`px-3 py-2 rounded-md transition-all ${editorMode === 'graph' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Graph
                  </button>
                  <button
                    onClick={() => setEditorMode('canvas')}
                    className={`px-3 py-2 rounded-md transition-all ${editorMode === 'canvas' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Canvas
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

          {/* Editor Card */}
          <div className="flex-1 flex flex-col bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-200">
            <div className="flex-1 relative min-h-0">
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
                />
              )}

              {(isLoading || isAiLoading) && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-blue-500 dark:text-blue-400 font-medium">
                      {isAiLoading ? aiStatus : 'Loading Content...'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(editorMode !== 'graph' && editorMode !== 'canvas') && (
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
          <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl transition-colors duration-200">
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
