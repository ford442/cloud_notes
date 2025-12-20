// src/components/Editor.tsx

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
}

export const Editor = ({ value, onChange }: EditorProps) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full bg-transparent p-8 text-slate-900 dark:text-slate-100 text-lg leading-relaxed resize-none outline-none font-mono selection:bg-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-200"
      placeholder="Start writing your note..."
      spellCheck={false}
    />
  )
}
