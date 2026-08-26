import asyncio
from playwright.async_api import async_playwright, expect

async def test_rag_chat():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("1. Navigating to Cloud Notes application...")
        await page.goto("http://localhost:5173")
        await page.wait_for_load_state("networkidle")

        print("2. Seeding test note into IndexedDB for local RAG retrieval...")
        await page.evaluate("""
            async () => {
                const req = indexedDB.open('CloudNotesDB');
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains('notes_content')) {
                        const tx = db.transaction('notes_content', 'readwrite');
                        const store = tx.objectStore('notes_content');
                        store.put({
                            id: 'rag-test-note-1',
                            title: 'Contabo Server Architecture',
                            content: 'The Contabo VPS setup uses HMAC SHA-256 webhook signatures for secure synchronization.',
                            updatedAt: new Date().toISOString()
                        });
                    }
                };
            }
        """)

        print("3. Triggering Cmd+J / Ctrl+J keyboard shortcut to open ChatModal...")
        await page.keyboard.press("Control+j")

        print("4. Verifying ChatModal visibility...")
        chat_modal_title = page.get_by_text("Second Brain Q&A", exact=False)
        await expect(chat_modal_title).to_be_visible(timeout=5000)

        print("5. Submitting query to Local RAG Pipeline...")
        chat_input = page.locator('input[placeholder="Ask a question to synthesize your notes..."]')
        await chat_input.fill("What algorithm is used for Contabo webhook signatures?")
        await page.keyboard.press("Enter")

        print("6. Waiting for RAG answer and source citations...")
        source_chip = page.get_by_role("button", name="Contabo Server Architecture", exact=False)
        await expect(source_chip).to_be_visible(timeout=20000)

        print("7. Testing navigation by clicking source chip...")
        await source_chip.click()
        await expect(chat_modal_title).not_to_be_visible(timeout=3000)

        print("✅ Local RAG UI Integration Test Passed Successfully!")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_rag_chat())
