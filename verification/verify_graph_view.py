import asyncio
from playwright.async_api import async_playwright
import sys
from contextlib import asynccontextmanager

MOCK_API_URL = "http://localhost:5173/mock-api"

@asynccontextmanager
async def browser_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            yield page
        finally:
            await context.close()
            await browser.close()

async def verify_graph_view():
    async with browser_context() as page:
        print("1. Loading app...")
        await page.goto("http://localhost:5173/")
        await page.wait_for_load_state("networkidle")

        await page.evaluate(f"localStorage.setItem('api_url', '{MOCK_API_URL}');")
        await page.evaluate("localStorage.setItem('author_name', 'Tester');")
        await page.reload()
        await page.wait_for_selector("#root > div", timeout=10000)

        print("2. Creating a test note...")
        # Target the button directly using standard playwright locators
        # The new note button usually has a Plus icon. We'll find by text "New" or equivalent icon.
        # Check sidebar structure:
        #   button with SVG plus icon, or just try to find the actual Create Note button

        # Let's just create a new note using Command Palette if button is tricky
        await page.keyboard.press("Meta+k")
        await page.wait_for_selector("input[placeholder*='Search']", timeout=5000)
        await page.keyboard.type("Create New Note")
        await page.keyboard.press("Enter")

        # Wait for editor to be ready
        await page.wait_for_selector(".ProseMirror")
        await page.locator(".ProseMirror").click()
        await page.locator(".ProseMirror").type("This is a test note for graph view.")

        print("3. Toggling Graph Mode...")
        # The button is named "Graph" and is in the top bar
        graph_btn = page.locator("button", has_text="Graph")
        await graph_btn.click()

        print("4. Verifying canvas rendering...")
        try:
             await page.wait_for_selector("canvas", timeout=5000)
             print("Canvas rendered successfully in Graph View.")
        except Exception as e:
             print("Failed to find canvas in Graph View!")
             sys.exit(1)

        print("Graph View functionality verified successfully!")

if __name__ == "__main__":
    asyncio.run(verify_graph_view())
