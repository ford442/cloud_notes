import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for editor to be visible
        print("Waiting for editor...")
        page.wait_for_selector(".ProseMirror", timeout=30000)

        # Click editor to focus
        page.click(".ProseMirror")
        # Clear any existing content to be safe
        page.keyboard.press("Control+A")
        page.keyboard.press("Backspace")

        # Type '/' to trigger slash command
        print("Typing slash command...")
        page.keyboard.type("/")
        time.sleep(2) # Wait for menu

        # Take screenshot of menu
        page.screenshot(path="verification_slash_menu.png")
        print("Menu screenshot saved to verification_slash_menu.png")

        # Check for Focus Mode option
        content = page.content()
        if "Focus Mode" in content:
            print("SUCCESS: 'Focus Mode' found in slash menu.")
        else:
            print("FAILURE: 'Focus Mode' NOT found in slash menu.")
            browser.close()
            return

        # Click Focus Mode
        print("Clicking Focus Mode...")
        page.click("text=Focus Mode")
        time.sleep(1)

        # Check if Sidebar is hidden
        # App.tsx: Sidebar wrapper has class 'hidden' if isFocusMode
        # <div className={`${isFocusMode ? 'hidden' : 'block h-full'}`}>
        # I can check visibility of an element inside Sidebar, e.g. "General"

        page.screenshot(path="verification_focus_mode.png")
        print("Focus Mode screenshot saved to verification_focus_mode.png")

        sidebar_visible = page.is_visible("text=General")
        if not sidebar_visible:
            print("SUCCESS: Sidebar is hidden in Focus Mode.")
        else:
            print("FAILURE: Sidebar is visible in Focus Mode.")

        # Check for Exit Focus button
        exit_btn = page.is_visible("text=Exit Focus")
        if exit_btn:
            print("SUCCESS: 'Exit Focus' button is visible.")
        else:
            print("FAILURE: 'Exit Focus' button is NOT visible.")

        # Click Exit Focus
        page.click("text=Exit Focus")
        time.sleep(1)

        # Check if Sidebar is visible again
        sidebar_visible = page.is_visible("text=General")
        if sidebar_visible:
            print("SUCCESS: Sidebar is visible after exiting Focus Mode.")
        else:
            print("FAILURE: Sidebar is hidden after exiting Focus Mode.")

        browser.close()

if __name__ == "__main__":
    run()
