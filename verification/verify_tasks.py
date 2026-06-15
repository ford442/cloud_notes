from playwright.sync_api import sync_playwright, expect
import time
import os

def run(page):
    print("Navigating to app...")
    page.on("pageerror", lambda err: print(f">>> PAGE ERROR: {err}"))
    page.on("console", lambda msg: print(f">>> CONSOLE ERROR: {msg.text}") if msg.type == "error" else None)

    page.goto("http://localhost:5173", wait_until="networkidle")

    # Wait for React to mount something inside root
    print("Waiting for React mount...")
    page.wait_for_selector("#root > div", timeout=15000)

    # Wait for Landing page to load completely
    try:
        expect(page.locator("text=Start Using Cloud Notes").or_(page.locator("text=KNOWLEDGE")).first).to_be_visible(timeout=10000)
    except Exception as e:
        print(f"Failed to find starting text: {e}")
        page.screenshot(path="verification/error.png")
        raise

    # Click Start Using Cloud Notes if on landing page
    is_landing_page = page.evaluate('''() => {
        return !!document.querySelector('button')?.innerText?.includes('Start Using Cloud Notes');
    }''')

    if is_landing_page:
        print("Clicking Start Using Cloud Notes...")
        page.evaluate('''() => {
            const b = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.includes('Start Using Cloud Notes'));
            if(b) b.click();
        }''')
        time.sleep(2)

    # Wait for KNOWLEDGE sidebar section
    print("Waiting for KNOWLEDGE...")
    page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

    # 1. Create a new note with tasks
    print("Creating note with tasks...")
    page.evaluate('''() => {
        const b = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.includes('+ New'));
        if(b) b.click();
    }''')

    # Wait for editor to be ready
    print("Waiting for ProseMirror editor to fully initialize...")
    page.wait_for_selector(".ProseMirror", timeout=15000)
    page.wait_for_function("""
        () => {
            const el = document.querySelector('.ProseMirror');
            if (!el) return false;

            return el.offsetParent !== null &&
                   el.isContentEditable &&
                   !el.classList.contains('loading');
        }
    """, timeout=10000)
    print("✅ ProseMirror editor is ready")
    time.sleep(0.5)

    # Type title
    print("Typing title...")
    page.fill("input[placeholder='Note Title...']", "Task Test Note Unique")

    # Type content with tasks
    print("Typing content...")
    editor = page.locator(".ProseMirror")
    editor.click()
    time.sleep(1)

    # Check if floating button is there
    print("Clicking Tasks button...")
    page.evaluate('''() => {
        const btn = document.querySelector('button[title="Insert Task List"]');
        if (btn) btn.click();
    }''')
    time.sleep(1)

    page.keyboard.type("Unique Task 1")
    page.keyboard.press("Enter")
    time.sleep(0.5)
    page.keyboard.type("Unique Task 2")
    time.sleep(1.0)

    page.keyboard.press("Enter")
    time.sleep(1)

    # Save
    print("Saving...")
    page.click("text=Save Note")
    time.sleep(2)

    page.screenshot(path="verification/tasks_view_pre_dashboard.png")

    # 2. Open Task Dashboard
    print("Opening Task Dashboard...")
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tasksBtn = buttons.find(b => b.textContent.includes('Tasks') && b.parentElement.className.includes('flex'));
        if (tasksBtn) {
           tasksBtn.scrollIntoView();
           tasksBtn.click();
        }
    }''')

    # Wait until Task View is open
    page.wait_for_selector("text=Task Dashboard", timeout=5000)

    # 3. Verify Tasks are listed
    print("Verifying tasks...")
    page.screenshot(path="verification/tasks_view_before.png")
    expect(page.locator("text=Unique Task 1").first).to_be_visible(timeout=10000)
    expect(page.locator("text=Unique Task 2").first).to_be_visible()

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
