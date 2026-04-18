import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to dev server...")
        await page.goto("http://localhost:5173")

        await page.wait_for_selector(".lucide-loader", state="hidden")
        await page.wait_for_selector(".animate-spin", state="hidden")

        print("Triggering delete API from console to check if it throws...")
        result = await page.evaluate('''async () => {
            try {
                // Mock API_BASE_URL internally if necessary, or just rely on MSW if we had one.
                // Since this uses the actual API, it might fail with 500 if the storage manager isn't running locally
                // but the code should at least construct the payload and attempt fetch.
                const { StorageService } = await import('/src/services/api.ts');
                await StorageService._networkDeleteNote("test-id-123");
                return "SUCCESS";
            } catch (e) {
                return e.message;
            }
        }''')
        print(f"Result: {result}")
        await browser.close()

asyncio.run(run())
