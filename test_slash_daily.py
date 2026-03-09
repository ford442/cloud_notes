import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.goto("http://localhost:5173")
        page.wait_for_selector(".ProseMirror", timeout=10000)
        time.sleep(3)
        page.click(".ProseMirror")

        # Type '/dai'
        page.keyboard.type("/dai")
        time.sleep(1)

        page.keyboard.press("ArrowDown")
        time.sleep(0.5)
        page.keyboard.press("Enter")
        time.sleep(1)

        content = page.content()

        # Now check if other items are rendered
        if "Journal" in content:
            print("SUCCESS: Inserted Journal template.")
        else:
            print("FAILURE: Did not insert Journal.")

        browser.close()

if __name__ == "__main__":
    run()
