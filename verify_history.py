from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Go to app
    page.goto("http://localhost:5173")

    # 2. Create Note
    # We must wait for loading to finish
    page.locator(".lucide-loader").wait_for(state="hidden")
    # Wait for the input to be attached and ready
    title_input = page.get_by_placeholder("Note Title...")
    title_input.wait_for(state="attached")
    title_input.fill("History Test Note")

    # 3. Add Content (First Version)
    # The editor is a contenteditable div
    editor = page.locator(".ProseMirror")
    editor.click()
    editor.fill("This is the first version of the note.")

    # 4. Save
    page.get_by_role("button", name="Save Note").click()
    # Wait for save (toast might appear)
    page.wait_for_timeout(2000)

    # 5. Change Content (Second Version)
    editor.fill("This is the SECOND version of the note.")

    # 6. Save Again
    page.get_by_role("button", name="Save Note").click()
    page.wait_for_timeout(2000)

    # Click the note in the sidebar so it's selected and history is enabled
    page.get_by_text("History Test Note", exact=True).first.click()
    page.wait_for_timeout(500)

    # 7. Open History
    # The button has title "View History"
    page.get_by_title("View History").click()

    # 8. Wait for Modal
    page.get_by_text("Note History").wait_for()

    # 9. Test diff view modes
    page.get_by_role("button", name="Line Diff").click()
    page.wait_for_timeout(500)

    page.screenshot(path="verification_history_modal_line_diff.png")
    print("Screenshot taken: verification_history_modal_line_diff.png")

    page.get_by_role("button", name="Word Diff").click()
    page.wait_for_timeout(500)

    page.screenshot(path="verification_history_modal_word_diff.png")
    print("Screenshot taken: verification_history_modal_word_diff.png")

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
