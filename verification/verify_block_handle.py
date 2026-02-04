from playwright.sync_api import sync_playwright, expect
import time

def run(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=New", timeout=10000)

    print("Creating Note for Block Handle Test...")
    page.get_by_text("+ New").click()
    page.locator("input[placeholder='Untitled Note...']").fill("Drag Test")

    # Fill editor with multiple paragraphs
    editor = page.locator('.ProseMirror')
    editor.click()
    editor.fill("Line 1")
    editor.press("Enter")
    editor.type("Line 2")

    # Wait a bit
    time.sleep(1)

    print("Hovering over Line 1...")
    # We need to find the specific paragraph
    line1 = page.locator('.ProseMirror p').first
    line1.hover()

    # Expect handle to appear
    print("Checking for Block Handle...")
    handle = page.locator('[data-testid="block-handle"]')

    # Wait for it to appear
    handle.wait_for(state="visible", timeout=5000)
    expect(handle).to_be_visible()

    print("Screenshotting...")
    page.screenshot(path="verification/block_handle.png")

    print("SUCCESS: Block Handle appeared")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_block_handle.png")
            raise e
        finally:
            browser.close()
