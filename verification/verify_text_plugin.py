import os
import time
from playwright.sync_api import sync_playwright, expect

def verify_text_plugin():
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

        # Switch to Simple Mode
        print("Switching to Simple Mode...")
        page.get_by_role("button", name="Simple").click()

        # Wait for textarea
        page.wait_for_selector("textarea")

        # Focus body
        page.evaluate("document.body.focus()")

        # Open Command Palette
        print("Opening Command Palette via JS...")

        # Dispatch event
        page.evaluate("""
            window.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'k',
                code: 'KeyK',
                keyCode: 75,
                ctrlKey: true,
                bubbles: true,
                cancelable: true
            }));
        """)

        try:
            expect(page.get_by_placeholder("Type a command or search...")).to_be_visible(timeout=3000)
        except:
             print("Command Palette did not open via JS. Trying keyboard.")
             page.keyboard.press("Control+k")
             expect(page.get_by_placeholder("Type a command or search...")).to_be_visible(timeout=3000)

        # Type "Signature"
        page.get_by_placeholder("Type a command or search...").fill("Signature")

        # Click the "Append Signature" action
        print("Executing Append Signature...")
        page.get_by_text("Append Signature").click()

        time.sleep(1)

        # Verify content
        content = page.get_by_placeholder("Start writing your note...").input_value()
        print(f"Content: {content}")

        if "*Signed*" in content:
            print("SUCCESS: Signature appended.")
        else:
            print("FAILURE: Signature not found.")
            raise Exception("Signature not found")

        # Take screenshot
        output_path = "verification/text_plugin.png"
        if not os.path.exists("verification"):
            os.makedirs("verification")

        page.screenshot(path=output_path)
        print(f"Screenshot saved to {output_path}")

        browser.close()

if __name__ == "__main__":
    verify_text_plugin()
