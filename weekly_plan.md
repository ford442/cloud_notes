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
- [x] Test the integration with live storage manager
- [x] Add webhook secret configuration UI in cloud_notes settings
- [x] Implement note deletion webhook handler
- [x] Add batch sync for offline operations

## ✅ DONE: Tiptap `listItem` hydration error on `createNote`
- Fix implemented in `src/utils/serialization.ts` (empty content -> `&nbsp;` injection).
- Added an extra safety guard to ensure `token.tokens` iterable checks prevent runtime crashes for unexpectedly undefined token states.
- Tested and confirmed working; crash cannot be reproduced.
