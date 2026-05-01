import type { Editor } from '@tiptap/core';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface BlockActionMenuProps {
  editor: Editor;
  position: { top: number; left: number };
  onClose: () => void;
  currentNodePos: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ignoreRef?: RefObject<any>;
}

const MenuItem = ({ icon, label, onClick, danger = false }: { icon: ReactNode, label: string, onClick: () => void, danger?: boolean }) => (
  <button
    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-200'}`}
    onClick={onClick}
  >
    <div className="w-5 h-5 flex items-center justify-center opacity-70 font-mono text-xs">{icon}</div>
    <span>{label}</span>
  </button>
);

const SubHeader = ({ label }: { label: string }) => (
    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 mt-1 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 select-none">
        {label}
    </div>
);

export const BlockActionMenu = ({ editor, position, onClose, currentNodePos, ignoreRef }: BlockActionMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Also check if we clicked on the ignoreRef (the handle button)
        if (ignoreRef && ignoreRef.current && ignoreRef.current.contains(target)) {
          return;
        }
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, ignoreRef]);

  const execute = (fn: () => void) => {
    fn();
    onClose();
  };

  const setNode = (type: string, attrs: Record<string, unknown> = {}) => {
      execute(() => {
          editor.chain().focus().setNodeSelection(currentNodePos).setNode(type, attrs).run();
      });
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[200px] py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
      style={{
        top: position.top + 28, // Below the handle
        left: position.left,
      }}
    >
      <SubHeader label="Turn Into" />
      <MenuItem icon="¶" label="Text" onClick={() => setNode('paragraph')} />
      <MenuItem icon="H1" label="Heading 1" onClick={() => setNode('heading', { level: 1 })} />
      <MenuItem icon="H2" label="Heading 2" onClick={() => setNode('heading', { level: 2 })} />
      <MenuItem icon="H3" label="Heading 3" onClick={() => setNode('heading', { level: 3 })} />
      <MenuItem icon="•" label="Bullet List" onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).toggleBulletList().run())} />
      <MenuItem icon="1." label="Ordered List" onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).toggleOrderedList().run())} />
      <MenuItem icon="☑" label="Task List" onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).toggleTaskList().run())} />
      <MenuItem icon="❝" label="Quote" onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).toggleBlockquote().run())} />
      <MenuItem icon="<>" label="Code Block" onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).toggleCodeBlock().run())} />

      <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

      <SubHeader label="Actions" />
      <MenuItem
        icon="📋"
        label="Duplicate"
        onClick={() => execute(() => {
             const node = editor.state.doc.nodeAt(currentNodePos);
             if (node) {
                 const json = node.toJSON();
                 editor.chain().focus().insertContentAt(currentNodePos + node.nodeSize, json).run();
             }
        })}
      />
      <MenuItem
        icon="🗑️"
        label="Delete"
        danger
        onClick={() => execute(() => editor.chain().focus().setNodeSelection(currentNodePos).deleteSelection().run())}
      />
    </div>
  );
};
