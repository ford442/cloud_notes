
from playwright.sync_api import sync_playwright

def verify_ai_buttons():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Go to the app
            page.goto("http://localhost:5173")

            # Wait for content to load
            page.wait_for_selector("text=KNOWLEDGE", timeout=10000)

            # Check for the Summarize button in the header (icon)
            # It has a title "Summarize Note"
            summarize_btn = page.locator('button[title="Summarize Note"]')
            if summarize_btn.count() > 0:
                print("Summarize button found")
            else:
                print("Summarize button NOT found")

            # Check for the Auto-Tag button in the footer
            # It has title "Auto-Suggest Tags"
            autotag_btn = page.locator('button[title="Auto-Suggest Tags"]')
            if autotag_btn.count() > 0:
                print("Auto-Tag button found")
            else:
                print("Auto-Tag button NOT found")

            # Take a screenshot to verify placement
            page.screenshot(path="verification/ai_buttons.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_ai_buttons()
