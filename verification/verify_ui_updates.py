from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for app to load (spinner goes away)
        page.wait_for_selector(".animate-spin", state="detached", timeout=10000)

        # Give it a tiny bit of time to render completely
        page.wait_for_timeout(1000)

        # Take a screenshot
        screenshot_path = "verification/ui_updates.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Hover over the first folder to see the new hover state
        print("Hovering over a folder in the sidebar...")
        folder = page.locator(".flex.items-center.gap-3.p-3.rounded-xl.cursor-pointer").first
        if folder.count() > 0:
            folder.hover()
            page.wait_for_timeout(500)
            hover_path = "verification/ui_updates_hover.png"
            page.screenshot(path=hover_path)
            print(f"Hover screenshot saved to {hover_path}")

        browser.close()

if __name__ == "__main__":
    verify_ui()
