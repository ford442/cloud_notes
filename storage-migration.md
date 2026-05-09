# Storage Backend Migration: Hugging Face to Contabo VPS

## Overview
The `cloud_notes` application has successfully migrated its primary storage backend from the Hugging Face space to a self-hosted Contabo VPS (`https://storage.noahcohn.com`).

## Why We Migrated
- **Performance & Reliability:** Moving to a dedicated VPS provides more consistent uptime, faster response times, and eliminates cold starts typical of serverless or shared ML space deployments.
- **Data Integrity & Security:** Hosting the storage backend on a personal VPS allows for full control over the data lifecycle, better security configurations, and direct integration with webhook signatures (HMAC) for authenticated requests.
- **Architectural Flexibility:** The new storage manager acts as a python bridge that allows saving notes as JSON while automatically rendering a markdown export.

## Key Technical Changes

### 1. API Base URL Updates
The default storage endpoint URL was changed globally:
- **Old:** Hugging Face Space URL.
- **New:** `https://storage.noahcohn.com`

This change was reflected across multiple service files:
- `src/services/api.ts`
- `src/services/presetsAPI.ts`
- `src/services/vpsStorageAPI.ts`
- `src/services/songsAPI.ts`
- `src/services/texturesAPI.ts`
- `src/utils/flac.ts`

*Note: The frontend allows overriding this via the `localStorage` key `'api_url'`, configurable in the **SettingsModal** (Data Tab).*

### 2. Webhook Integration (Dual-Write Bridge)
The migration implements a **Dual-Write Bridge Pattern** in `src/services/api.ts` to ensure data continuity during the transition.
- **Legacy Path:** Synchronous saves to `/api/notes/write/` are maintained.
- **New Webhook Path:** An asynchronous, fire-and-forget payload is dispatched to `/webhook/notes` (`_dispatchWebhook`).
- **Security:** Webhook payloads are secured using an HMAC signature generated from a `webhook_secret` (configurable in the Integrations tab of Settings).

### 3. Server-Side Processing
On the Contabo VPS side (handled by `contabo_storage_manager/packages/python-bridge/app/webhooks.py`):
- Incoming webhook requests are verified via HMAC.
- Notes are stored structurally as JSON in `notes/webhook/`.
- The manager automatically generates a human-readable markdown export in `notes/markdown/`.

### 4. Sync & Offline Queuing
The application maintains robust offline capabilities:
- Changes made while offline are queued in IndexedDB (`STORE_PENDING_OPS`).
- Upon reconnection, pending operations (creates, updates, deletes) are batched and dispatched via `_dispatchBatchWebhook`.

## Next Steps & Maintenance
- **Deprecation of Legacy Endpoints:** Eventually, the legacy `/api/notes/write/` endpoint calls can be removed once the webhook architecture is fully validated and considered the single source of truth.
- **Data Consistency Verification:** Continue monitoring the sync mechanism (`syncWithVps`) to ensure local states accurately match the VPS storage.
- **E2E Testing:** Playwright tests should use the new mock URLs or a dedicated test environment pointing to the new API base URL.
