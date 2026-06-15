import time
from playwright.sync_api import sync_playwright

def run(page):
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    # Click tasks directly
    tasks_btn = page.locator("button", has_text="Tasks").first
    tasks_btn.click()

    # Give it a second to render
    time.sleep(2)
    page.screenshot(path="verification/task_crash.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        run(page)
        browser.close()
