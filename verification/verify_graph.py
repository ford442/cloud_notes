import time
from playwright.sync_api import sync_playwright, expect

def verify_graph_view():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for content to load
            print("Waiting for content...")
            # Use a more reliable selector
            page.wait_for_selector("input[placeholder='Untitled Note...']", timeout=10000)

            # Click the Graph button
            print("Clicking Graph button...")
            graph_btn = page.get_by_role("button", name="Graph")
            expect(graph_btn).to_be_visible()
            graph_btn.click()

            # Wait for Graph view to appear (canvas)
            print("Waiting for Graph canvas...")
            page.wait_for_selector("canvas", timeout=10000)

            # Take screenshot of Graph View
            print("Taking screenshot...")
            page.screenshot(path="verification/graph_view.png")

            # Click Rich button to switch back
            print("Switching back to Rich mode...")
            page.get_by_role("button", name="Rich").click()

            # Verify editor is back
            # The editor content area has class 'prose'
            page.wait_for_selector(".prose", timeout=5000)

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_2.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_graph_view()
