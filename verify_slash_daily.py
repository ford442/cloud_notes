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

        page.click(".ProseMirror")

        print("Typing slash command '/dai'...")
        page.keyboard.type("/dai")

        time.sleep(1)

        screenshot_path = "verification_slash_daily.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        content = page.content()
        if "Daily Note" in content:
            print("SUCCESS: 'Daily Note' found in page content.")
        else:
            print("FAILURE: 'Daily Note' NOT found in page content.")

        browser.close()

if __name__ == "__main__":
    run()
