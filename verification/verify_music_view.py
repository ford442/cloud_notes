import asyncio
import os
from playwright.async_api import async_playwright, expect

async def verify_music_library():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            # Setup a mock API for songs
            await page.route("**/api/songs*", lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body='[{"id":"1","title":"Test Song A","author":"Test Artist","rating":8,"tags":["chill","ambient"],"play_count":10},{"id":"2","title":"Test Song B","author":"Other Artist","rating":5,"tags":["upbeat"],"play_count":2}]'
            ))

            print("Navigating to dev server...")
            await page.goto("http://localhost:5173")

            # Wait for app to load
            await page.wait_for_selector(".lucide-loader", state="hidden")
            await page.wait_for_selector(".animate-spin", state="hidden")

            # Set a dummy API URL in local storage so MusicLibraryView renders properly
            await page.evaluate("""() => {
                localStorage.setItem('flac_api_url', 'http://localhost:8000');
            }""")

            # Switch to music mode via command palette
            print("Switching to music mode...")
            await page.click("body") # Ensure focus
            await page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
            await page.get_by_placeholder("Type a command or search...").fill("Music Library")
            await page.wait_for_timeout(1000)
            await page.locator("button:has-text('Music Library')").click()

            # Wait for library view to load
            print("Waiting for library view...")
            await expect(page.get_by_text("Music Library Manager")).to_be_visible()

            # Take screenshot of the base library view
            await page.wait_for_timeout(1000)
            await page.screenshot(path="verification/music_library_view.png")
            print("Captured base music library view")

            # Test sorting
            print("Clicking to sort by Plays...")
            await page.get_by_text("Plays").click()
            await page.wait_for_timeout(500)
            await page.screenshot(path="verification/music_library_sorted.png")
            print("Captured sorted music library view")

            # Test search
            print("Searching for 'Test Song A'...")
            await page.get_by_placeholder("Search library...").fill("Test Song A")
            await page.wait_for_timeout(500)
            await page.screenshot(path="verification/music_library_search.png")
            print("Captured search results")

            # Clear search
            await page.get_by_placeholder("Search library...").fill("")

            # Test tag editor (click edit on the first song)
            print("Opening edit mode...")
            await page.get_by_text("Edit").nth(0).click()
            await page.wait_for_timeout(500)

            # Type a new tag
            await page.get_by_placeholder("Add tag...").fill("new tag")
            await page.screenshot(path="verification/music_library_edit_tags.png")
            print("Captured tag editor view")

            print("Success!")
        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="verification/error_music.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_music_library())