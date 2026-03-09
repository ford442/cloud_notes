import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.goto("http://localhost:5173")
        page.wait_for_selector(".ProseMirror", timeout=10000)
        time.sleep(3)
        page.click(".ProseMirror")

        # Type '/exc'
        page.keyboard.type("/exc")
        time.sleep(1)
        page.keyboard.press("Enter")
        time.sleep(2)

        page.screenshot(path="verification_excalidraw_fixed.png")
        print("Screenshot saved.")

        browser.close()

if __name__ == "__main__":
    run()
