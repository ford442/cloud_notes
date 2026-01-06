import { useState, useImperativeHandle, forwardRef } from 'react'
import type { CommandItem } from './slash-command'

interface SlashCommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export const SlashCommandList = forwardRef((props: SlashCommandListProps, ref) => {
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
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[200px] p-1">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={index}
            className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
              index === selectedIndex
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            onClick={() => selectItem(index)}
          >
            {item.icon && <div className="text-slate-400 dark:text-slate-500">{item.icon}</div>}
            <div className="font-medium">{item.title}</div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-slate-400">No results</div>
      )}
    </div>
  )
})

SlashCommandList.displayName = 'SlashCommandList'
