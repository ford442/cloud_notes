# Copilot instructions for `cloud-notes`

## Build, lint, and verification

- `npm run dev` starts the Vite app on `http://localhost:5173`.
- `npm run build` typechecks `src/`, `vite.config.ts` and `e2e/`, then runs `vite build` into `dist/`.
- `npm run lint` runs `eslint .`.
- There is no Jest/Vitest test runner in this repo. `npm test` runs a Playwright smoke suite from `e2e/`; Playwright starts the Vite dev server itself, so you do not need to run `npm run dev` first.
- On a fresh machine, install the browser once with `npx playwright install --with-deps chromium`. CI already does this in `.github/workflows/ci.yml`.
- The smokes are hermetic — `e2e/fixtures.ts` intercepts every call to the VPS notes host and to Google Cloud Storage and answers from an in-memory store, so no credentials or outbound network access are needed. Keep new smokes that way.
- Run one smoke with `npx playwright test -g "command palette"`, or the whole suite against the production build with `E2E_USE_PREVIEW=1 E2E_PORT=4173 npm test`.
- `verification/` holds a single standalone Python/Playwright script, `verify_rag_chat.py`, which hardcodes `http://localhost:5173` and needs `npm run dev` running. Prefer adding TypeScript smokes under `e2e/` over new Python scripts.
- CI (`.github/workflows/ci.yml`) runs lint, build and the smokes on every pull request.
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
- There is no backend or deployment code in this repo beyond `scripts/deploy.sh`; the active integration is the VPS named-notes API used by `StorageService`, served by the separate `contabo_storage_manager` project.
- Deployment is `scripts/deploy.sh` — it builds and rsyncs `dist/` over SSH, reading `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` and optional SSH credentials from the environment. Never hardcode credentials in this repo; CI supplies them as repository secrets.
