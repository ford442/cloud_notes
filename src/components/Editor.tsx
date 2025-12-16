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
      className="w-full h-full bg-[#0a0a0c] p-8 text-gray-300 text-base leading-relaxed resize-none outline-none font-mono selection:bg-cyan-500/30"
      placeholder="Start typing..."
      spellCheck={false}
    />
  )
}
