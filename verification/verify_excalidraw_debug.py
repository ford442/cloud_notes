from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    try:
        page.goto("http://localhost:5173/")
        page.wait_for_selector(".ProseMirror")
        page.click(".ProseMirror")
        page.keyboard.type("/Excalidraw")
        page.wait_for_timeout(1000)
        page.keyboard.press("Enter")
        page.wait_for_selector(".excalidraw-component")
        page.wait_for_timeout(2000)
        page.hover(".excalidraw-component")
        page.wait_for_timeout(500)
        page.get_by_text("Edit Sketch").click()
        page.wait_for_selector("button:has-text('Done')", timeout=5000)
        page.get_by_text("Done").click()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
