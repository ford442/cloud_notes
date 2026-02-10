import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for editor to be visible
        # The editor has class 'ProseMirror' usually, or I can look for the placeholder
        print("Waiting for editor...")
        page.wait_for_selector(".ProseMirror", timeout=10000)

        # Click editor to focus
        page.click(".ProseMirror")

        # Type '/' to trigger slash command
        print("Typing slash command...")
        page.keyboard.type("/")

        # Wait for the menu to appear
        # The menu items usually have text. I added "Daily Note"
        print("Waiting for Daily Note option...")
        # Give it a moment for the Tippy popup to render
        time.sleep(1)

        # Take screenshot
        screenshot_path = "verification_slash_command.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Verify "Daily Note" is present in the text content of the page (it should be in the popup)
        content = page.content()
        if "Daily Note" in content:
            print("SUCCESS: 'Daily Note' found in page content.")
        else:
            print("FAILURE: 'Daily Note' NOT found in page content.")

        browser.close()

if __name__ == "__main__":
    run()
