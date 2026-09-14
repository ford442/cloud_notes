import { test as base, expect, type Page, type Route } from '@playwright/test';

/**
 * The app talks to the VPS notes host (https://storage.noahcohn.com by default,
 * overridable through the `api_url` localStorage key) and, for the effects
 * panel, to the public Google Cloud Storage JSON API.
 *
 * The smokes must not depend on either being reachable, so every outbound call
 * is intercepted and served from an in-memory store. That keeps the suite
 * hermetic in CI and makes assertions about sync counts deterministic.
 */

export interface MockNote {
  name: string;
  content: string;
  updated_at: string;
}

export class MockBackend {
  readonly notes = new Map<string, MockNote>();
  readonly webhooks: unknown[] = [];
  /** Set to a status code to make every notes API call fail with it. */
  failWith: number | null = null;

  constructor(seed: MockNote[] = []) {
    for (const note of seed) this.notes.set(note.name, note);
  }

  seed(note: MockNote) {
    this.notes.set(note.name, note);
  }
}

const NOTES_HOST_GLOB = '**/storage.noahcohn.com/**';
const GCS_GLOB = 'https://storage.googleapis.com/**';

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });
}

async function installNotesRoutes(page: Page, backend: MockBackend) {
  await page.route(NOTES_HOST_GLOB, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);

    if (backend.failWith !== null) {
      return json(route, { error: 'mock failure' }, backend.failWith);
    }

    if (path === '/api/notes/list') {
      return json(
        route,
        [...backend.notes.values()].map((n) => ({ name: n.name, updated_at: n.updated_at })),
      );
    }

    const read = path.match(/^\/api\/notes\/read\/(.+)$/);
    if (read) {
      const note = backend.notes.get(read[1]);
      if (!note) return json(route, { error: 'not found' }, 404);
      return json(route, note);
    }

    const write = path.match(/^\/api\/notes\/write\/(.+)$/);
    if (write) {
      const name = write[1];
      const body = request.postDataJSON() as { content?: string } | null;
      const note: MockNote = {
        name,
        content: body?.content ?? '',
        updated_at: new Date().toISOString(),
      };
      backend.notes.set(name, note);
      return json(route, note);
    }

    const del = path.match(/^\/api\/notes\/delete\/(.+)$/);
    if (del) {
      backend.notes.delete(del[1]);
      return json(route, { success: true });
    }

    if (path.startsWith('/webhook/')) {
      backend.webhooks.push(request.postDataJSON());
      return json(route, { success: true });
    }

    // Anything else this host serves (samples, songs, textures, …) gets an
    // empty-but-successful answer so the UI renders its empty state.
    return json(route, []);
  });
}

async function installGcsRoutes(page: Page) {
  await page.route(GCS_GLOB, (route) => {
    const url = new URL(route.request().url());

    // The effects panel lists a public bucket through the GCS JSON API, once
    // per media prefix (see EFFECTS_IMAGE_PREFIX / EFFECTS_VIDEO_PREFIX).
    if (!url.pathname.startsWith('/storage/v1/')) {
      // A thumbnail/object fetch — serve a 1x1 transparent PNG.
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    }

    const prefix = url.searchParams.get('prefix') ?? '';
    const file = prefix.startsWith('video')
      ? `${prefix}smoke-sample.mp4`
      : `${prefix}smoke-sample.png`;

    return json(route, {
      items: [
        {
          name: file,
          size: '1024',
          updated: '2026-01-01T00:00:00.000Z',
          contentType: file.endsWith('.mp4') ? 'video/mp4' : 'image/png',
        },
      ],
    });
  });
}

export const test = base.extend<{ backend: MockBackend; app: Page }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature
  backend: async ({}, use) => {
    await use(new MockBackend());
  },

  // `app` is a page with the backend mocked and the app loaded and settled.
  app: async ({ page, backend }, use) => {
    await installNotesRoutes(page, backend);
    await installGcsRoutes(page);
    await page.goto('/');
    await expect(page.getByPlaceholder('Search notes...')).toBeVisible();
    await use(page);
  },
});

export { expect };

/** Waits for a toast with matching text to appear in the toast stack. */
export function toast(page: Page, text: string | RegExp) {
  return page.locator('.fixed.bottom-6.right-6').getByText(text);
}
