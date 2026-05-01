# Copilot instructions for `cloud-notes`

## Build, lint, and verification

- `npm run dev` starts the Vite app on `http://localhost:5173`.
- `npm run build` runs `tsc -b && vite build`.
- `npm run lint` runs `eslint .`.
- There is no Jest/Vitest test runner in this repo. UI verification is done with Playwright-based Python scripts in `verification/`, and those scripts hardcode `http://localhost:5173`, so start `npm run dev` first.
- Run a single verification script with `python verification/verify_sync.py`. Other targeted checks follow the same pattern, for example `python verification/verify_e2ee.py`, `python verification/verify_ai_commands.py`, or `python verification/verify_block_menu.py`.
- For Copilot cloud-agent sessions, Playwright MCP is already available by default and is limited to `localhost` / `127.0.0.1`, which matches this repo's verification flow.

## High-level architecture

- `src/App.tsx` is the application orchestrator. It owns note list state, the selected note, editor mode switching, dialogs/toasts, lazy loading of heavyweight views, and registration of built-in plugins through `PluginRegistry`.
- `src/services/api.ts` is the core storage layer. It combines cache-first reads, optimistic local updates, offline queuing for create/update/delete, replay of pending operations on reconnect, webhook dispatch, and the named-notes VPS API. IndexedDB stores are defined in `src/utils/db.ts`.
- The rich editor path is split between `src/components/BlockEditor.tsx` and `src/utils/serialization.ts`. The editor uses Tiptap extensions plus Yjs IndexedDB persistence, but notes are still stored and synced as Markdown, so content must round-trip through the serialization helpers.
- AI features are client-side. `src/services/ai.ts` proxies requests into `src/services/ai.worker.ts`, where Transformers.js pipelines run inside a Web Worker. `src/services/semantic.ts` stores embeddings in IndexedDB and computes related-note matches locally.
- The note list, graph view, backlinks, related notes, and link suggestions all depend on note metadata encoded into `CloudItemMeta.description`, not on loading full note bodies.

## Key conventions

- `CloudItemMeta.description` is a packed metadata string in the format `Subject ::: Section ::: Tags ::: Links ::: Keywords`. Preserve that shape when changing note metadata, sidebar grouping, graph edges, backlinks, or search helpers.
- A selected note is only updated in place if its title still matches the original note name. If the user changes the title, save behavior becomes "create a new note / save as copy" because note names are the server-side identifiers.
- Plugin features should be added through `PluginRegistry` and the plugin context API (`registerCommand`, `registerAction`, `updateNote`, `navigateTo`, `setMode`, etc.). `App.tsx` wires these callbacks through refs to avoid stale closures; follow that pattern instead of reaching into component state directly.
- Changes to editor capabilities usually need updates in more than one place: the Tiptap extension/component code and the Markdown/HTML conversion rules in `src/utils/serialization.ts`.
- Sync-related edits must preserve optimistic IndexedDB updates, pending-op replay, and temporary offline IDs. Do not treat `StorageService` as a simple CRUD wrapper.
- `api_updated.py` is legacy and should not be used for current storage or deployment work; the active integration is the VPS named-notes API used by `StorageService`.
