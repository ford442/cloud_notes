from playwright.sync_api import sync_playwright

def test_effects_media_panel():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app to load
            page.wait_for_selector(".lucide-loader", state="detached", timeout=10000)
            page.wait_for_selector(".animate-spin", state="detached", timeout=10000)

            # Bring focus to the window before typing shortcuts
            page.click("body")

            page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")

            page.wait_for_selector('input[placeholder="Type to search notes, commands, or ask AI..."]', timeout=5000)
            page.locator('input[placeholder="Type to search notes, commands, or ask AI..."]').fill("Effects Media")
            page.wait_for_timeout(1000)

            page.keyboard.press("Enter")

            page.wait_for_selector("text=Effects Media", timeout=5000)

            print("Taking screenshot...")
            page.screenshot(path="verification/effects_media_panel.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/effects_media_panel_error.png")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    test_effects_media_panel()
