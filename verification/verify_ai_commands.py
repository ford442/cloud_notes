import os
import time
from playwright.sync_api import sync_playwright

def verify_ai_commands():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Navigate to the app
        page.goto("http://localhost:5173")

        # Wait for editor to load
        page.wait_for_selector(".ProseMirror")

        # Explicitly wait for loading indicators to disappear
        page.wait_for_selector(".animate-spin", state="hidden")

        # Click in editor
        editor = page.locator(".ProseMirror")
        editor.click()

        # Type '/' to open menu
        editor.type("/")

        # Wait for the suggestion menu to exist and be visible
        page.wait_for_selector('[data-tippy-root]', timeout=5000)
        time.sleep(1) # Wait for animation and console log

        # Take screenshot of the menu
        if not os.path.exists("verification"):
            os.makedirs("verification")

        page.screenshot(path="verification/slash_menu.png")

        # Verify "Smart Meeting" exists
        smart_meeting = page.locator("button:has-text('Smart Meeting')")
        count = smart_meeting.count()
        if count > 0:
            print(f"SUCCESS: 'Smart Meeting' command found ({count} times).")
        else:
            print("FAILURE: 'Smart Meeting' command NOT found.")

        # Verify "Ask AI" exists
        ask_ai = page.locator("button:has-text('Ask AI')")
        if ask_ai.count() > 0:
            print("SUCCESS: 'Ask AI' command found.")
        else:
            print("FAILURE: 'Ask AI' command NOT found.")

        # Test Keyboard Navigation (verify fix)
        # Press Down Arrow 5 times
        for _ in range(5):
            page.keyboard.press("ArrowDown")
            time.sleep(0.1)

        page.screenshot(path="verification/slash_menu_navigated.png")
        print("Navigation screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_ai_commands()
