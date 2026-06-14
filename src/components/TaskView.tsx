import { useState, useEffect } from 'react';
import type { CloudItemMeta } from '../services/api';
import { StorageService } from '../services/api';
import { PluginRegistry } from '../services/plugin';
import { useToast } from './Toast';

interface TaskViewProps {
  notes: CloudItemMeta[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

interface Task {
  id: string; // Unique ID for the task instance (noteId + line index or content hash)
  noteId: string;
  noteTitle: string;
  content: string;
  lineIndex: number;
}

export const TaskView = ({ notes, onClose, onNavigate }: TaskViewProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  // Deduplicate notes by ID
  const uniqueNotes = Array.from(new Map(notes.map(n => [n.id, n])).values());

  const loadTasks = async (forceFresh = false) => {
    setIsLoading(true);
    const foundTasks: Task[] = [];

    // Iterate all notes and load content to find tasks
    const promises = uniqueNotes.map(async (n) => {
       try {
         // Try cache first to be fast, but fallback to network via getNoteContent if needed
         let note = forceFresh ? null : await StorageService.getCachedNote(n.id);
         if (!note) {
             note = await StorageService.getNoteContent(n.id);
         }

         if (!note || !note.content) return;

         const lines = note.content.split('\n');
         lines.forEach((line, index) => {
           // Match "- [ ] ", "- [ ]", "* [ ] "
           const trimmed = line.trim();
           if (trimmed.startsWith('- [ ]') || trimmed.startsWith('* [ ]')) {
             const content = trimmed.replace(/^[-*] \[ \]\s?/, '').replace(/&nbsp;$/, '').trim();
             if (content) {
               foundTasks.push({
                   id: `${n.id}-${index}`,
                   noteId: n.id,
                   noteTitle: n.name || note.title || 'Untitled',
                   content,
                   lineIndex: index
               });
             }
           }
         });
       } catch (e) {
         console.warn(`Failed to scan note ${n.name}`, e);
       }
    });

    await Promise.all(promises);
    if (foundTasks.length > 0 || forceFresh) {
        // Sort tasks by noteTitle and then lineIndex to maintain consistent rendering
        foundTasks.sort((a, b) => {
            if (a.noteTitle === b.noteTitle) {
                return a.lineIndex - b.lineIndex;
            }
            return a.noteTitle.localeCompare(b.noteTitle);
        });
        setTasks(foundTasks);
    } else if (tasks.length > 0 && !forceFresh) {
        // Do NOT wipe existing tasks on a failed/empty refresh
        console.warn("loadTasks returned empty — keeping previous tasks");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [notes]);

  const handleComplete = async (task: Task) => {
      // Optimistic removal
      setTasks(prev => prev.filter(t => t.id !== task.id));

      try {
          const currentNote = PluginRegistry.getCurrentNote();
          let note;

          if (currentNote && currentNote.id === task.noteId) {
              note = currentNote;
          } else {
              note = await StorageService.getCachedNote(task.noteId);
              if (!note) {
                  note = await StorageService.getNoteContent(task.noteId);
              }
          }

          if (!note?.content) throw new Error("Note not found");

          const lines = note.content.split('\n');
          let updated = false;

          // Primary: update at known line index
          if (lines[task.lineIndex]?.includes(task.content) && lines[task.lineIndex].match(/\[\s*\]/)) {
            lines[task.lineIndex] = lines[task.lineIndex].replace(/\[\s*\]/, '[x]');
            updated = true;
          } else {
            // Fallback: search across all lines
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(task.content) && lines[i].match(/\[\s*\]/)) {
                lines[i] = lines[i].replace(/\[\s*\]/, '[x]');
                updated = true;
                break;
              }
            }
          }

          if (!updated) {
            addToast('Could not locate task in note', 'error');
            loadTasks(true);
            return;
          }

          const newContent = lines.join('\n');
          const author = localStorage.getItem('author_name') || "Anon";

          if (currentNote && currentNote.id === task.noteId) {
              // Update using PluginRegistry context function so it reflects in Editor immediately
              await PluginRegistry.updateNote({ content: newContent });
          } else {
              await StorageService.updateNote(task.noteId, { ...note, content: newContent }, author);
          }

          addToast('Task completed ✓', 'success');

          // Only refresh after successful save (with small delay for UI polish)
          setTimeout(() => loadTasks(false), 250);
      } catch (error) {
          console.error('Complete task failed:', error);
          addToast('Failed to complete task', 'error');
          // Revert optimistic change
          loadTasks(false);
      }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-500 font-medium">Scanning notes for tasks...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-8 overflow-hidden relative">
       {/* Header */}
       <div className="flex items-center justify-between mb-8">
           <div>
               <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                   <span className="text-blue-500">☑</span> Task Dashboard
               </h2>
               <p className="text-slate-500 dark:text-slate-400 mt-2">
                   You have <strong>{tasks.length}</strong> pending tasks across your notes.
               </p>
           </div>
           <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all">
             <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
       </div>

       {/* Task List */}
       <div className="flex-1 overflow-y-auto space-y-4 pr-2">
           {tasks.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                   <div className="text-6xl mb-4">🎉</div>
                   <p className="text-xl">All caught up!</p>
               </div>
           ) : (
               tasks.map(task => (
                   <div key={task.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-start gap-4 transition-all hover:shadow-md group">
                       <button
                         onClick={() => handleComplete(task)}
                         className="mt-1 w-5 h-5 rounded border border-slate-300 dark:border-slate-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-center text-transparent hover:text-blue-500 transition-all"
                         title="Mark as Complete"
                       >
                           <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                       </button>

                       <div className="flex-1">
                           <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                               {task.content}
                           </div>
                           <div
                             onClick={() => onNavigate(task.noteId)}
                             className="text-xs text-slate-400 hover:text-blue-500 cursor-pointer mt-1 flex items-center gap-1 w-fit"
                           >
                               <span className="opacity-50">📄</span> {task.noteTitle}
                           </div>
                       </div>
                   </div>
               ))
           )}
       </div>
    </div>
  );
};
