import { useState, useEffect } from 'react'
import { StorageService, Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'

function App() {
  const [notes, setNotes] = useState<CloudItemMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [currentNote, setCurrentNote] = useState<Note>({ title: '', content: '', tags: '' })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('author_name') || 'Anon')

  // Load list on mount
  useEffect(() => {
    refreshList()
  }, [])

  // Persist author name
  useEffect(() => {
    localStorage.setItem('author_name', authorName)
  }, [authorName])

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
    } catch (e) {
      alert("Failed to load note")
    } finally {
      setIsLoading(false)
    }
  }

  const handleNew = () => {
    setSelectedId(null)
    setCurrentNote({ title: '', content: '', tags: '' })
  }

  const handleSave = async () => {
    if (!currentNote.title.trim()) return alert("Title required")

    setIsSaving(true)
    const res = await StorageService.saveNote(currentNote, authorName)

    if (res.success) {
      await refreshList()
      // If creating new, select it
      if (!selectedId && res.id) setSelectedId(res.id)
    } else {
      alert("Save failed")
    }
    setIsSaving(false)
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-900 text-gray-200 font-sans overflow-hidden">

      {/* Sidebar List */}
      <Sidebar
        notes={notes}
        selectedId={selectedId}
        onSelect={handleSelectNote}
        onNew={handleNew}
        isLoading={isLoading}
      />

      {/* Main Editor */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Top Bar */}
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-neutral-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 flex-1">
            <input
              type="text"
              value={currentNote.title}
              onChange={e => setCurrentNote({...currentNote, title: e.target.value})}
              placeholder="Note Title..."
              className="bg-transparent text-2xl font-bold text-white placeholder-gray-700 outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-1">
              <span className="text-xs text-gray-500 uppercase font-mono">User</span>
              <input
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                className="bg-transparent text-sm text-cyan-400 font-bold outline-none w-20"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded font-bold text-sm tracking-wide transition-all
                ${isSaving
                  ? 'bg-yellow-600 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white'
                }`}
            >
              {isSaving ? 'SAVING...' : 'SAVE NOTE'}
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative">
          <Editor
            value={currentNote.content}
            onChange={val => setCurrentNote({...currentNote, content: val})}
          />

          {isLoading && (
            <div className="absolute inset-0 bg-neutral-900/80 flex items-center justify-center z-20">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Footer / Tags */}
        <div className="h-12 border-t border-gray-800 bg-neutral-950 flex items-center px-6 gap-2">
          <span className="text-gray-600 text-xs uppercase font-mono">Tags:</span>
          <input
            value={currentNote.tags}
            onChange={e => setCurrentNote({...currentNote, tags: e.target.value})}
            placeholder="music, ideas, lyrics..."
            className="bg-transparent text-sm text-gray-400 w-full outline-none"
          />
        </div>
      </div>
    </div>
  )
}

export default App
