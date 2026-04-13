# Issues to Resolve

## ✅ DONE: Contabo Storage Manager Integration
The cloud_notes app is now integrated with contabo_storage_manager:

### Changes Made:
1. **Storage Manager Webhook Handler** (`contabo_storage_manager/packages/python-bridge/app/webhooks.py`)
   - Added `POST /webhook/notes` endpoint
   - Stores notes as JSON files in `notes/webhook/` directory
   - Also creates human-readable markdown exports in `notes/markdown/`
   - Supports HMAC signature verification

2. **Cloud Notes API Service** (`cloud_notes/src/services/api.ts`)
   - Updated to use `https://storage.noahcohn.com/webhook/notes` endpoint
   - Added HMAC signature generation for webhook authentication
   - Structured payloads with `source`, `event`, `timestamp`, and `data` fields
   - Encryption support for note content (client-side AES-GCM)
   - Offline sync support with pending operations queue

### Storage Flow:
```
cloud_notes app → POST /webhook/notes → Storage Manager
                                        ↓
                            ┌───────────┴───────────┐
                            ↓                       ↓
                    notes/webhook/*.json      notes/markdown/*.md
                    (structured data)        (human-readable)
```

### Next Steps:
- [ ] Test the integration with live storage manager
- [ ] Add webhook secret configuration UI in cloud_notes settings
- [ ] Implement note deletion webhook handler
- [ ] Add batch sync for offline operations

## Tiptap `listItem` hydration error on `createNote`
When using `ctx.createNote()` to create a note initialized with a Markdown string containing task lists (`- [ ]`), navigating to the new note causes `<BlockEditor>` to crash.
The browser console logs:
`Browser error: Invalid content for node listItem: <>`
`An error occurred in the <BlockEditor> component.`

This happens specifically during the `hydrating Yjs from API content` phase.
The issue seems to stem from how Tiptap/ProseMirror parses the empty space or checkbox in a newly instantiated editor when passed as a raw string compared to when it's inserted via an editor command (like `insertContent`).

**Current Workaround:**
The "Open Daily Note" global action in `src/plugins/daily.tsx` has been temporarily disabled with an alert instructing the user to use the `/daily template` slash command instead, which works perfectly.
