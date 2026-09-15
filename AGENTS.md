# cloud-notes — Agent Guide

This document is written for AI coding agents. It assumes you know nothing about the project. All information is derived directly from the codebase.

---

## Project Overview

`cloud-notes` is a client-side, block-based note-taking application built with React and TypeScript. It features a rich Tiptap editor, an extensible plugin system, client-side AI (via Transformers.js in a Web Worker), offline-first storage with IndexedDB, and bidirectional sync with a remote VPS backend (`contabo_storage_manager`).

Key capabilities:
- **Block-based rich editing** via Tiptap (ProseMirror) with slash commands, wiki-links, task lists, tables, Excalidraw embeds, audio nodes, and YouTube embeds.
- **Plugin architecture** with 14 built-in plugins (AI, canvas, daily notes, flashcards, focus mode, tasks, E2EE, etc.).
- **Offline-first sync**: IndexedDB caches notes locally; a pending-operations queue replays create/update/delete actions when the network returns.
- **Client-side AI**: Summarization, auto-tagging, semantic embeddings, text generation, and audio transcription run in a Web Worker using `@xenova/transformers`.
- **Client-side encryption**: Optional AES-GCM encryption with PBKDF2 key derivation; the key is stored in `localStorage`.
- **Graph view**: Visualize note relationships with `react-force-graph-2d`.
- **Music library management**: FLAC library, playlist, and MOD song views.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 (StrictMode) + TypeScript 5.9 |
| Build Tool | Vite 7 (`base: './'`) |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Editor | Tiptap 3.x (StarterKit, TaskList, Table, Image, Link, Youtube, Collaboration, Placeholder, Suggestion) |
| Collaboration / Offline | Yjs + `y-indexeddb` |
| AI / ML | `@xenova/transformers` (ONNX Runtime, runs in a Web Worker) |
| Search | Fuse.js (client-side fuzzy search) |
| Graph | `react-force-graph-2d` |
| Canvas | `@excalidraw/excalidraw` |
| State | React hooks (`useState`, `useEffect`, `useRef`); no external state library |
| Local DB | IndexedDB (custom wrapper in `src/utils/db.ts`) |
| Bundler Config | `vite.config.ts` uses `@vitejs/plugin-react` and `@tailwindcss/vite` |

---

## Directory Structure

```
cloud-notes/
├── src/
│   ├── components/           # React UI components
│   │   ├── editor/           # Tiptap editor extensions & UI
│   │   ├── BlockEditor.tsx   # Main rich/block editor
│   │   ├── Editor.tsx        # Simple textarea editor
│   │   ├── Sidebar.tsx       # Note list sidebar
│   │   ├── CommandPalette.tsx
│   │   ├── SearchModal.tsx
│   │   ├── GraphView.tsx
│   │   ├── CanvasEditor.tsx
│   │   ├── FlashcardView.tsx
│   │   ├── TaskView.tsx
│   │   ├── MusicLibraryView.tsx
│   │   ├── PlaylistView.tsx
│   │   ├── ModSongsView.tsx
│   │   ├── NamedNotesBrowser.tsx
│   │   ├── PresetsPanel.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── HistoryModal.tsx
│   │   ├── Backlinks.tsx
│   │   ├── RelatedNotes.tsx
│   │   ├── Toast.tsx
│   │   └── Dialog.tsx
│   ├── services/             # Core application services
│   │   ├── api.ts            # StorageService: offline sync, webhooks, named notes API
│   │   ├── vpsStorageAPI.ts  # Thin adapter for VPS named notes REST endpoints
│   │   ├── ai.ts             # Worker proxy for AI requests
│   │   ├── ai.worker.ts      # Web Worker that runs transformers.js pipelines
│   │   ├── plugin.ts         # PluginRegistry singleton
│   │   ├── semantic.ts       # Semantic search indexing
│   │   └── presetsAPI.ts     # Preset management
│   ├── plugins/              # Built-in plugins
│   │   ├── core.tsx          # Aggregates all built-in plugins
│   │   ├── ai.tsx
│   │   ├── canvas.tsx
│   │   ├── cluster.tsx
│   │   ├── daily.tsx
│   │   ├── e2e.tsx
│   │   ├── flashcards.tsx
│   │   ├── focus.tsx
│   │   ├── music.tsx
│   │   ├── readwise.tsx
│   │   ├── tasks.tsx
│   │   ├── templates.tsx
│   │   └── voice.tsx
│   ├── utils/                # Utilities
│   │   ├── db.ts             # IndexedDB wrapper
│   │   ├── encryption.ts     # AES-GCM encryption/decryption
│   │   ├── serialization.ts  # Markdown <-> HTML conversion
│   │   ├── metadata.ts       # Pack note metadata into description strings
│   │   ├── backlinks.ts      # Backlink parsing
│   │   ├── media.ts          # Image processing (webp conversion)
│   │   ├── keywords.ts       # Keyword extraction
│   │   ├── flac.ts           # FLAC metadata helpers
│   │   └── crypto.ts         # General crypto helpers
│   ├── types/                # Additional type declarations
│   ├── assets/               # Static assets
│   ├── App.tsx               # Root application component
│   ├── main.tsx              # React entry point
│   ├── index.css             # Tailwind imports, custom styles
│   └── App.css               # Component-scoped styles
├── e2e/                      # Playwright smoke suite (npm test)
│   ├── fixtures.ts           # Mocks the VPS notes host and GCS for hermetic runs
│   └── smoke.spec.ts         # 10 smokes across the major surfaces
├── verification/             # Standalone Python/Playwright script (RAG chat only)
├── scripts/deploy.sh         # Build + rsync dist/ to the VPS (env-driven, no secrets in repo)
├── .github/workflows/        # ci.yml (lint/build/smokes), deploy.yml (manual ship)
├── public/                   # Vite public assets
├── dist/                     # Production build output
├── package.json
├── playwright.config.ts
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json / tsconfig.e2e.json
├── eslint.config.js
└── index.html
```

---

## Build and Development Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build: typechecks src/, vite.config.ts and e2e/, then builds to dist/
npm run build

# Lint with ESLint
npm run lint

# Preview production build locally
npm run preview

# Playwright smoke suite (boots the dev server itself)
npm test
```

Custom script:
```bash
npm run index-mods   # Runs python scripts/index_mods.py in ../contabo_storage_manager
```

---

## Code Style Guidelines

### TypeScript
- **Strict mode enabled**: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`.
- Use `import type` for type-only imports (`verbatimModuleSyntax: true`).
- JSX transform: `react-jsx`.

### ESLint
- Config in `eslint.config.js` uses `@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`.
- **Relaxed rules** (do not tighten without explicit request):
  - `@typescript-eslint/no-explicit-any`: **off**
  - `@typescript-eslint/no-unused-vars`: **off**
  - `react-hooks/exhaustive-deps`: **off**
  - `react-hooks/rules-of-hooks`: **off**
  - `react-hooks/set-state-in-effect`: **off**
  - `react-hooks/purity`: **off**
- `react-refresh/only-export-components`: warn, `allowConstantExport: true`.

### React Patterns
- **React 19 StrictMode**.
- Heavy components are **lazy-loaded** in `App.tsx` via `React.lazy()` + `Suspense`.
- State via `useState`/`useEffect`/`useRef`. `useRef` is used heavily to avoid stale closures in plugin callbacks.
- Toast notifications use `ToastProvider` / `useToast` context.

### Styling
- Tailwind CSS v4 with `@import "tailwindcss"`.
- Dark mode toggled by adding/removing the `.dark` class on a wrapper.
- Custom CSS in `src/index.css` for scrollbars, Tiptap task lists, and placeholder pseudo-elements.

---

## Plugin System

- `PluginRegistry` (`src/services/plugin.ts`) is a singleton.
- Each plugin implements `{ id, name, init(context) }`.
- `App.tsx` registers plugins on mount:
  ```ts
  PluginRegistry.registerAll(CorePlugins);
  PluginRegistry.register(MusicPlugin);
  ```
- `PluginContext` exposes:
  - `registerCommand` / `registerCommandProvider` — slash commands
  - `registerAction` — Command Palette actions
  - `getCurrentNote` / `getAllNotes` / `updateNote` / `createNote` / `navigateTo`
  - `setMode` / `setFocusMode`
  - `alert` / `confirm` / `prompt`

### Adding a new plugin
1. Create `src/plugins/my-plugin.tsx` exporting a `Plugin` object.
2. Import it in `src/plugins/core.tsx` and add to `CorePlugins` (or register directly in `App.tsx`).

---

## Storage & Sync Architecture

### Backends
- **Primary**: `contabo_storage_manager` VPS at `https://storage.noahcohn.com`.
- There is no in-repo backend. The VPS service lives in the separate
  `contabo_storage_manager` project; this repo only consumes its HTTP API.

### VPS API Endpoints
- `GET /api/notes/list`
- `POST /api/notes/write/:name` — body `{ content }`
- `GET /api/notes/read/:name`
- `DELETE /api/notes/delete/:name`
- `POST /webhook/notes` — structured events with optional HMAC signature

### Offline-First Flow
1. Note metadata cached in IndexedDB (`STORE_NOTES_LIST`).
2. Note content cached in IndexedDB (`STORE_NOTES_CONTENT`).
3. Offline operations stored as `PendingOp` in `STORE_PENDING_OPS`.
4. On `online` or explicit sync, `StorageService.syncPending()` replays:
   - Consolidates ops per note.
   - Maps temporary offline IDs to real server IDs.
   - Dispatches batch webhooks.
5. UI updates optimistically; network calls are backgrounded.

### VPS Sync (`syncWithVps`)
- Compares local vs remote by `updated_at` timestamp.
- Pulls newer remote notes; pushes newer local notes.
- Reports pulled/pushed counts and errors.

---

## Testing Strategy

- **No unit test runner** (Jest/Vitest) is installed.
- **`npm test`** runs the Playwright smoke suite in `e2e/`. Playwright starts the dev
  server itself, so no second terminal is needed.
- On a fresh machine, install the browser once with
  `npx playwright install --with-deps chromium`. CI already does this in
  `.github/workflows/ci.yml`.
- The suite is hermetic: `e2e/fixtures.ts` intercepts every request to the VPS notes host
  and to Google Cloud Storage and answers from an in-memory store. No credentials, no
  outbound network. Keep it that way when adding smokes.
- Current coverage (`e2e/smoke.spec.ts`): app shell + rich editor mount, note list from the
  VPS, create/save, command palette (`Cmd/Ctrl+K`), sync success toast, sync failure toast,
  AES-GCM encrypt/decrypt round trip, effects media panel, RAG chat (`Cmd/Ctrl+J`), graph view.
- Run one smoke with `npx playwright test -g "command palette"`; run against the production
  build with `E2E_USE_PREVIEW=1 E2E_PORT=4173 npm test`.
- `verification/verify_rag_chat.py` is the one remaining standalone Python/Playwright
  script. Start `npm run dev` first, then `python verification/verify_rag_chat.py`.
  Prefer adding new coverage to `e2e/` in TypeScript rather than new Python scripts.

---

## Security Considerations

- **Never commit deployment credentials.** `scripts/deploy.sh` reads host, user, path and
  SSH key from the environment only, and writes the key to a `mktemp -d` directory that is
  removed on exit. In CI they come from repository secrets. An earlier `deploy.py` with a
  hardcoded SFTP password was deleted — do not reintroduce that pattern.
- **Client-side encryption**: AES-GCM-256 + PBKDF2 (100k iterations). Key password stored in `localStorage` under `cloud_notes_encryption_key`.
- **Webhook signatures**: HMAC-SHA-256 via `X-Signature-256` header when `webhook_secret` is set in `localStorage`.

---

## Deployment

`npm run build` emits a fully static `dist/` (`base: './'`, so it works from any
subdirectory). [`scripts/deploy.sh`](scripts/deploy.sh) builds and rsyncs it over SSH:

```bash
DEPLOY_HOST=your.host DEPLOY_USER=deploy DEPLOY_PATH=/var/www/notes ./scripts/deploy.sh
```

- Required: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`.
- Optional: `DEPLOY_PORT`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SKIP_BUILD`,
  `DEPLOY_DRY_RUN`.
- `.github/workflows/deploy.yml` runs the same script on `workflow_dispatch` with those
  values supplied as repository secrets.
- Always do a `DEPLOY_DRY_RUN=1` pass first — the sync uses `--delete`.

---

## Useful LocalStorage Keys

| Key | Purpose |
|-----|---------|
| `api_url` | Override VPS base URL |
| `webhook_secret` | HMAC secret for webhooks |
| `author_name` | Default author name |
| `cloud_notes_encryption_key` | Auto-generated encryption password |

---

## Common Pitfalls for Agents

1. **No unit test runner exists.** Verification is Playwright-only (`npm test`).
2. **Keep the smokes hermetic.** Never let a test depend on the real VPS or GCS being up;
   extend the mocks in `e2e/fixtures.ts` instead.
3. **ESLint is intentionally permissive.** `any` is allowed; hooks rules are off.
4. **Offline logic is pervasive.** Changes to `StorageService` must consider pending ops and optimistic cache updates.
5. **Plugin context uses refs.** `App.tsx` passes getter functions to avoid stale closures.
6. **Editor changes need serialization updates.** Modify both `src/components/editor/` and `src/utils/serialization.ts` for Markdown round-trip.
7. **Web Crypto APIs require secure context** (HTTPS or localhost).
