import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Cross-origin isolation (opt-in).
 *
 * Setting COOP/COEP makes the origin `crossOriginIsolated`, which unlocks
 * `SharedArrayBuffer` and multi-threaded WASM for Transformers.js and a future
 * wa-sqlite layer. It is OFF by default because `require-corp` blocks every
 * cross-origin subresource that does not send `Cross-Origin-Resource-Policy`,
 * and this app loads several that we do not control:
 *
 *   - the VPS notes host (https://storage.noahcohn.com) — fetches are CORS, so
 *     they survive, but <img>/<video> src for samples and effects media do not;
 *   - the public GCS bucket used by the effects/textures panels;
 *   - Transformers.js model weights fetched from the Hugging Face CDN;
 *   - Excalidraw's lazily-loaded font and asset chunks.
 *
 * Enable it locally with `VITE_CROSS_ORIGIN_ISOLATED=1 npm run dev` to measure
 * WASM gains. Before turning it on for production, the notes host and bucket
 * must send `Cross-Origin-Resource-Policy: cross-origin`; until then the
 * fallback is the default single-threaded WASM path, which works unchanged.
 */
const crossOriginIsolated = process.env.VITE_CROSS_ORIGIN_ISOLATED === '1'

const isolationHeaders = crossOriginIsolated
  ? {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  : undefined

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
