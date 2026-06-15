import time
from playwright.sync_api import sync_playwright, expect
import os

def run(page):
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    print("Creating note with tasks...")
    page.click("text=+ New")
    page.wait_for_selector(".ProseMirror")
    page.fill("input[placeholder='Note Title...']", "Task Test Note Unique")

    editor = page.locator(".ProseMirror")
    editor.click()
    editor.type("/task")
    page.keyboard.press("Enter")
    editor.type("Unique Task 1")
    page.keyboard.press("Enter")
    time.sleep(0.5)
    editor.type("Unique Task 2")
    time.sleep(1.0)

    page.click("text=Save Note")
    time.sleep(2)

    print("Opening Task Dashboard...")

    # Try finding the tasks button via explicit matching
    tasks_btn = page.locator("button", has_text="Tasks").first
    tasks_btn.click()

    page.wait_for_selector("text=Task Dashboard", timeout=5000)

    print("Tasks before:")
    print(page.locator(".bg-white, .dark\\:bg-slate-800").all_inner_texts())

    print("Completing Task 1...")
    task_item = page.locator("div.bg-white, div.dark\\:bg-slate-800").filter(has_text="Unique Task 1").first
    complete_button = task_item.locator("button[title='Mark as Complete']")
    complete_button.click()

    time.sleep(4)
    print("Tasks after:")
    print(page.locator(".bg-white, .dark\\:bg-slate-800").all_inner_texts())

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Add a listener to see what the console is printing
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        run(page)
        browser.close()
