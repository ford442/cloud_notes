import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        print("Waiting for editor...")
        page.wait_for_selector(".ProseMirror", timeout=10000)

        # Switch to Canvas Mode
        print("Switching to Canvas mode...")
        page.click("button:has-text('Canvas')")

        # Wait for Excalidraw to load
        time.sleep(3)

        # Take screenshot before sync
        page.screenshot(path="verification/canvas_before_sync.png")

        # Open Command Palette (Cmd/Ctrl + K)
        page.keyboard.press("Meta+k")
        time.sleep(1)

        # Search for "Sync Note Text to Canvas"
        page.keyboard.type("Sync Note Text")
        time.sleep(1)
        page.keyboard.press("Enter")
        time.sleep(1)

        # Take screenshot of canvas with synced text
        page.screenshot(path="verification/canvas_sync_text.png")
        print("Screenshot saved to verification/canvas_sync_text.png")

        # Now test export
        # Open Command Palette
        page.keyboard.press("Meta+k")
        time.sleep(1)
        page.keyboard.type("Export Canvas")
        time.sleep(1)
        page.keyboard.press("Enter")
        time.sleep(1)

        # Don't strictly wait for download in headless, just taking screenshot
        page.screenshot(path="verification/canvas_export.png")

        browser.close()

if __name__ == "__main__":
    run()
