
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()

        try:
            # 1. Go to the app
            page.goto("http://localhost:5173")

            # 2. Wait for app to load (checking for sidebar)
            page.get_by_text("KNOWLEDGE").wait_for()

            # 3. Open Command Palette (Cmd+K)
            page.keyboard.press("Meta+k")

            # 4. Wait for palette to appear
            palette_input = page.get_by_placeholder("Type a command or search...")
            expect(palette_input).to_be_visible()

            # 5. Type "Graph"
            palette_input.fill("Graph")

            # 6. Wait for results to filter
            expect(page.get_by_text("Switch to Graph View")).to_be_visible()

            # 7. Take screenshot
            page.screenshot(path="verification/palette_search.png")
            print("Screenshot saved to verification/palette_search.png")

            # 8. Test Navigation (Close palette and re-open to test nav)
            page.keyboard.press("Escape")
            expect(palette_input).not_to_be_visible()

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
