from playwright.sync_api import sync_playwright, expect

def run(page):
    page.on("pageerror", lambda err: print(">>> PAGE ERROR:", err))
    page.on("console", lambda msg: print(">>> CONSOLE:", msg.text) if msg.type == "error" else None)

    print("Navigating to app...")
    page.goto("http://localhost:5173", wait_until="networkidle")
    page.wait_for_load_state("domcontentloaded")

    # Wait for something that only exists after React has mounted and rendered
    page.wait_for_selector("#root > div", timeout=15000)

    # Wait for app to load
    expect(page.get_by_text("Start Using Cloud Notes").or_(page.get_by_text("KNOWLEDGE"))).to_be_visible(timeout=10000)
    print("App loaded successfully!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error.png")
        finally:
            browser.close()
