from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(err))
        page.on("console", lambda msg: errors.append(msg.text) if "Invalid content for node" in msg.text else None)

        page.goto('http://localhost:5173')

        page.wait_for_selector('.lucide-loader', state='hidden', timeout=10000)
        page.wait_for_timeout(1000)

        page.click('body')
        page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
        page.wait_for_timeout(500)
        page.keyboard.type('Open Daily Note')
        page.wait_for_timeout(1000)

        # Select by enter
        page.keyboard.press("Enter")
        page.wait_for_timeout(2000)

        page.wait_for_timeout(2000)

        for err in errors:
            print(f"Browser error: {err}")

        if not errors:
            print("Verified: No errors occurred.")

        browser.close()

if __name__ == "__main__":
    run()
