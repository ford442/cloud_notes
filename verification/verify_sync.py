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

        # Wait for any loading spinners to disappear
        time.sleep(3)

        # Turn off network!
        context.set_offline(True)
        print("Set offline mode")

        # Create a new note
        page.get_by_text("+ New").click()
        time.sleep(1)

        # Type in title
        page.get_by_placeholder("Note Title...").fill("Offline Note 123")

        # Type content
        page.click(".ProseMirror")
        page.keyboard.type("This is created offline!")

        # Save note
        page.get_by_role("button", name="Save Note").click()
        time.sleep(2)

        # Verify toast or success
        screenshot_path = "verification_sync_offline.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Go back online
        context.set_offline(False)
        print("Set online mode")

        # Refresh to trigger sync
        page.reload()
        time.sleep(3)

        # Check if note is still there
        page.get_by_text("Offline Note 123").first.click()
        time.sleep(1)

        screenshot_path2 = "verification_sync_online.png"
        page.screenshot(path=screenshot_path2)
        print(f"Screenshot 2 saved to {screenshot_path2}")

        browser.close()

if __name__ == "__main__":
    run()
