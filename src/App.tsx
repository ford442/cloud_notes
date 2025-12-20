import { useState, useEffect } from 'react'
import { StorageService } from './services/api'
import type { Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'    

function App() {
  const [notes, setNotes] = useState<CloudItemMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  
  // Initialize with default Subject/Section
  const [currentNote, setCurrentNote] = useState<Note>({ 
    title: '', content: '', tags: '', subject: 'General', section: 'Inbox' 
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('author_name') || 'Anon')

  useEffect(() => { refreshList() }, [])
  useEffect(() => { localStorage.setItem('author_name', authorName) }, [authorName])

  const refreshList = async () => {
    setIsLoading(true)
    const list = await StorageService.getNotes()
    setNotes(list)
    setIsLoading(false)
  }

  const handleSelectNote = async (id: string) => {
    setIsLoading(true)
    try {
      const content = await StorageService.getNoteContent(id)
      setCurrentNote(content)
      setSelectedId(id)
    } catch {
      alert("Failed to load note")
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
    if (!currentNote.title.trim()) return alert("Title required")
    
    setIsSaving(true)
    const res = await StorageService.saveNote(currentNote, authorName)
    
    if (res.success) {
      await refreshList()
      if (!selectedId && res.id) setSelectedId(res.id)
    } else {
      alert("Save failed")
    }
    setIsSaving(false)
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
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
          <div className="flex-1 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-200">
            <div className="h-full relative">
              <Editor
                value={currentNote.content}
                onChange={val => setCurrentNote({...currentNote, content: val})}
              />
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-blue-500 dark:text-blue-400 font-medium">Loading Content...</div>
                  </div>
                </div>
              )}
            </div>
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
              </div>
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <input
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    className="bg-transparent text-sm text-blue-600 dark:text-blue-400 font-medium outline-none w-24 text-right focus:text-blue-500 dark:focus:text-blue-300 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
