import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { useState } from 'react'
import { AIService } from '../../services/ai'

interface AIBubbleMenuProps {
  editor: Editor
}

export const AIBubbleMenu = ({ editor }: AIBubbleMenuProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [prompt, setPrompt] = useState('')

  const handleAIAction = async (action: 'improve' | 'shorter' | 'longer' | 'fix' | 'custom') => {
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    if (!selectedText) return

    setIsLoading(true)
    try {
      let fullPrompt = ''
      switch (action) {
        case 'improve':
          fullPrompt = `Improve the following text:\n\n${selectedText}`
          break
        case 'shorter':
          fullPrompt = `Make the following text shorter:\n\n${selectedText}`
          break
        case 'longer':
          fullPrompt = `Make the following text longer:\n\n${selectedText}`
          break
        case 'fix':
          fullPrompt = `Fix the spelling and grammar in the following text:\n\n${selectedText}`
          break
        case 'custom':
          fullPrompt = `${prompt}:\n\n${selectedText}`
          break
      }

      const generated = await AIService.generateText(fullPrompt)
      editor.chain().focus().insertContent(generated).run()
    } catch (e) {
      console.error('AI Generation Failed:', e)
    } finally {
      setIsLoading(false)
      setPrompt('')
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state, from, to }: { state: EditorState; from: number; to: number }) => {
        return from !== to && !state.selection.empty && editor.isEditable
      }}
      className="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-sm"
    >
      {isLoading ? (
        <div className="flex items-center gap-2 p-3 text-slate-500 text-sm">
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          AI is thinking...
        </div>
      ) : (
        <>
          <div className="flex p-1 border-b border-slate-100 dark:border-slate-700/50">
            <button
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleAIAction('improve')}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2"
            >
              <span className="text-purple-500">✨</span> Improve
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleAIAction('fix')}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200 transition-colors"
            >
              Fix
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleAIAction('shorter')}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200 transition-colors"
            >
              Shorter
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()} onClick={() => handleAIAction('longer')}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200 transition-colors"
            >
              Longer
            </button>
          </div>
          <div className="p-2 flex gap-2 bg-slate-50 dark:bg-slate-900/50">
            <input
              type="text"
              placeholder="Ask AI to..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && prompt.trim()) {
                  handleAIAction('custom')
                }
              }}
              className="flex-1 bg-transparent border border-slate-200 dark:border-slate-600 rounded px-2 py-1 outline-none focus:border-purple-500 transition-colors text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            <button
              onMouseDown={(e) => e.preventDefault()} onClick={() => {
                if (prompt.trim()) handleAIAction('custom')
              }}
              disabled={!prompt.trim()}
              className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Ask
            </button>
          </div>
        </>
      )}
    </BubbleMenu>
  )
}
