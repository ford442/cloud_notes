import asyncio
import os
from playwright.async_api import async_playwright, expect

async def verify_textures_panel():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            print("Navigating to dev server...")
            await page.goto("http://localhost:5173")

            # Wait for app to load
            await page.wait_for_selector(".lucide-loader", state="hidden")
            await page.wait_for_selector(".animate-spin", state="hidden")

            # Switch to textures mode via command palette
            print("Switching to textures mode...")
            await page.click("body") # Ensure focus
            await page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")

            await page.wait_for_selector('input[placeholder="Type to search notes, commands, or ask AI..."]', timeout=5000)

            await page.get_by_placeholder("Type to search notes, commands, or ask AI...").fill("Textures")
            await page.wait_for_timeout(1000)
            await page.get_by_text("Textures", exact=True).first.click()

            # Wait for panel to load
            print("Waiting for textures panel...")
            await expect(page.get_by_text("Select a texture directory")).to_be_visible()

            # Take screenshot of the base panel
            await page.wait_for_timeout(1000)
            await page.screenshot(path="verification/textures_panel.png")
            print("Captured textures panel view")

            print("Success!")
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="verification/error_textures.png")
            raise e
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_textures_panel())
