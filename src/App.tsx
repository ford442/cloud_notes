import { useState, useEffect } from 'react'
import { StorageService } from './services/api'
import type { Note, CloudItemMeta } from './services/api'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'    

function App() {
  const [notes, setNotes] = useState<CloudItemMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
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
    } catch (e) {
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
    <div className="flex h-screen w-screen bg-[#0a0a0c] text-gray-200 font-sans overflow-hidden">
      
      <Sidebar 
        notes={notes} 
        selectedId={selectedId} 
        onSelect={handleSelectNote} 
        onNew={handleNew}
        isLoading={isLoading}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* 1. Header: Meta Inputs */}
        <div className="h-16 border-b border-gray-800 flex items-center px-6 bg-[#131315] gap-4">
           {/* Breadcrumb-style Inputs for Subject/Section */}
           <div className="flex items-center bg-[#0a0a0c] border border-gray-700 rounded-md overflow-hidden">
              <input 
                type="text"
                value={currentNote.subject}
                onChange={e => setCurrentNote({...currentNote, subject: e.target.value})}
                placeholder="Subject"
                className="bg-transparent px-3 py-1.5 text-xs font-bold text-cyan-500 w-24 outline-none text-right border-r border-gray-800 placeholder-cyan-900"
              />
              <div className="px-2 text-gray-600 text-[10px]">▶</div>
              <input 
                type="text"
                value={currentNote.section}
                onChange={e => setCurrentNote({...currentNote, section: e.target.value})}
                placeholder="Section"
                className="bg-transparent px-3 py-1.5 text-xs text-gray-300 w-32 outline-none placeholder-gray-700"
              />
           </div>

           <div className="h-6 w-px bg-gray-800 mx-2"></div>

           {/* Title Input */}
           <input 
              type="text"
              value={currentNote.title}
              onChange={e => setCurrentNote({...currentNote, title: e.target.value})}
              placeholder="Note Title..."
              className="flex-1 bg-transparent text-xl font-bold text-white placeholder-gray-700 outline-none"
            />

            {/* Save Button */}
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded font-bold text-xs tracking-widest transition-all
                ${isSaving 
                  ? 'bg-yellow-600/50 text-yellow-200' 
                  : 'bg-cyan-700 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-900/20'
                }`}
            >
              {isSaving ? 'SAVING...' : 'SAVE'}
            </button>
        </div>

        {/* 2. Editor */}
        <div className="flex-1 relative">
          <Editor 
            value={currentNote.content} 
            onChange={val => setCurrentNote({...currentNote, content: val})} 
          />
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-cyan-500 font-mono animate-pulse">Loading Content...</div>
            </div>
          )}
        </div>

        {/* 3. Footer: Tags & Author */}
        <div className="h-10 border-t border-gray-800 bg-[#0f0f11] flex items-center px-6 justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-gray-600 text-[10px] uppercase font-bold">Tags</span>
            <input 
              value={currentNote.tags}
              onChange={e => setCurrentNote({...currentNote, tags: e.target.value})}
              placeholder="Add tags..."
              className="bg-transparent text-xs text-gray-400 w-full outline-none placeholder-gray-700"
            />
          </div>
          <div className="flex items-center gap-2">
             <span className="text-gray-600 text-[10px]">Author:</span>
             <input 
                value={authorName} 
                onChange={e => setAuthorName(e.target.value)}
                className="bg-transparent text-xs text-cyan-600 font-bold outline-none w-16 text-right"
              />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App