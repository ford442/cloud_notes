from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(err))
        page.on("console", lambda msg: errors.append(msg.text) if "error" in msg.text.lower() else None)

        page.goto('http://localhost:5173')

        # Wait for app to load
        page.wait_for_selector('.lucide-loader', state='hidden', timeout=10000)
        page.wait_for_timeout(1000)

        # Type some text
        page.click('.ProseMirror')
        page.keyboard.type("hello world")

        # Select the text
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")
        page.keyboard.press("Shift+ArrowLeft")

        # Open Command Palette
        page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
        page.wait_for_timeout(500)

        # Search for UPPERCASE
        page.keyboard.type('UPPERCASE')
        page.wait_for_timeout(500)
        page.keyboard.press("Enter")

        # Check result
        page.wait_for_timeout(500)
        content = page.evaluate("document.querySelector('.ProseMirror').innerText")
        print(f"Content after UPPERCASE: '{content.strip()}'")

        if "HELLO WORLD" not in content:
            print("ERROR: UPPERCASE transformation failed!")
            errors.append("UPPERCASE failed")

        if not errors:
            print("Verified: Text Tools (UPPERCASE) worked correctly.")

        browser.close()

if __name__ == "__main__":
    run()
