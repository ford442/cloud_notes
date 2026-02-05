from playwright.sync_api import sync_playwright, expect

def verify(page):
    # Set up dialog handler FIRST
    def handle_dialog(dialog):
        print(f"Alert message: {dialog.message}")
        if "Statistics" in dialog.message and "Words: 6" in dialog.message:
             print("Stats alert verified.")
        else:
             print(f"Stats alert text mismatch: {dialog.message}")
        dialog.accept()

    page.on("dialog", handle_dialog)

    page.goto("http://localhost:5173")

    # Wait for editor
    page.wait_for_selector(".ProseMirror")
    editor = page.locator(".ProseMirror")
    editor.click()

    # Test Slash Command Menu
    editor.type("/")
    page.wait_for_selector(".tippy-content") # Slash menu should appear

    page.screenshot(path="verification/slash_menu_open.png")
    print("Screenshot taken: slash_menu_open.png")

    # Test Callout
    editor.type("callout")
    page.wait_for_timeout(500) # Wait for filter
    page.screenshot(path="verification/slash_menu_callout.png")
    print("Screenshot taken: slash_menu_callout.png")

    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    page.screenshot(path="verification/callout_inserted.png")
    print("Screenshot taken: callout_inserted.png")

    # Verify content
    content = editor.inner_text()
    if "Note:" in content:
        print("Callout inserted successfully.")
    else:
        print("Callout failed to insert.")

    # Test Stats Command
    # Clear editor
    editor.fill("")
    editor.type("Hello world this is a test.")
    editor.press("Enter")
    editor.type("/stats")
    page.wait_for_timeout(1000) # Wait for filter to update
    page.screenshot(path="verification/slash_menu_stats.png")
    print("Screenshot taken: slash_menu_stats.png")

    # Select the first item (should be Note Statistics)
    page.keyboard.press("Enter")
    # Wait longer to ensure dialog logic has time to fire if it's async
    page.wait_for_timeout(2000)


if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
