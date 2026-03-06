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
        time.sleep(3)

        # Turn off network!
        context.set_offline(True)
        print("Set offline mode")

        # Click new note
        page.locator('button:has-text("+ New")').click()
        time.sleep(1)

        # Type in title
        page.get_by_placeholder("Note Title...").fill("Offline Note 123")
        page.get_by_placeholder("Subject").fill("OfflineSub")

        # Type content
        page.locator(".ProseMirror").fill("This is created offline!")

        # Save note
        page.get_by_role("button", name="Save Note").click()
        time.sleep(3)

        # Check that note is in the sidebar (optimistic update)
        screenshot_path = "verification_sync_offline.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Go back online
        context.set_offline(False)
        print("Set online mode")
        time.sleep(2)

        # Ensure 'syncPending' runs when app comes online
        # The app listens to 'online' event on window
        page.evaluate("window.dispatchEvent(new Event('online'))")
        time.sleep(5)

        # Refresh to trigger getNotes
        page.reload()
        page.wait_for_selector(".ProseMirror", timeout=10000)
        time.sleep(3)

        # Check if note is still there
        try:
            page.locator('text="Offline Note 123"').first.click(timeout=5000)
            print("Successfully clicked the synced offline note!")
            screenshot_path2 = "verification_sync_online.png"
            page.screenshot(path=screenshot_path2)
            print(f"Screenshot 2 saved to {screenshot_path2}")
        except Exception as e:
            print(f"Could not click note: {e}")
            page.screenshot(path="verification_sync_failed.png")
            print("Saved verification_sync_failed.png")

        browser.close()

if __name__ == "__main__":
    run()
