import time
from playwright.sync_api import sync_playwright

def verify(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for app to load
    page.wait_for_selector('input[placeholder="Note Title..."]', state='attached')
    print("App loaded.")

    # 1. Verify Settings & Data Tab
    print("Opening Settings...")
    page.click('button[title="Settings"]')
    time.sleep(1)

    print("Clicking Data tab...")
    page.click("text=Data")
    time.sleep(0.5)

    # Verify Re-index button
    reindex_btn = page.query_selector("text=Re-index All Notes")
    if reindex_btn:
        print("Re-index button found.")

    # Take screenshot of settings
    page.screenshot(path="verification_settings_data.png")
    print("Screenshot taken: verification_settings_data.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
