import time
from playwright.sync_api import sync_playwright

def run(page):
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    print("Buttons found:")
    buttons = page.evaluate("() => Array.from(document.querySelectorAll('button')).map(b => b.textContent)")
    print(buttons)

    # In App.tsx, the Task button seems to be the 10th button.
    # We can use the text exact match on locator
    tasks_btn = page.locator("button", has_text="Tasks").first
    print("Tasks button found:", tasks_btn.count() > 0)
    if tasks_btn.count() > 0:
        tasks_btn.click()
        page.wait_for_selector("text=Task Dashboard", timeout=5000)
        print("Task Dashboard Opened!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        run(page)
        browser.close()
