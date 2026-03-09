from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Go to app
    page.goto("http://localhost:5173")

    # 2. Create a new Note
    page.get_by_placeholder("Note Title...").fill("Fix Test Note")
    page.locator(".ProseMirror").fill("Initial Content")
    page.get_by_role("button", name="Save Note").click()
    page.wait_for_timeout(1000)

    # Create history
    page.locator(".ProseMirror").fill("Second Content")
    page.get_by_role("button", name="Save Note").click()
    page.wait_for_timeout(1000)

    # 3. Open History & Restore
    page.get_by_title("View History").click()
    page.get_by_text("Note History").wait_for()

    # Restore older version
    history_items = page.locator("div.divide-y > button")
    if history_items.count() >= 1:
        history_items.nth(0).click() # Click first one (doesn't matter which, just need a restore event)
        page.get_by_role("button", name="Restore This Version").click()
        page.locator("div[role='dialog']").get_by_role("button", name="Confirm").click()
        page.get_by_text("Note History").wait_for(state="hidden")

    # 4. Type something
    editor = page.locator(".ProseMirror")
    initial_text = editor.inner_text()
    print(f"Text after restore: {initial_text}")

    editor.click()
    editor.type(" - appended text")

    # 5. Check if content reset
    # If the bug exists, the content might reset to 'value' (which is the restored content) on next render
    # We wait a bit or trigger another event
    page.wait_for_timeout(500)

    final_text = editor.inner_text()
    print(f"Text after typing: {final_text}")

    if "appended text" in final_text:
        print("SUCCESS: Content persisted after typing.")
    else:
        print("FAILURE: Content reset or typing failed.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
