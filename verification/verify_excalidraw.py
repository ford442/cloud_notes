from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        page.goto("http://localhost:5173/")

        # Wait for editor
        print("Waiting for editor...")
        page.wait_for_selector(".ProseMirror")

        # Focus editor
        page.click(".ProseMirror")

        # Type command
        print("Typing /Excalidraw...")
        page.keyboard.type("/Excalidraw")
        page.wait_for_timeout(1000) # Wait for slash menu
        page.keyboard.press("Enter")

        # Wait for excalidraw component
        print("Waiting for Excalidraw component...")
        page.wait_for_selector(".excalidraw-component")
        page.wait_for_timeout(2000) # Wait for canvas to render

        # Take screenshot of inserted component
        page.screenshot(path="verification/1_inserted.png")

        # Hover over component to show Edit button
        print("Hovering...")
        page.hover(".excalidraw-component")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/2_hover_edit.png")

        # Click Edit Sketch
        print("Clicking Edit Sketch...")
        page.get_by_text("Edit Sketch").click()

        # Wait for Done button
        print("Waiting for Done button...")
        page.wait_for_selector("button:has-text('Done')")
        page.wait_for_timeout(1000) # Wait for edit mode transition
        page.screenshot(path="verification/3_edit_mode.png")

        # Click Done
        print("Clicking Done...")
        page.get_by_text("Done").click()
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/4_done.png")

        print("Success!")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
