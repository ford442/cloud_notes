import { useState, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react'
import type { CommandItem } from './slash-command'

interface SlashCommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

const SECTION_ORDER = ['Text', 'Lists', 'Blocks', 'Media', 'Insert', 'AI'];

export const SlashCommandList = forwardRef((props: SlashCommandListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Reset selection when items change
  // We use a heuristic (length + first item) to avoid resetting on every render if props.items is a new reference but same content
  const firstItemTitle = props.items.length > 0 ? props.items[0].title : '';
  useEffect(() => {

    setSelectedIndex(0)
  }, [props.items.length, firstItemTitle])

  // Sort items by section
  const sortedItems = useMemo(() => {
    return [...props.items].sort((a, b) => {
        const sectionA = a.section || 'Other';
        const sectionB = b.section || 'Other';

        const indexA = SECTION_ORDER.indexOf(sectionA);
        const indexB = SECTION_ORDER.indexOf(sectionB);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return sectionA.localeCompare(sectionB);
    });
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = sortedItems[index]

    if (item) {
      props.command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + sortedItems.length - 1) % sortedItems.length)
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % sortedItems.length)
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
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-[240px] p-1 animate-in fade-in zoom-in-95 duration-150">
      {sortedItems.length ? (
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
           {sortedItems.map((item, index) => {
            const isSectionStart = index === 0 || item.section !== sortedItems[index - 1].section;
            return (
                <div key={index}>
                    {isSectionStart && (
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 mt-1 mb-1 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                            {item.section || 'Actions'}
                        </div>
                    )}
                    <button
                    className={`flex items-center gap-3 w-full text-left px-3 py-2 text-sm rounded-md transition-all duration-75 ${
                        index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 translate-x-1'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                    onClick={() => selectItem(index)}
                    >
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700/50 shadow-sm ${index === selectedIndex ? 'bg-white dark:bg-blue-800/50 text-blue-500' : 'text-slate-500 dark:text-slate-400'}`}>
                        <span className="text-xs scale-90">{item.icon}</span>
                    </div>
                    <div className="font-medium">{item.title}</div>
                    </button>
                </div>
            )
           })}
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-slate-400">No results</div>
      )}
    </div>
  )
})

SlashCommandList.displayName = 'SlashCommandList'
