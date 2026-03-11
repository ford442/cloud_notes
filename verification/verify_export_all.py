import time
from playwright.sync_api import sync_playwright

def verify_export_all(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    page.wait_for_selector('input[placeholder="Note Title..."]', state='attached', timeout=10000)
    print("App loaded.")

    # Open Command Palette (Cmd+K). Since it's playwright we can just use Control+K
    page.keyboard.press("Control+K")
    time.sleep(1)

    print("Typing 'Export All'...")
    page.keyboard.type("Export All")
    time.sleep(1)

    # Take screenshot of command palette with the new action
    screenshot_path = "verification/export_all_command.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot taken: {screenshot_path}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify_export_all(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
