from playwright.sync_api import sync_playwright

def test_task_view():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="/home/jules/verification/video")
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for app to load
            page.wait_for_selector(".lucide-loader", state="detached", timeout=10000)
            page.wait_for_selector(".animate-spin", state="detached", timeout=10000)

            # Set up local storage for tests
            page.evaluate("localStorage.setItem('author_name', 'Anon');")
            page.evaluate("localStorage.setItem('theme', 'light');")
            page.wait_for_timeout(500)

            print("Opening Task View...")
            page.get_by_text("Tasks").click()
            page.wait_for_timeout(1000)

            print("Taking screenshot...")
            page.screenshot(path="/home/jules/verification/task_view_screenshot.png")
            page.wait_for_timeout(1000)

        except Exception as e:
            print(f"Error: {e}")
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    test_task_view()