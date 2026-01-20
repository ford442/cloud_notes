import os
import time
from playwright.sync_api import sync_playwright, expect

def verify_canvas_plugin():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app
        try:
            page.goto("http://localhost:5173")
        except Exception as e:
            print(f"Failed to load page: {e}")
            return

        # Wait for app to load
        try:
            page.wait_for_selector("text=Create New Note", timeout=5000)
        except:
             time.sleep(2)

        # Switch to Canvas Mode
        print("Switching to Canvas Mode...")
        page.get_by_role("button", name="Canvas").click()

        # Wait for Canvas to load
        try:
            page.wait_for_selector("canvas", timeout=10000)
        except:
            print("Canvas did not load?")
            raise

        time.sleep(2)

        # Steal focus from Excalidraw by clicking header
        page.get_by_placeholder("Untitled Note...").click()
        time.sleep(0.5)

        # Open Command Palette via JS
        print("Opening Command Palette...")
        page.evaluate("""
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'k',
                code: 'KeyK',
                keyCode: 75,
                ctrlKey: true,
                metaKey: true,
                bubbles: true
            }));
        """)

        try:
            expect(page.get_by_placeholder("Type a command or search...")).to_be_visible(timeout=5000)
        except:
             print("Command Palette did not open via JS, trying keyboard.")
             page.keyboard.press("Meta+k")
             expect(page.get_by_placeholder("Type a command or search...")).to_be_visible(timeout=5000)

        # Type "Timestamp"
        page.get_by_placeholder("Type a command or search...").fill("Timestamp")

        # Click the "Add Timestamp to Canvas" action
        print("Executing Add Timestamp...")
        page.get_by_text("Add Timestamp to Canvas").click()

        time.sleep(2)

        # Take screenshot
        output_path = "verification/canvas_plugin.png"
        if not os.path.exists("verification"):
            os.makedirs("verification")

        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    verify_canvas_plugin()
