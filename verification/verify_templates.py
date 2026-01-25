from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Open the app
    print("Navigating to app...")
    page.goto("http://localhost:3000")

    # Wait for the editor to load
    print("Waiting for editor...")
    page.wait_for_selector(".ProseMirror")

    # Clear content
    page.click(".ProseMirror")
    page.keyboard.press("Control+A")
    page.keyboard.press("Backspace")

    # Type / to open slash commands
    print("Typing slash command...")
    page.keyboard.type("/")

    # Wait for suggestion list
    print("Waiting for menu...")
    page.wait_for_selector(".tippy-content")

    # Check for "Meeting Notes" text
    print("Verifying menu items...")
    expect(page.get_by_text("Meeting Notes")).to_be_visible()
    expect(page.get_by_text("Project Plan")).to_be_visible()

    # Take screenshot of the menu
    page.screenshot(path="verification/slash_commands.png")

    # Setup dialog handler
    def handle_dialog(dialog):
        print(f"Dialog opened: {dialog.message}")
        if "Topic" in dialog.message:
            dialog.accept("Frontend Verify")
        elif "Attendees" in dialog.message:
            dialog.accept("Alice, Bob")
        else:
            dialog.accept("Test Value")

    page.on("dialog", handle_dialog)

    # Select "Meeting Notes"
    print("Selecting Meeting Notes...")
    page.get_by_text("Meeting Notes").click()

    # Wait for insertion
    page.wait_for_timeout(1000)

    # Verify content inserted
    content = page.inner_text(".ProseMirror")
    print(f"Content: {content}")

    if "Meeting: Frontend Verify" in content and "Alice, Bob" in content:
        print("Template inserted correctly with variables!")
    else:
        raise Exception("Template insertion failed or variables not replaced.")

    # Take screenshot of result
    page.screenshot(path="verification/template_result.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
