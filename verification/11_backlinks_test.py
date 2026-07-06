import asyncio
from playwright.async_api import async_playwright

async def verify_backlinks():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to app...")
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_selector("#root > div", timeout=10000)

        # Ensure focus is away
        await page.click("body")
        await page.wait_for_timeout(500)

        # Create target note via New Note
        print("Creating target note...")
        await page.evaluate("""() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true }));
        }""")
        await page.wait_for_selector('[placeholder="Type to search notes, commands, or ask AI..."]')
        await page.fill('[placeholder="Type to search notes, commands, or ask AI..."]', "New Note")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        # Click title to edit
        await page.click('[placeholder="Note Title..."]')
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await page.keyboard.type("Target Note")
        await page.wait_for_timeout(1500) # Wait for auto-save

        print("Creating source note...")
        await page.evaluate("""() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true }));
        }""")
        await page.wait_for_selector('[placeholder="Type to search notes, commands, or ask AI..."]')
        await page.fill('[placeholder="Type to search notes, commands, or ask AI..."]', "New Note")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        # Click title to edit
        await page.click('[placeholder="Note Title..."]')
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await page.keyboard.type("Source Note")
        await page.wait_for_timeout(1000)

        print("Adding wiki link to Target Note...")
        await page.click('.tiptap')
        await page.keyboard.type("[[Tar")
        await page.wait_for_timeout(1000)
        await page.keyboard.press("Enter") # Select Target Note from suggestion
        await page.wait_for_timeout(1500) # Wait for auto-save

        print("Navigating to Target Note...")
        await page.evaluate("""() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true }));
        }""")
        await page.wait_for_selector('[placeholder="Type to search notes, commands, or ask AI..."]')
        await page.fill('[placeholder="Type to search notes, commands, or ask AI..."]', "Target Note")
        await page.wait_for_timeout(500)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        print("Checking backlinks panel...")
        # Check if Backlinks panel contains "Source Note"
        has_backlink = await page.locator("#backlinks-panel").locator("text=Source Note").is_visible()
        if not has_backlink:
             # take screenshot
             await page.screenshot(path="verification/backlinks_error.png")
             raise Exception("Backlinks panel did not contain 'Source Note'")

        print("Success!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_backlinks())
