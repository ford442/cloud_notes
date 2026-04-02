# Issues to Resolve

## Tiptap `listItem` hydration error on `createNote`
When using `ctx.createNote()` to create a note initialized with a Markdown string containing task lists (`- [ ]`), navigating to the new note causes `<BlockEditor>` to crash.
The browser console logs:
`Browser error: Invalid content for node listItem: <>`
`An error occurred in the <BlockEditor> component.`

This happens specifically during the `hydrating Yjs from API content` phase.
The issue seems to stem from how Tiptap/ProseMirror parses the empty space or checkbox in a newly instantiated editor when passed as a raw string compared to when it's inserted via an editor command (like `insertContent`).

**Current Workaround:**
The "Open Daily Note" global action in `src/plugins/daily.tsx` has been temporarily disabled with an alert instructing the user to use the `/daily template` slash command instead, which works perfectly.

## Tiptap `listItem` hydration error on `createNote`
When using `ctx.createNote()` to create a note initialized with a Markdown string containing task lists (`- [ ]`), navigating to the new note causes `<BlockEditor>` to crash.
The browser console logs:
`Browser error: Invalid content for node listItem: <>`
`An error occurred in the <BlockEditor> component.`

This happens specifically during the `hydrating Yjs from API content` phase.
The issue seems to stem from how Tiptap/ProseMirror parses the empty space or checkbox in a newly instantiated editor when passed as a raw string compared to when it's inserted via an editor command (like `insertContent`).

**Current Workaround:**
The "Open Daily Note" global action in `src/plugins/daily.tsx` has been temporarily disabled with an alert instructing the user to use the `/daily template` slash command instead, which works perfectly.
