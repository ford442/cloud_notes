import { test, expect, toast } from './fixtures';

/**
 * Smoke coverage for cloud-notes. These are deliberately shallow: each one
 * proves a major surface still mounts and its primary interaction works.
 * The VPS notes host and GCS are mocked in `fixtures.ts`, so the suite runs
 * offline and in CI.
 */

test('app shell loads with the sidebar and rich editor mounted', async ({ app }) => {
  await expect(app.getByPlaceholder('Note Title...')).toBeVisible();
  await expect(app.getByRole('button', { name: '+ New' })).toBeVisible();

  // 'rich' is the default editor mode, so Tiptap's ProseMirror root must exist.
  await expect(app.locator('.ProseMirror').first()).toBeVisible();
  await expect(app.getByRole('button', { name: 'Rich' })).toBeVisible();
});

test('existing notes from the VPS are listed in the sidebar', async ({ app, backend }) => {
  backend.seed({
    name: 'seeded-note',
    content: '# Seeded\n\nLoaded from the mocked notes host.',
    updated_at: '2026-01-01T00:00:00.000Z',
  });

  await app.reload();
  await expect(app.getByText('seeded-note').first()).toBeVisible();
});

test('creating and saving a note writes it to the notes host', async ({ app, backend }) => {
  await app.getByRole('button', { name: '+ New' }).click();

  const title = app.getByPlaceholder('Note Title...');
  await title.fill('Smoke Test Note');

  // The simple editor is a plain textarea, which is the most stable place to
  // type note body text without depending on Tiptap's internals.
  await app.getByRole('button', { name: 'Simple' }).click();
  const body = app.getByPlaceholder('Start writing your note in Markdown...');
  await expect(body).toBeVisible();
  await body.fill('Body written by the smoke suite.');

  await app.getByRole('button', { name: 'Save Note' }).click();

  await expect
    .poll(() => [...backend.notes.keys()], { timeout: 15_000 })
    .toContain('smoke-test-note');
  expect(backend.notes.get('smoke-test-note')?.content).toContain(
    'Body written by the smoke suite.',
  );
});

test('command palette opens on Cmd/Ctrl+K and filters', async ({ app }) => {
  await app.locator('body').click();
  await app.keyboard.press('ControlOrMeta+k');

  const input = app.getByPlaceholder('Type to search notes, commands, or ask AI...');
  await expect(input).toBeVisible();

  // CommandPalette focuses the input and clears its query from a 50ms timeout
  // after opening; typing before that lands would be silently discarded.
  await expect(input).toBeFocused();

  await expect(app.getByText('New Note')).toBeVisible();

  await input.fill('backlinks');
  await expect(app.getByText('Show Backlinks')).toBeVisible();
  await expect(app.getByText('New Note')).toBeHidden();

  await app.keyboard.press('Escape');
  await expect(input).toBeHidden();
});

test('sync control reports its result through a toast', async ({ app, backend }) => {
  backend.seed({
    name: 'remote-only-note',
    content: 'Only on the server.',
    updated_at: new Date().toISOString(),
  });

  await app.getByTitle('Sync with VPS').click();
  await expect(toast(app, /sync|pulled|pushed|up to date/i).first()).toBeVisible({
    timeout: 20_000,
  });
});

test('a failing sync surfaces an error instead of hanging', async ({ app, backend }) => {
  backend.failWith = 500;

  await app.getByTitle('Sync with VPS').click();
  await expect(toast(app, /fail|error/i).first()).toBeVisible({ timeout: 20_000 });
});

test('note content round-trips through AES-GCM encryption', async ({ app, backend }) => {
  const secret = 'classified smoke payload';

  await app.getByRole('button', { name: '+ New' }).click();
  await app.getByPlaceholder('Note Title...').fill('Encrypted Note');
  await app.getByRole('button', { name: 'Simple', exact: true }).click();
  await app.getByPlaceholder('Start writing your note in Markdown...').fill(secret);
  await app.getByRole('button', { name: 'Save Note' }).click();

  // Saving dispatches a webhook whose payload is encrypted by EncryptionService.
  await expect.poll(() => backend.webhooks.length, { timeout: 20_000 }).toBeGreaterThan(0);

  const payload = backend.webhooks[0] as { data?: { content?: string } };
  const cipher = payload?.data?.content ?? '';
  expect(cipher).toMatch(/^ENC:v1:/);
  expect(cipher).not.toContain(secret);

  // Feeding that exact ciphertext back through the read path must decrypt it,
  // which exercises both halves of the AES-GCM/PBKDF2 round-trip.
  backend.seed({
    name: 'encrypted-note',
    content: cipher,
    updated_at: new Date().toISOString(),
  });

  await app.reload();
  await app.getByText('encrypted-note').first().click();
  await app.getByRole('button', { name: 'Simple', exact: true }).click();
  await expect(app.getByPlaceholder('Start writing your note in Markdown...')).toHaveValue(
    new RegExp(secret),
  );
});

test('effects media panel mounts and lists media', async ({ app }) => {
  await app.getByRole('button', { name: /Effects/ }).click();
  await expect(app.getByText(/smoke-sample\.png/).first()).toBeVisible({ timeout: 20_000 });
});

test('RAG chat modal opens on Cmd/Ctrl+J and accepts a question', async ({ app }) => {
  await app.locator('body').click();
  await app.keyboard.press('ControlOrMeta+j');

  await expect(app.getByText('Second Brain Q&A')).toBeVisible();

  const input = app.getByPlaceholder('Ask a question to synthesize your notes...');
  await expect(input).toBeVisible();
  await input.fill('What is in my notes?');
  await app.keyboard.press('Enter');

  // The answer needs a Transformers.js model download, which is out of scope
  // for a smoke; asserting the question was accepted into the transcript is
  // enough to prove the RAG entry point is wired up.
  await expect(app.getByText('What is in my notes?')).toBeVisible();

  await app.keyboard.press('Escape');
  await expect(app.getByText('Second Brain Q&A')).toBeHidden();
});

test('graph view mounts without crashing the app shell', async ({ app }) => {
  await app.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(app.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  await app.getByRole('button', { name: 'Rich', exact: true }).click();
  await expect(app.locator('.ProseMirror').first()).toBeVisible();
});
