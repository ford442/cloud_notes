from playwright.sync_api import sync_playwright, expect
import time

def run(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")
    page.wait_for_selector("text=New", timeout=10000)

    print("Creating Note 'Jupiter'...")
    page.get_by_text("+ New").click()
    page.locator("input[placeholder='Untitled Note...']").fill("Jupiter")
    page.locator('.ProseMirror').fill("Gas giant planet.")
    page.get_by_role("button", name="Save Note").click()
    page.get_by_text("Note saved successfully").wait_for()

    print("Waiting 5s...")
    time.sleep(5)

    print("Opening Command Palette...")
    page.keyboard.press("Meta+k")

    print("Searching 'Jupiter'...")
    page.locator("input[placeholder='Type a command or search...']").fill("Jupiter")

    time.sleep(2)
    page.screenshot(path="verification/simple_search.png")

    print("Verifying 'Jupiter' in results...")
    expect(page.locator(".fixed").get_by_text("Jupiter").last).to_be_visible()
    print("SUCCESS: Found Jupiter")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_simple.png")
        finally:
            browser.close()
