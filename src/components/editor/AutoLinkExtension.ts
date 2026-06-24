import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Fuse from 'fuse.js'

// Try to import lodash debounce, otherwise we can use a simple implementation
// as fallback since we don't know for sure if lodash is installed.
// Looking at package.json, lodash is not there.
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function(this: any, ...args: Parameters<T>) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    } as T;
}

interface AutoLinkOptions {
  debounceMs?: number
}

interface CloudItemMeta {
    id: string;
    name: string;
    description?: string;
}

export const AutoLinkExtension = Extension.create<AutoLinkOptions>({
  name: 'autoLink',

  addOptions() {
    return {
      debounceMs: 150,
    }
  },

  addStorage() {
    return {
      availableNotes: [],
      currentSuggestion: null,
      updateAvailableNotes: function(this: any, notes: CloudItemMeta[]) {
        this.availableNotes = notes
      },
    }
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extensionThis = this
    const pluginKey = new PluginKey('autoLink')

    const fuse = new Fuse([], {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true,
    })

    let decorationSet = DecorationSet.empty

    const updateDecorations = (view: any, suggestion: string | null) => {
      const { state } = view

      if (!suggestion) {
        decorationSet = DecorationSet.empty
        return
      }

      const { from } = state.selection

      // Create ghost text widget right after the cursor
      const ghostDecoration = Decoration.widget(from, () => {
        const span = document.createElement('span')
        span.className = 'auto-link-ghost'
        span.textContent = `  → [[${suggestion}]]` // Customize styling
        span.style.opacity = '0.5'
        span.style.color = '#888'
        span.style.pointerEvents = 'none'
        return span
      }, { side: 1 }) // side: 1 ensures it's inserted *after* the cursor

      decorationSet = DecorationSet.create(state.doc, [ghostDecoration])
    }

    const checkForSuggestion = debounce((view: any) => {
      const { state } = view
      const { availableNotes } = extensionThis.storage

      if (!availableNotes || availableNotes.length === 0) return

      // Get last 3 words before cursor
      const $from = state.selection.$from
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)
      const words = textBefore.trim().split(/\s+/)
      // Only check the last few words
      const query = words.slice(-3).join(' ')

      if (query.length < 2) {
          clearSuggestion(view)
          return
      }

      fuse.setCollection(availableNotes)
      const results = fuse.search(query)

      if (results.length === 0) {
          clearSuggestion(view)
          return
      }

      const best = results[0] as any
      // Use name field instead of title for CloudItemMeta
      const noteTitle = best.item.name
      const noteId = best.item.id

      // Additional match logic: score must be low (good match) and
      // the title should somewhat start with or closely match the query.
      // We'll relax prefix match to just checking score to ensure we get results for testing.
      const isGoodMatch = (best.score !== undefined && best.score < 0.4)
      const isPrefixMatch = noteTitle.toLowerCase().startsWith(query.toLowerCase()) ||
                            noteTitle.toLowerCase().includes(query.toLowerCase())

      if (isGoodMatch && isPrefixMatch) {
        // Track the full matched query to accurately replace it when "Tab" is pressed
        const exactQuery = query;
        extensionThis.storage.currentSuggestion = { title: noteTitle, id: noteId, exactQuery }
        updateDecorations(view, noteTitle)
        view.dispatch(view.state.tr.setMeta(pluginKey, { decorationSet }))
      } else {
        clearSuggestion(view)
      }
    }, this.options.debounceMs || 150)

    const clearSuggestion = (view: any) => {
      extensionThis.storage.currentSuggestion = null
      updateDecorations(view, null)
      view.dispatch(view.state.tr.setMeta(pluginKey, { decorationSet }))
    }

    return [
      new Plugin({
        key: pluginKey,

        state: {
          init: () => ({ decorationSet: DecorationSet.empty }),
          apply(tr, old) {
            const meta = tr.getMeta(pluginKey)
            if (meta) return meta

            // If the document changes and we didn't explicitly update the decoration,
            // the ghost text is likely stale or invalid, so clear it.
            if (tr.docChanged && old.decorationSet !== DecorationSet.empty) {
                // Clear state synchronously here to prevent jumping ghost text
                extensionThis.storage.currentSuggestion = null
                return { decorationSet: DecorationSet.empty }
            }

            // Map the decorations through the transaction (for non-doc changes like selection)
            const mappedDecorationSet = old.decorationSet.map(tr.mapping, tr.doc)
            return { decorationSet: mappedDecorationSet }
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)?.decorationSet || DecorationSet.empty
          },

          handleKeyDown(view, event) {
            // Check if there is an active suggestion
            const suggestion = extensionThis.storage.currentSuggestion

            if (suggestion && event.key === 'Tab') {
                event.preventDefault()

                const { state } = view
                const { tr, selection } = state

                // Retrieve the exact matched query from the suggestion to avoid over-deleting
                const exactQuery = suggestion.exactQuery || ''

                const replaceFrom = selection.from - exactQuery.length

                const linkText = suggestion.title
                const linkId = suggestion.id

                // Create the text node with link mark
                const linkMark = state.schema.marks.link.create({
                    href: linkId,
                    target: '_self',
                    class: 'internal-wiki-link',
                })

                // Replace the query with the linked text safely
                tr.delete(replaceFrom, selection.from)
                tr.insertText(linkText, replaceFrom)
                tr.addMark(replaceFrom, replaceFrom + linkText.length, linkMark)
                // Add a space after the link
                tr.insertText(' ', replaceFrom + linkText.length)

                // Clear suggestion
                clearSuggestion(view)

                view.dispatch(tr)
                return true
            }

            // Clear suggestion on Escape
            if (event.key === 'Escape') {
              clearSuggestion(view)
              return false
            }

            // Trigger suggestion check on most keys
            if (event.key.length === 1 || event.key === 'Backspace') {
              // Defer checking until after state has updated
              setTimeout(() => checkForSuggestion(view), 0)
            } else if (event.key === 'Enter') {
                // Clear on enter
                 setTimeout(() => clearSuggestion(view), 0)
            }

            return false
          },
        },
      }),
    ]
  },
})
