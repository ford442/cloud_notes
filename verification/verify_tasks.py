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
    page.fill("input[placeholder='Note Title...']", "Task Test Note")

    # Type content with tasks
    # The Tiptap editor with TaskList extension might format "- [ ] " differently.
    # It converts it to a <ul data-type="taskList">.
    # When `getText()` is called or when saved, `turndown` + `gfm` should convert it back to "- [ ] ".
    # Let's type it simulating user input.
    editor = page.locator(".ProseMirror")
    editor.click()

    # Using the slash command for Task List might be more reliable if typing "- [ ] " is flaky
    editor.type("/task")
    page.keyboard.press("Enter") # Select Task List
    editor.type("Task 1")
    page.keyboard.press("Enter")
    editor.type("Task 2")

    # Save
    page.click("text=Save Note")
    time.sleep(2)

    # 2. Open Task Dashboard
    print("Opening Task Dashboard...")
    # Click "Tasks" button in header
    page.click("button:has-text('Tasks')")

    # Verify Task View is open
    page.wait_for_selector("text=Task Dashboard", timeout=5000)

    # 3. Verify Tasks are listed
    print("Verifying tasks...")
    # It might take a moment to scan, wait longer and retry if needed
    try:
        page.wait_for_selector("text=Task 1", timeout=10000)
    except:
        print("Timeout waiting for Task 1. Dumping page content for debug.")
        # print(page.content())

    expect(page.locator("text=Task 1")).to_be_visible()
    expect(page.locator("text=Task 2")).to_be_visible()

    # Take screenshot of tasks list
    if not os.path.exists("verification"):
        os.makedirs("verification")
    page.screenshot(path="verification/tasks_view_before.png")

    # 4. Complete a task
    print("Completing Task 1...")
    # Find the button next to Task 1
    # We look for the task item container, then the button inside it
    task_item = page.locator("div.bg-white, div.dark\\:bg-slate-800").filter(has_text="Task 1").first
    complete_button = task_item.locator("button[title='Mark as Complete']")
    complete_button.click()

    # 5. Verify Task 1 is removed
    print("Verifying task removal...")
    # Wait for it to disappear
    expect(page.locator("text=Task 1")).not_to_be_visible(timeout=5000)

    # Verify Task 2 is still there
    expect(page.locator("text=Task 2")).to_be_visible()

    # Take final screenshot
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
