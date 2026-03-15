import { useState, useRef } from 'react';
import { marked } from 'marked';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
}

interface SlashCommand {
  label: string;
  insertText: () => string;
  icon: string;
}

const COMMANDS: SlashCommand[] = [
  { label: 'Date', insertText: () => new Date().toISOString().split('T')[0], icon: '📅' },
  { label: 'Time', insertText: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), icon: '⏰' },
  { label: 'Heading 1', insertText: () => '# ', icon: 'H1' },
  { label: 'Heading 2', insertText: () => '## ', icon: 'H2' },
  { label: 'Heading 3', insertText: () => '### ', icon: 'H3' },
  { label: 'To-do List', insertText: () => '- [ ] ', icon: '☑️' },
  { label: 'Bullet List', insertText: () => '- ', icon: '•' },
  { label: 'Code Block', insertText: () => '```\n\n```', icon: '💻' },
];

export const Editor = ({ value, onChange }: EditorProps) => {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const htmlContent = mode === 'preview' ? marked.parse(value || '') as string : '';

  const filteredCommands = COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(slashQuery.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % filteredCommands.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      } else if (e.key === 'Enter') {
        if (filteredCommands[slashIndex]) {
          e.preventDefault();
          insertCommand(filteredCommands[slashIndex]);
          return;
        } else {
          setSlashMenuOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);

    // Match the last occurrence of '/' that is preceded by a space or is at the beginning of the string
    // and capture the text after it.
    const slashMatch = textBeforeCursor.match(/(?:^|\n|\s)\/([^\s]*)$/);

    if (slashMatch) {
      setSlashQuery(slashMatch[1]);
      setSlashIndex(0);
      setSlashMenuOpen(true);
    } else {
      setSlashMenuOpen(false);
    }
  };

  const insertCommand = (cmd: SlashCommand) => {
    if (!textareaRef.current) return;
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);

    // Find the last slash to replace
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
        const textToInsert = cmd.insertText();
        const newValue = value.substring(0, lastSlashIndex) + textToInsert + textAfterCursor;
        onChange(newValue);

        // Focus back and set cursor pos after React re-renders
        setTimeout(() => {
           if (textareaRef.current) {
               textareaRef.current.focus();
               const newPos = lastSlashIndex + textToInsert.length;
               textareaRef.current.setSelectionRange(newPos, newPos);
           }
        }, 0);
    }
    setSlashMenuOpen(false);
  };

  return (
    <div className="flex flex-col w-full h-full bg-transparent relative">
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
          <>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setSlashMenuOpen(false), 150)}
              className="absolute inset-0 w-full h-full bg-transparent p-10 text-slate-900 dark:text-slate-100 text-lg leading-loose resize-none outline-none font-mono selection:bg-blue-500/30 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors duration-200"
              placeholder="Start writing your note in Markdown..."
              spellCheck={false}
            />
            {slashMenuOpen && filteredCommands.length > 0 && (
              <div
                className="absolute z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden w-64 max-h-64 overflow-y-auto top-10 left-10"
              >
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                   Slash Commands
                </div>
                {filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.label}
                    onClick={() => insertCommand(cmd)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${idx === slashIndex ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    <span className="text-lg w-6 text-center">{cmd.icon}</span>
                    <span className="font-medium text-sm">{cmd.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div
            className="absolute inset-0 w-full h-full overflow-y-auto p-10 leading-loose prose prose-slate dark:prose-invert max-w-none transition-colors duration-200"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
      </div>
    </div>
  )
}
