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
                const testNote = {
                    id: 'rag-test-note-1',
                    title: 'Contabo Server Architecture',
                    content: 'The Contabo VPS setup uses HMAC SHA-256 webhook signatures for secure synchronization. We need some padding to make the text long enough. We need some padding to make the text long enough.',
                    updatedAt: new Date().toISOString()
                };

                const dbReq = indexedDB.open('cloud_notes_db');
                await new Promise((resolve, reject) => {
                    dbReq.onsuccess = (e) => {
                        const db = e.target.result;
                        if (db.objectStoreNames.contains('notes_content')) {
                            const tx = db.transaction(['notes_content'], 'readwrite');
                            tx.objectStore('notes_content').put(testNote, testNote.id);
                            tx.oncomplete = resolve;
                            tx.onerror = reject;
                        } else {
                            resolve();
                        }
                    };
                });

                if (window.SemanticService) {
                    await window.SemanticService.indexNote(testNote.id, `${testNote.title} ${testNote.content}`);
                }
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
        await expect(source_chip).to_be_visible(timeout=60000)

        print("7. Testing navigation by clicking source chip...")
        await source_chip.click()
        await expect(chat_modal_title).not_to_be_visible(timeout=3000)

        print("✅ Local RAG UI Integration Test Passed Successfully!")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_rag_chat())
