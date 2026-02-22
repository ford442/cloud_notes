from playwright.sync_api import sync_playwright

def verify_lazy_loading():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        try:
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        print("Waiting for initial load...")
        page.wait_for_timeout(3000) # Wait for app to settle

        print("Taking screenshot of default view (Block Editor)...")
        page.screenshot(path="verification/1_block_editor.png")

        print("Switching to Graph Mode...")
        try:
            graph_btn = page.get_by_role("button", name="Graph")
            if graph_btn.is_visible():
                graph_btn.click()
                # Wait for Suspense/Lazy load
                page.wait_for_timeout(5000)
                print("Taking screenshot of Graph View...")
                page.screenshot(path="verification/2_graph_view.png")
            else:
                print("Graph button not found!")
        except Exception as e:
             print(f"Error switching to Graph: {e}")


        print("Switching to Canvas Mode...")
        try:
            canvas_btn = page.get_by_role("button", name="Canvas")
            if canvas_btn.is_visible():
                canvas_btn.click()
                # Wait for Suspense/Lazy load
                page.wait_for_timeout(5000)
                print("Taking screenshot of Canvas Editor...")
                page.screenshot(path="verification/3_canvas_editor.png")
            else:
                print("Canvas button not found!")
        except Exception as e:
            print(f"Error switching to Canvas: {e}")

        browser.close()

if __name__ == "__main__":
    verify_lazy_loading()
