from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Go to app
    page.goto("http://localhost:5173")

    # 2. Create Note
    page.get_by_placeholder("Note Title...").fill("History Test Note")

    # 3. Add Content (First Version)
    # The editor is a contenteditable div
    editor = page.locator(".ProseMirror")
    editor.click()
    editor.fill("This is the first version of the note.")

    # 4. Save
    page.get_by_role("button", name="Save Note").click()
    # Wait for save (toast might appear)
    page.wait_for_timeout(1000)

    # 5. Change Content (Second Version)
    editor.fill("This is the SECOND version of the note.")

    # 6. Save Again
    page.get_by_role("button", name="Save Note").click()
    page.wait_for_timeout(1000)

    # 7. Open History
    # The button has title "View History"
    page.get_by_title("View History").click()

    # 8. Wait for Modal
    page.get_by_text("Note History").wait_for()

    # 9. Screenshot Modal
    page.screenshot(path="verification_history_modal.png")
    print("Screenshot taken: verification_history_modal.png")

    # 10. Restore First Version
    # Click the second item in the list (the older one)
    # The list items are buttons. The first one is the current (latest), second is the previous.
    # We might have only one entry if the first save didn't register a history event distinct from creation?
    # Let's check how many items.
    history_items = page.locator("div.divide-y > button")
    count = history_items.count()
    print(f"Found {count} history items")

    if count >= 2:
        # Click the older one (second item, index 1)
        history_items.nth(1).click()

        # Click Restore
        page.get_by_role("button", name="Restore This Version").click()

        # Handle Custom Confirm Dialog
        page.locator("div[role='dialog']").get_by_role("button", name="Confirm").click()

        # Wait for modal to close
        page.get_by_text("Note History").wait_for(state="hidden")

        # 11. Screenshot Restored Editor
        page.screenshot(path="verification_restored_editor.png")
        print("Screenshot taken: verification_restored_editor.png")

        # Verify content
        content = editor.inner_text()
        print(f"Restored Content: {content}")
        if "first version" in content:
            print("SUCCESS: Content restored correctly.")
        else:
            print("FAILURE: Content mismatch.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
