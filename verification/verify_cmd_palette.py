from playwright.sync_api import sync_playwright

def verify_command_palette():
    with sync_playwright() as p:
        # Need to allow clipboard/keyboard permissions sometimes for playwright in web
        browser = p.chromium.launch(headless=True)
        # Use a real user agent
        context = browser.new_context(user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()

        try:
            # Navigate to the app
            page.goto("http://localhost:5173")

            # Wait for app to be ready
            page.wait_for_selector('.ProseMirror')
            page.wait_for_selector('.lucide-loader', state='hidden', timeout=10000)

            # Bring focus to the window before typing shortcuts
            page.click("body")

            # Use specific key modifier string format that Playwright prefers
            # On Mac it's Meta, on Linux/Windows it's Control
            # Try both or use evaluation
            page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")

            # Wait for the Command Palette to appear
            page.wait_for_selector('input[placeholder="Type to search notes, commands, or ask AI..."]', timeout=5000)

            # Take a screenshot of the default state
            page.screenshot(path="verification/cmd_palette_default.png")

            # Type something to show results
            page.locator('input[placeholder="Type to search notes, commands, or ask AI..."]').fill("task")

            # Wait for search results
            page.wait_for_timeout(1000)

            # Take a screenshot with results
            page.screenshot(path="verification/cmd_palette_results.png")

            print("Screenshots captured successfully.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/cmd_palette_error.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_command_palette()
