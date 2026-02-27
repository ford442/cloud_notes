import { useState } from 'react';
import { marked } from 'marked';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
}

export const Editor = ({ value, onChange }: EditorProps) => {
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  const htmlContent = mode === 'preview' ? marked.parse(value || '') as string : '';

  return (
    <div className="flex flex-col w-full h-full bg-transparent">
      {/* Header / Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/50 dark:border-slate-700/50">
        <button
          onClick={() => setMode('write')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            mode === 'write'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Write
        </button>
        <button
          onClick={() => setMode('preview')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            mode === 'preview'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative overflow-hidden">
        {mode === 'write' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full bg-transparent p-8 text-slate-900 dark:text-slate-100 text-lg leading-relaxed resize-none outline-none font-mono selection:bg-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-200"
            placeholder="Start writing your note in Markdown..."
            spellCheck={false}
          />
        ) : (
          <div
            className="absolute inset-0 w-full h-full overflow-y-auto p-8 prose prose-slate dark:prose-invert max-w-none transition-colors duration-200"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  )
}
