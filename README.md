# cloud-notes

An offline-first, client-side note-taking app built with React 19, TypeScript and Vite.

Notes are written in a block-based rich editor (Tiptap), stored locally in IndexedDB, and
synced to a VPS notes host. AI features — summarisation, auto-tagging, embeddings, local
RAG chat — run entirely in the browser in a Web Worker via Transformers.js. Note bodies
are encrypted with AES-GCM before they leave the device.

## Features

| Surface | What it does |
|---|---|
| Rich editor | Tiptap block editor with slash commands, tables, code blocks, task lists, wiki-links |
| Simple editor | Plain Markdown textarea fallback |
| Graph view | Force-directed graph of notes linked by `[[wiki-links]]` |
| Canvas | Excalidraw whiteboard attached to a note |
| Flashcards | Spaced-repetition review over note content |
| Tasks | Aggregated task list across all notes |
| Second Brain Q&A | Local RAG chat over your own notes (`Cmd/Ctrl+J`) |
| Music / Presets / Textures / Effects | Media library panels backed by the VPS and a public GCS bucket |
| Encryption | AES-GCM-256 + PBKDF2, key held in `localStorage` |

## Getting started

Requires Node 20+.

```bash
npm ci
npm run dev          # http://localhost:5173
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR on port 5173 |
| `npm run build` | Typechecks `src/`, `vite.config.ts` and `e2e/`, then builds to `dist/` |
| `npm run lint` | ESLint over all `.ts`/`.tsx` |
| `npm run preview` | Serve the production build from `dist/` |
| `npm test` | Playwright smoke suite (see below) |
| `npm run test:ui` | Playwright's interactive UI mode |
| `npm run index-mods` | Reindex mods via the sibling `contabo_storage_manager` checkout |

Lint a single file with `npx eslint src/components/MyComponent.tsx`.

## Sync

Notes sync against the VPS notes host, **`https://storage.noahcohn.com`** by default.
Override it at runtime by setting the `api_url` key in `localStorage`, or from the app's
Settings modal.

The endpoints `StorageService` (`src/services/api.ts`) uses:

| Method | Path |
|---|---|
| `GET` | `/api/notes/list` |
| `GET` | `/api/notes/read/:name` |
| `POST` | `/api/notes/write/:name` — body `{ content }` |
| `DELETE` | `/api/notes/delete/:name` |
| `POST` | `/webhook/notes` — structured events, optionally HMAC-SHA-256 signed |

Everything is offline-first: reads come from IndexedDB first, writes are applied
optimistically and queued as pending operations, and the queue is replayed when the
browser comes back online or the sync control in the sidebar is used.

### LocalStorage keys

| Key | Purpose |
|---|---|
| `api_url` | Override the VPS base URL |
| `gcs_bucket` | Override the public GCS bucket used by the media panels |
| `webhook_secret` | HMAC secret for webhook signatures (`X-Signature-256`) |
| `author_name` | Default author name on saved notes |
| `cloud_notes_encryption_key` | Auto-generated encryption password |

Web Crypto requires a secure context, so the app must be served over HTTPS or from
`localhost`/`127.0.0.1`.

## Testing

`npm test` runs a Playwright smoke suite from `e2e/`. It boots the Vite dev server
itself (via Playwright's `webServer`), so no separate terminal is needed.

On a fresh machine, install the browser once with `npx playwright install --with-deps chromium`.
CI already does this in `.github/workflows/ci.yml`.

The suite is hermetic: `e2e/fixtures.ts` intercepts every request to the VPS notes host
and to Google Cloud Storage and serves them from an in-memory store, so the tests need no
credentials and no outbound network access. Ten smokes cover the app shell and rich
editor, listing notes, create/save, the command palette, sync success and failure toasts,
the AES-GCM encrypt/decrypt round trip, the effects media panel, RAG chat, and graph view.

```bash
npm test                                  # against the dev server
E2E_USE_PREVIEW=1 E2E_PORT=4173 npm test  # against the production build
npx playwright test -g "command palette"  # a single smoke
```

Useful environment variables:

| Variable | Effect |
|---|---|
| `E2E_PORT` | Port for the test web server (default `5173`) |
| `E2E_BASE_URL` | Point the suite at an already-running server |
| `E2E_USE_PREVIEW` | `1` runs `npm run preview` instead of `npm run dev` |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE` | Use a system Chromium instead of Playwright's download |

There is no unit test runner. Beyond the smokes, `verification/verify_rag_chat.py` is a
standalone Python/Playwright script for the RAG chat flow; run `npm run dev` first, then
`python verification/verify_rag_chat.py`.

## Deployment

`npm run build` emits a fully static `dist/`. Vite is configured with `base: './'`, so the
bundle works from any subdirectory on the host.

Uploading is handled by [`scripts/deploy.sh`](scripts/deploy.sh), which builds and then
rsyncs `dist/` over SSH. Nothing is hardcoded — host, user, path and credentials all come
from the environment:

```bash
DEPLOY_HOST=your.host \
DEPLOY_USER=deploy \
DEPLOY_PATH=/var/www/notes \
./scripts/deploy.sh
```

| Variable | Required | Purpose |
|---|---|---|
| `DEPLOY_HOST` | yes | SSH host |
| `DEPLOY_USER` | yes | SSH user |
| `DEPLOY_PATH` | yes | Absolute remote directory to sync into |
| `DEPLOY_PORT` | no | SSH port (default `22`) |
| `DEPLOY_SSH_KEY` | no | Private key contents; falls back to your `ssh-agent` |
| `DEPLOY_KNOWN_HOSTS` | no | `ssh-keyscan` output; enables strict host key checking |
| `DEPLOY_SKIP_BUILD` | no | `1` deploys the existing `dist/` without rebuilding |
| `DEPLOY_DRY_RUN` | no | `1` lists what would transfer and writes nothing |

The key is written to a `mktemp -d` directory that is removed on exit, so it never lands
in the repo or in a persistent path. Do a dry run first:

```bash
DEPLOY_DRY_RUN=1 DEPLOY_HOST=... DEPLOY_USER=... DEPLOY_PATH=... ./scripts/deploy.sh
```

### From GitHub Actions

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the same script on
`workflow_dispatch`, reading the values above from repository secrets
(`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY`,
`DEPLOY_KNOWN_HOSTS`). It targets a `production` environment, so you can require a
reviewer and scope the secrets to it. Uncomment the `push` trigger in that file to deploy
every commit on `main` instead.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request and on
`main`:

- **Lint & build** — `npm run lint`, `npm run build`, and uploads `dist/` as an artifact.
- **Playwright smokes** — installs Chromium and runs `npm test`, uploading the HTML report.

## Architecture

```
src/
├── App.tsx              # Root component: global state, mode switching, plugin wiring
├── app/                 # Header, footer, editors and dialogs extracted from App.tsx
├── components/          # Views (BlockEditor, GraphView, CanvasEditor, …) and modals
│   └── editor/          # Tiptap extensions
├── services/
│   ├── api.ts           # StorageService: offline-first storage, pending-op queue, webhooks
│   ├── ai.ts            # Facade over the AI Web Worker
│   ├── ai.worker.ts     # Transformers.js pipelines (summarise, tag, embed, transcribe)
│   ├── semantic.ts      # Embedding index for search and related notes
│   ├── plugin.ts        # PluginRegistry
│   └── vpsStorageAPI.ts # Thin client for the named-notes endpoints
├── plugins/             # Built-in plugins, aggregated in core.tsx
└── utils/               # db, encryption, serialization, metadata, backlinks, media, …
e2e/                     # Playwright smoke suite
verification/            # Standalone Python/Playwright verification script
scripts/deploy.sh        # Build and rsync dist/ to the VPS
```

State is plain React hooks — no Redux or Zustand. Heavy views are lazy-loaded with
`React.lazy()`. Note metadata is packed into `CloudItemMeta.description` as
`Subject ::: Section ::: Tags ::: Links ::: Keywords`; the sidebar tree, graph edges and
backlinks all read that string rather than loading full note bodies.

See [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) for deeper contributor notes.

## Cross-origin isolation (opt-in)

`SharedArrayBuffer` and multi-threaded WASM need the page to be `crossOriginIsolated`,
which requires COOP/COEP response headers. `vite.config.ts` can set them, but they are
**off by default** because `Cross-Origin-Embedder-Policy: require-corp` blocks every
cross-origin subresource that does not send `Cross-Origin-Resource-Policy` — which
includes the VPS media URLs, the public GCS bucket, Hugging Face model weights, and
Excalidraw's lazily-loaded assets.

Turn it on for local measurement:

```bash
VITE_CROSS_ORIGIN_ISOLATED=1 npm run dev
```

Before enabling it in production, the notes host and the GCS bucket must send
`Cross-Origin-Resource-Policy: cross-origin`. Until then the fallback is the default
single-threaded WASM path, which works unchanged.
