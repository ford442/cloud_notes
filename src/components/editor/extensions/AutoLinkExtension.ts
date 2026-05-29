import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Fuse from 'fuse.js'

interface AutoLinkOptions {
  debounceMs?: number
}

export const AutoLinkExtension = Extension.create<AutoLinkOptions>({
  name: 'autoLink',

  addOptions() {
    return { debounceMs: 120 }
  },

  addStorage() {
    return {
      availableNotes: [] as any[],
      currentSuggestion: null as string | null,

      updateAvailableNotes: function (notes: any[]) {
        this.availableNotes = notes
      },
    }
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extensionThis = this
    const pluginKey = new PluginKey('autoLink')

    // Note: If performance becomes an issue with 1000+ notes, consider increasing debounceMs.
    // To require stricter matches, lower the threshold (e.g. to 0.2).
    const fuse = new Fuse([], {
      keys: ['name', 'title'],
      threshold: 0.4,
      includeScore: true,
    })

    let currentDecorationSet = DecorationSet.empty


    const updateSuggestion = (view: any, suggestion: string | null) => {
      extensionThis.storage.currentSuggestion = suggestion

      if (!suggestion) {
        currentDecorationSet = DecorationSet.empty
        return
      }

      const { from } = view.state.selection

      const ghost = Decoration.widget(from, () => {
        const span = document.createElement('span')
        span.className = 'auto-link-ghost'
        span.textContent = `  [[${suggestion}]]`
        span.style.opacity = '0.65'
        span.style.color = '#64748b'
        span.style.pointerEvents = 'none'
        span.style.fontStyle = 'italic'
        return span
      })

      currentDecorationSet = DecorationSet.create(view.state.doc, [ghost])
    }


    const clearSuggestion = (view: any) => {
      updateSuggestion(view, null)
      view.dispatch(view.state.tr.setMeta(pluginKey, { decorationSet: DecorationSet.empty }))
    }


    const acceptSuggestion = (view: any) => {
      const suggestion = extensionThis.storage.currentSuggestion
      if (!suggestion) return false

      const { state } = view
      const { from } = state.selection

      // Get the text before cursor to know how much to replace
      const $from = state.selection.$from

      // Look back for the matching prefix/word
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

      // Find the start of the word being typed
      const match = textBefore.match(/\S+$/)
      const queryLength = match ? match[0].length : 0

      // We want to replace the typed query with the actual wikilink
      const replaceFrom = from - queryLength
      const wikilinkText = `[[${suggestion}]] ` // Add a space after for convenience

      const tr = state.tr.insertText(wikilinkText, replaceFrom, from)

      view.dispatch(tr)
      clearSuggestion(view)
      return true
    }

    // Debounced suggestion checker
    let debounceTimer: ReturnType<typeof setTimeout> | null = null


    const checkForMatch = (view: any) => {
      if (debounceTimer) clearTimeout(debounceTimer)

      debounceTimer = setTimeout(() => {
        const { availableNotes } = extensionThis.storage
        if (!availableNotes || availableNotes.length === 0) return

        const $from = view.state.selection.$from
        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset).trim()

        // Take just the last word to check for link completions
        const words = textBefore.split(/\s+/)
        const query = words[words.length - 1] || ''

        if (query.length < 2) return

        fuse.setCollection(availableNotes)
        const results = fuse.search(query)

        if (results.length === 0) {
          clearSuggestion(view)
          return
        }

        const best = results[0]

        const item = best.item as any
        const title = item.name || item.title || ''
        const score = best.score ?? 1
        const isGoodMatch = score < 0.4

        // We only want to trigger this for the actual words being typed right now
        // Split title into words and check if any word starts with our query
        const titleWords = title.toLowerCase().split(/\s+/)
        const queryLower = query.toLowerCase()
        const isPrefix = titleWords.some((word: string) => word.startsWith(queryLower)) || title.toLowerCase().startsWith(queryLower)

        if (isGoodMatch && isPrefix) {
          updateSuggestion(view, title)
          view.dispatch(view.state.tr.setMeta(pluginKey, { decorationSet: currentDecorationSet }))
        } else {
          clearSuggestion(view)
        }
      }, this.options.debounceMs)
    }

    return [
      new Plugin({
        key: pluginKey,

        state: {
          init: () => ({ decorationSet: DecorationSet.empty }),
          apply(tr, old) {
            const meta = tr.getMeta(pluginKey)
            if (meta?.decorationSet !== undefined) return { decorationSet: meta.decorationSet }
            return { decorationSet: old.decorationSet.map(tr.mapping, tr.doc) }
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorationSet || DecorationSet.empty
          },

          handleKeyDown(view, event) {
            // Tab to accept suggestion
            if (event.key === 'Tab' && extensionThis.storage.currentSuggestion) {
              event.preventDefault()
              return acceptSuggestion(view)
            }

            // Escape to clear
            if (event.key === 'Escape') {
              clearSuggestion(view)
              return false
            }

            // Trigger suggestion check
            if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
              checkForMatch(view)
            }

            return false
          },
        },
      }),
    ]
  },
})
