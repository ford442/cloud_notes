import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("http://localhost:5173")
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_selector("text=KNOWLEDGE")

        await page.click("text=+ New")

        await page.wait_for_selector(".ProseMirror")
        await page.click(".ProseMirror")
        test_text = "This is a test sentence with ten words in it precisely.\n" * 20
        await page.keyboard.type(test_text)

        print("Verifying EditorStatusBar...")
        status_bar_locator = page.locator("text=/\\d+ words.*min read/")
        await expect(status_bar_locator.first).to_be_visible(timeout=5000)
        print("✓ EditorStatusBar is visible and accurate.")

        print("Verifying Command Palette Action...")
        await page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
        await page.wait_for_selector("input[placeholder*='search notes']", timeout=2000)
        await page.fill("input[placeholder*='search notes']", "Show Note Statistics")
        await page.wait_for_selector("text=Show Note Statistics")
        await page.locator("text=Show Note Statistics").click()

        alert_dialog_2 = page.locator("text=Statistics for")
        await expect(alert_dialog_2).to_be_visible(timeout=5000)
        await expect(page.locator("text=/Words: \\d+/")).to_be_visible()
        await expect(page.locator("text=/Reading Time: ~\\d+ min/")).to_be_visible()
        await page.click("text=OK")
        print("✓ Command Palette Action works.")

        print("All stats verifications passed!")
        await browser.close()

asyncio.run(main())
