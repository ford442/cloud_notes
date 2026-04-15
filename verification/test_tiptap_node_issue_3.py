import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:5173/")
        await asyncio.sleep(2)

        # Test how `marked.use({ renderer: tiptapRenderer })` behaves now
        res = await page.evaluate("""async () => {
            const mod = await import('/src/utils/serialization.ts');
            return mod.markdownToHtml("- \\n-  \\n- \\t");
        }""")
        print(f"Result:\n{res}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
