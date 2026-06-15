import time
from playwright.sync_api import sync_playwright

def run(page):
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    # Click tasks directly
    tasks_btn = page.locator("button", has_text="+ New").first
    tasks_btn.click()

    editor = page.locator(".ProseMirror")
    editor.click()
    editor.type("/task")
    page.keyboard.press("Enter")
    editor.type("Task 1")
    page.keyboard.press("Enter")
    page.keyboard.press("Backspace")
    page.keyboard.press("Backspace")
    editor.type("- [ ] ")

    # Give it a second to render
    time.sleep(2)
    page.screenshot(path="verification/task_crash.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))
        run(page)
        browser.close()
