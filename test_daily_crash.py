import time
from playwright.sync_api import sync_playwright

def run(page):
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    # Use the Command Palette to trigger Daily Note
    page.keyboard.press("Control+k")
    page.wait_for_selector("input[placeholder*='Search']", timeout=5000)
    page.keyboard.type("Daily Note")

    # Give it a second to filter
    time.sleep(1)
    page.keyboard.press("Enter")

    # Give it a second to render
    time.sleep(2)
    page.screenshot(path="verification/daily_crash.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser error: {err}"))
        run(page)
        browser.close()
