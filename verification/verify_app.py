from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the app (assuming it runs on localhost:5173 or similar after npm run dev)
        # Note: I need to start the app first.
        try:
            page.goto("http://localhost:5173")

            # Wait for sidebar to load
            page.wait_for_selector("text=Tags", timeout=10000)

            # Take a screenshot of the initial load
            page.screenshot(path="verification/app_loaded.png")
            print("Screenshot saved to verification/app_loaded.png")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
