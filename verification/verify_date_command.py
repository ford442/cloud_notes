from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app to load
            # Look for the editor
            page.wait_for_selector(".ProseMirror")

            print("Focusing editor...")
            page.click(".ProseMirror")

            # Clear any existing content just in case
            page.keyboard.press("Control+A")
            page.keyboard.press("Backspace")

            print("Typing /date...")
            page.keyboard.type("/date")

            # Wait for suggestion list
            page.wait_for_selector("text=Date")

            # Press Enter to select the Date command
            page.keyboard.press("Enter")

            # Wait for insertion
            time.sleep(1)

            # Screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification/date_command.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
