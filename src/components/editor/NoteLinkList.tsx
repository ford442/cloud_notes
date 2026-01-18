import { useState, useImperativeHandle, forwardRef } from 'react'
import type { CloudItemMeta } from '../../services/api'

interface NoteLinkListProps {
  items: CloudItemMeta[];
  command: (item: CloudItemMeta) => void;
}

export const NoteLinkList = forwardRef((props: NoteLinkListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Derived state pattern to reset selection when items change
  const [prevItems, setPrevItems] = useState(props.items)
  if (props.items !== prevItems) {
    setPrevItems(props.items)
    setSelectedIndex(0)
  }

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    },
  }))

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[250px] max-w-[350px] p-1 animate-in fade-in zoom-in-95 duration-150">
       <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-3 py-1 mb-1 uppercase tracking-wider">Link to Note</div>
      {props.items.length ? (
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin flex flex-col gap-1">
          {props.items.map((item, index) => {
            const parts = (item.description || '').split(' ::: ');
            const subject = parts[0] || 'General';
            const section = parts[1] || 'Inbox';

            return (
              <button
                key={item.id}
                className={`flex flex-col w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  index === selectedIndex
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                onClick={() => selectItem(index)}
              >
                <div className="font-medium truncate w-full">{item.name || 'Untitled'}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 truncate w-full flex justify-between mt-1 opacity-70">
                   <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">{subject}</span>
                   <span>{section}</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="px-3 py-4 text-sm text-slate-400 text-center italic">No matching notes found</div>
      )}
    </div>
  )
})

NoteLinkList.displayName = 'NoteLinkList'
