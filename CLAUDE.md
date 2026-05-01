# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**cloud-notes** is a React + TypeScript Vite application — a client-side, offline-first note-taking app with a rich block-based editor (Tiptap), extensible plugin architecture, client-side AI features (via Web Worker), and bidirectional sync with a VPS backend. It supports multiple editing modes (rich editor, graph view, canvas, flashcards, task lists), music library management, and optional AES-GCM encryption.

## Development Commands

```bash
npm run dev           # Start dev server (Vite HMR enabled)
npm run build         # TypeScript compilation + Vite production build
npm run lint          # Run ESLint on all TS/TSX files
npm run preview       # Preview production build locally
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

## Testing & Verification

No test suite is currently set up. Verification scripts exist in `src/verification/` for specific features. Manual testing in the dev server is the primary method.

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

## Known Limitations & TODOs

- No built-in test framework; manual testing only.
- React Compiler is not enabled (impacts build performance).
- Relaxed ESLint rules; future refactor may tighten type checking.
- Web Worker AI has latency; long operations may block briefly.
