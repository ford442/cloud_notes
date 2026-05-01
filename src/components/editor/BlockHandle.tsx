import type { Editor } from '@tiptap/core'
import { useEffect, useState, useRef } from 'react'
import { BlockActionMenu } from './BlockActionMenu'

interface BlockHandleProps {
  editor: Editor | null
}

export const BlockHandle = ({ editor }: BlockHandleProps) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [activeNodePos, setActiveNodePos] = useState<number | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const activeNodePosRef = useRef<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Keep ref in sync
  useEffect(() => {
    activeNodePosRef.current = activeNodePos
  }, [activeNodePos])

  useEffect(() => {
    if (!editor) return

    const updatePosition = (event: MouseEvent) => {
      if (isDragging || isMenuOpen) return;

      const view = editor.view
      // If we hover the handle itself, we want to keep it.
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
          return;
      }

      // If we are hovering the menu (if it exists outside ref for some reason), keep it
      // But menu is rendered conditionally, so if isMenuOpen is true, we return early anyway.

      if (!view.dom.contains(event.target as Node)) {
          return
      }

      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (!pos) return

      const $pos = view.state.doc.resolve(pos.pos)
      const depth = 1
      if ($pos.depth < depth) return

      const blockPos = $pos.before(depth)

      const nodeDom = view.nodeDOM(blockPos) as HTMLElement
      if (!nodeDom || !nodeDom.getBoundingClientRect) return

      const rect = nodeDom.getBoundingClientRect()

      setPosition({
        top: rect.top,
        left: rect.left - 24 - 4
      })
      setActiveNodePos(blockPos)
    }

    const handleScroll = () => {
        if (isDragging) return;
        // Even if menu is open, we want to update position so menu follows scroll

        const blockPos = activeNodePosRef.current;
        if (blockPos === null) return;

        const view = editor.view;
        try {
             const nodeDom = view.nodeDOM(blockPos) as HTMLElement
             if (!nodeDom || !nodeDom.getBoundingClientRect) {
                 setPosition(null);
                 setIsMenuOpen(false); // Close menu if block disappears
                 return;
             }

             const rect = nodeDom.getBoundingClientRect();
             setPosition({
                top: rect.top,
                left: rect.left - 24 - 4
             });
        } catch (e) {
            setPosition(null);
            setIsMenuOpen(false);
        }
    }

    window.addEventListener('mousemove', updatePosition)
    window.addEventListener('scroll', handleScroll, true) // Capture

    return () => {
      window.removeEventListener('mousemove', updatePosition)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [editor, isDragging, isMenuOpen])

  if (!editor || !position) return null

  return (
    <>
      <div
        ref={menuRef}
        data-testid="block-handle"
        draggable="true"
        onDragStart={(e) => {
          setIsDragging(true);
          setIsMenuOpen(false); // Close menu on drag
          if (activeNodePos !== null) {
              editor.commands.setNodeSelection(activeNodePos);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', 'Block Move');
          }
        }}
        onDragEnd={() => {
          setIsDragging(false);
        }}
        onClick={(e) => {
           e.stopPropagation();
           setIsMenuOpen(!isMenuOpen);
        }}
        className={`fixed z-50 flex items-center justify-center w-6 h-6 rounded cursor-grab transition-colors ${
            isMenuOpen
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400'
        }`}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
           <path d="M4 4a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm8-12a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </div>

      {isMenuOpen && activeNodePos !== null && (
        <BlockActionMenu
          editor={editor}
          position={position}
          currentNodePos={activeNodePos}
          onClose={() => setIsMenuOpen(false)}
          ignoreRef={menuRef}
        />
      )}
    </>
  )
}
