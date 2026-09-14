# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**cloud-notes** is a React + TypeScript Vite application — a client-side, offline-first note-taking app with a rich block-based editor (Tiptap), extensible plugin architecture, client-side AI features (via Web Worker), and bidirectional sync with a VPS backend. It supports multiple editing modes (rich editor, graph view, canvas, flashcards, task lists), music library management, and optional AES-GCM encryption.

## Development Commands

```bash
npm run dev           # Start dev server (Vite HMR enabled)
npm run build         # Typecheck src/, vite.config.ts and e2e/, then Vite production build
npm run lint          # Run ESLint on all TS/TSX files
npm run preview       # Preview production build locally
npm test              # Playwright smoke suite (starts the dev server itself)
npm run test:ui       # Playwright interactive UI mode
npm run index-mods    # Index mods (runs Python script in sibling contabo_storage_manager)
```

To run a single file/glob through linting:
```bash
npx eslint src/components/MyComponent.tsx
```

## Architecture Overview

### Core Layers

1. **App.tsx** — Root component; manages global state (notes list, selected note, editor mode, dialogs, theme). Lazy-loads heavy components (GraphView, CanvasEditor, etc.) via React.lazy().

2. **Services** — Core application logic:
   - `api.ts` (StorageService) — Offline-first storage with IndexedDB, pending-operation queue for sync, webhooks
   - `ai.ts` / `ai.worker.ts` — Client-side AI via `@xenova/transformers` (summarization, tagging, embeddings, transcription) in a Web Worker
   - `semantic.ts` — Semantic search indexing
   - `plugin.ts` (PluginRegistry) — Plugin registration and lifecycle management
   - `presetsAPI.ts` — Preset management

3. **Components** — React UI:
   - `Sidebar.tsx` — Note navigation / list
   - `BlockEditor.tsx` — Rich Tiptap editor with slash commands
   - `Editor.tsx` — Simple plain-text editor fallback
   - Multiple specialized views: GraphView, CanvasEditor, FlashcardView, TaskView, MusicLibraryView, PlaylistView, etc.
   - Modal/dialog components: CommandPalette, SearchModal, SettingsModal, HistoryModal, Backlinks, RelatedNotes, Toast, Dialog

4. **Plugins** — Extensible plugin system (PluginRegistry):
   - Built-in plugins in `src/plugins/core.tsx` (aggregates AI, canvas, daily notes, flashcards, focus mode, E2E, music, readwise, tasks, templates, voice, cluster plugins)
   - Each plugin registers commands, event handlers, and UI extensions
   - Plugins communicate via PluginRegistry callbacks

5. **Utils** — Shared utilities:
   - `db.ts` — IndexedDB wrapper with note storage/retrieval
   - `encryption.ts` — AES-GCM encryption/decryption with PBKDF2
   - `serialization.ts` — Markdown ↔ HTML conversion (Turndown + marked)
   - `metadata.ts` — Pack/unpack note metadata into description strings
   - `backlinks.ts` — Wiki-link parsing and backlink resolution
   - `media.ts` — Image processing (WebP conversion)
   - `keywords.ts` — Keyword extraction
   - `crypto.ts` — General crypto helpers

### Key Patterns

**State Management**: React hooks only (`useState`, `useRef`, `useEffect`). No Redux/Zustand. Global state lives in App.tsx and is passed down or accessed via context (e.g., ToastProvider, PluginRegistry).

**Async Operations**: Prefer async/await. Pending operations (create/update/delete) are queued in StorageService and replayed when the network returns.

**Error Handling**: Use toast notifications for user-facing errors (`useToast().addToast()`). Log to console for debugging.

**Component Code Splitting**: Heavy views (GraphView, CanvasEditor, FlashcardView, etc.) are lazy-loaded at the route level in App.tsx. Use React.lazy() and Suspense.

**Data Types**: Core types (Note, CloudItemMeta) are in `src/services/api.ts`. Keep type definitions close to where they're used; avoid type-only imports for widely-reused types.

**Editor Integration**: Tiptap extensions live in `src/components/editor/` and are configured in BlockEditor.tsx. Extensions use ProseMirror plugins for custom behavior (slash commands, suggestions, etc.).

**Offline Sync**: StorageService maintains a local note cache in IndexedDB and queues mutations. On network reconnect, the queue is replayed. See `api.ts` for sync logic.

## Build & Runtime Notes

- **Vite config**: `base: './'` for relative asset paths (works in any deployment folder).
- **React Fast Refresh**: Enabled via `@vitejs/plugin-react`.
- **Tailwind CSS v4**: Compiled via `@tailwindcss/vite` plugin.
- **Transformers.js**: Runs in a Web Worker (`ai.worker.ts`) to avoid blocking the UI.
- **ESLint**: Relaxed rules (no unused vars, no explicit any checks, relaxed React Hooks rules) to allow rapid development. See `eslint.config.js`.
- **Cross-origin isolation**: COOP/COEP headers are wired into `vite.config.ts` but are off
  by default, because `require-corp` blocks cross-origin subresources this app does not
  control (VPS media URLs, the public GCS bucket, Hugging Face model weights, Excalidraw
  assets). Opt in for local WASM measurement with `VITE_CROSS_ORIGIN_ISOLATED=1 npm run dev`;
  the default single-threaded WASM path is the fallback.

## Testing & Verification

There is no unit test runner. `npm test` runs a Playwright smoke suite from `e2e/`:

- `e2e/smoke.spec.ts` — 10 smokes: app shell + rich editor mount, note list from the VPS,
  create/save a note, command palette (`Cmd/Ctrl+K`), sync success toast, sync failure
  toast, AES-GCM encrypt/decrypt round trip, effects media panel, RAG chat (`Cmd/Ctrl+J`),
  graph view.
- `e2e/fixtures.ts` — mocks the VPS notes host and the Google Cloud Storage JSON API so the
  suite is hermetic: no credentials, no outbound network. **Keep new smokes that way** —
  extend the mocks rather than reaching for the real services.
- Playwright's `webServer` boots Vite, so no second terminal is needed. Run a single smoke
  with `npx playwright test -g "command palette"`, or run everything against the production
  build with `E2E_USE_PREVIEW=1 E2E_PORT=4173 npm test`.

`verification/verify_rag_chat.py` is a standalone Python/Playwright script for the RAG chat
flow and needs `npm run dev` running. Prefer adding TypeScript smokes under `e2e/`.

CI (`.github/workflows/ci.yml`) runs lint, build and the smokes on every pull request.

## Type Safety

- TypeScript 5.9 with strict mode (check `tsconfig.app.json`).
- No strict null checks in some files (intentional for flexibility).
- `@typescript-eslint` for linting; some rules are disabled (see eslint.config.js).

## Git & Collaboration

- Yjs is integrated for potential collaborative editing (y-indexeddb).
- Currently used for offline storage and synchronization, not real-time collaboration.
- Pending operations in StorageService enable offline-first UX.

## Adding New Features

1. **New UI View**: Create a component in `src/components/`, lazy-load it in App.tsx, add a mode case in `editorMode`.
2. **New Service**: Add to `src/services/` and expose via App context or PluginRegistry.
3. **New Plugin**: Create in `src/plugins/`, register in `CorePlugins` or manually in App.tsx. Implement command/event handlers via PluginRegistry.
4. **Storage**: Use `StorageService.getInstance()` to read/write notes. Mutations are automatically queued and synced.
5. **Styling**: Use Tailwind classes. Add custom CSS in component files (scoped CSS-in-JS or .css files alongside components).

## Deployment

`npm run build` emits a static `dist/` (`base: './'`, so it works from any subdirectory).
`scripts/deploy.sh` builds and rsyncs it over SSH, reading everything from the environment:

```bash
DEPLOY_HOST=your.host DEPLOY_USER=deploy DEPLOY_PATH=/var/www/notes ./scripts/deploy.sh
```

Optional: `DEPLOY_PORT`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SKIP_BUILD`,
`DEPLOY_DRY_RUN`. The sync uses `--delete`, so do a `DEPLOY_DRY_RUN=1` pass first.
`.github/workflows/deploy.yml` runs the same script on `workflow_dispatch` with repository
secrets. **Never commit deployment credentials.**

## Known Limitations & TODOs

- No unit test framework; coverage is the Playwright smoke suite plus manual testing.
- React Compiler is not enabled (impacts build performance).
- Relaxed ESLint rules; future refactor may tighten type checking.
- Several bundle chunks exceed 500 kB; `vite build` warns about this.
- Web Worker AI has latency; long operations may block briefly.
