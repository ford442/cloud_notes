import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Fuse from 'fuse.js'
import type { CloudItemMeta } from '../../services/api'

export interface AutoLinkOptions {
  items: () => CloudItemMeta[];
  debounceMs?: number;
}

export const autoLinkPluginKey = new PluginKey('autoLink')

export const AutoLinkExtension = Extension.create<AutoLinkOptions>({
  name: 'autoLink',

  addOptions() {
    return {
      items: () => [],
      debounceMs: 500,
    }
  },

    addStorage() {
    return {
      active: false,
      matchText: '',
      note: null as CloudItemMeta | null,
      from: 0,
      to: 0,
      debounceTimer: null as ReturnType<typeof setTimeout> | null,
      fuseInstance: null as Fuse<CloudItemMeta> | null,
      availableNotes: [] as CloudItemMeta[],
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: autoLinkPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, old) => {
            const meta = tr.getMeta(autoLinkPluginKey)
            if (meta && meta.decorations !== undefined) {
              return meta.decorations
            }
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { active, from, to, note } = this.storage
        if (!active || !note) return false

        this.editor
          .chain()
          .deleteRange({ from, to })
          .insertContent(`[[${note.name || ""}]] `)
          .run()

        this.storage.active = false
        this.storage.note = null
        this.editor.view.dispatch(
          this.editor.state.tr.setMeta(autoLinkPluginKey, { decorations: DecorationSet.empty })
        )

        return true
      },
      Escape: () => {
        if (this.storage.active) {
            this.storage.active = false
            this.storage.note = null
            this.editor.view.dispatch(
              this.editor.state.tr.setMeta(autoLinkPluginKey, { decorations: DecorationSet.empty })
            )
            return true;
        }
        return false
      },
    }
  },

  onSelectionUpdate() {
      if (this.storage.active) {
          this.storage.active = false
          this.storage.note = null
          this.editor.view.dispatch(
              this.editor.state.tr.setMeta(autoLinkPluginKey, { decorations: DecorationSet.empty })
          )
      }
  },

  onUpdate() {
    const { selection } = this.editor.state

    // Always clear suggestion when typing
    if (this.storage.active) {
        this.storage.active = false
        this.storage.note = null
        this.editor.view.dispatch(
            this.editor.state.tr.setMeta(autoLinkPluginKey, { decorations: DecorationSet.empty })
        )
    }

    if (this.storage.debounceTimer) {
      clearTimeout(this.storage.debounceTimer)
    }

    if (!selection.empty) return

    this.storage.debounceTimer = setTimeout(() => {
      const { $head } = this.editor.state.selection

      const textBefore = $head.parent.textBetween(
          Math.max(0, $head.parentOffset - 50),
          $head.parentOffset,
          undefined,
          '\ufffc'
      )


      if (textBefore.includes('[[') && !textBefore.includes(']]')) return;

      const words = textBefore.split(/\s+/).filter(Boolean);
      if (words.length === 0) return;

      const availableNotes = this.storage.availableNotes;

      if (!availableNotes || availableNotes.length === 0) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!this.storage.fuseInstance || (this.storage.fuseInstance as any)._docs !== availableNotes) {
         this.storage.fuseInstance = new Fuse(availableNotes, {
             keys: ['name'],
             threshold: 0.4,
             includeScore: true,
             ignoreLocation: true
         })
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         ;(this.storage.fuseInstance as any)._docs = availableNotes;



      }

      let bestMatch = null;
      let usedQuery = "";

      for (let i = 1; i <= Math.min(3, words.length); i++) {
          const testQuery = words.slice(-i).join(' ').trim();
          if (testQuery.length < 3) continue;

          const results = this.storage.fuseInstance.search(testQuery);
            if (results.length > 0) {
                }

          if (results.length > 0 && results[0].score! < 0.4) {
              if (!bestMatch || results[0].score! < bestMatch.score!) {
                  bestMatch = results[0];
                  usedQuery = testQuery;
              }
          }
      }


      if (bestMatch) {
         const typedLower = usedQuery.toLowerCase();
         const noteNameLower = (bestMatch.item.name || "").toLowerCase();

         const isGoodMatch = bestMatch.score! < 0.4;



         const isPrefixMatch = noteNameLower.startsWith(typedLower);
         const isWordMatch = noteNameLower.includes(typedLower) && typedLower.length > 3;


         if (isGoodMatch && (isPrefixMatch || isWordMatch || bestMatch.score! < 0.25)) {
             // Find the actual typed text in the doc to determine exactly how many characters to replace
             const regex = new RegExp(usedQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "\\s*$");
             const match = textBefore.match(regex);

             const actualMatchLength = match ? match[0].length : usedQuery.length;

             const from = $head.pos - actualMatchLength;
             const to = $head.pos;


             const ghostText = document.createElement('span')
             ghostText.className = 'text-slate-400 dark:text-slate-500 opacity-60 pointer-events-none select-none italic ml-1'
             ghostText.textContent = `Tab to link ⚡ ${bestMatch.item.name || ""}`

             const dec = Decoration.widget(to, ghostText, { side: 1 })

             this.storage.active = true;
             this.storage.matchText = usedQuery;
             this.storage.note = bestMatch.item;
             this.storage.from = from;
             this.storage.to = to;

             this.editor.view.dispatch(
                 this.editor.state.tr.setMeta(autoLinkPluginKey, { decorations: DecorationSet.create(this.editor.state.doc, [dec]) })
             )
         }
      }
    }, this.options.debounceMs || 500)
  },

  onDestroy() {
      if (this.storage.debounceTimer) {
          clearTimeout(this.storage.debounceTimer)
      }
  }
})
