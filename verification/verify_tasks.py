from playwright.sync_api import sync_playwright, expect
import time
import os

def run(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for app to load
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    # 1. Create a new note with tasks
    print("Creating note with tasks...")
    page.click("text=+ New")

    # Wait for editor to be ready
    page.wait_for_selector(".ProseMirror")

    # Type title
    page.fill("input[placeholder='Note Title...']", "Task Test Note Unique")

    # Type content with tasks
    editor = page.locator(".ProseMirror")
    editor.click()
    editor.type("/task")
    page.keyboard.press("Enter")
    editor.type("Unique Task 1")
    page.keyboard.press("Enter")
    time.sleep(0.5)
    editor.type("Unique Task 2")
    time.sleep(1.0)

    # Save
    page.click("text=Save Note")
    time.sleep(2)

    # 2. Open Task Dashboard
    print("Opening Task Dashboard...")
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tasksBtn = buttons.find(b => b.textContent.includes('Tasks'));
        if (tasksBtn) {
           tasksBtn.scrollIntoView();
           tasksBtn.click();
        }
    }''')

    # Wait until Task View is open
    page.wait_for_selector("text=Task Dashboard", timeout=5000)

    # 3. Verify Tasks are listed
    print("Verifying tasks...")
    expect(page.locator("text=Unique Task 1").first).to_be_visible(timeout=10000)
    expect(page.locator("text=Unique Task 2").first).to_be_visible()

    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/tasks_view_before.png")

    # 4. Complete a task
    print("Completing Task 1...")
    task_item = page.locator("div.bg-white, div.dark\\:bg-slate-800").filter(has_text="Unique Task 1").first
    complete_button = task_item.locator("button[title='Mark as Complete']")
    complete_button.click()

    # 5. Verify Task 1 is removed
    print("Verifying task removal...")
    expect(page.locator("text=Unique Task 1").first).not_to_be_visible(timeout=5000)
    expect(page.locator("text=Unique Task 2").first).to_be_visible()

    page.screenshot(path="verification/tasks_view_after.png")
    print("Verification complete!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()