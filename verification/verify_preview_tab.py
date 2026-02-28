from playwright.sync_api import Page, expect, sync_playwright

def test_preview_tab(page: Page):
    # 1. Navigate to the app
    page.goto("http://localhost:5173/")

    # 2. Wait for the app to load
    page.wait_for_selector("text=KNOWLEDGE")

    # 3. Create a new note to ensure we are in write mode and have the default template
    page.click("text=+ New")
    page.wait_for_timeout(500)

    # 4. Switch to simple editor
    page.click("text=Simple")
    page.wait_for_timeout(500)

    # 5. Type some markdown
    editor = page.locator("textarea[placeholder='Start writing your note in Markdown...']")
    editor.fill("# Hello World\n\nThis is **bold** and *italic* text.")

    # 6. Click Preview tab
    page.click("text=Preview")
    page.wait_for_timeout(500)

    # 7. Take screenshot
    page.screenshot(path="verification/verification_preview_tab.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_preview_tab(page)
            print("Preview tab verified.")
        finally:
            browser.close()
