import os
import time
from playwright.sync_api import sync_playwright

def verify_rich_embeds():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Listen for console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        # Navigate to the app
        print("Navigating to localhost:5173...")
        page.goto("http://localhost:5173")

        # Wait for the spinner to disappear
        page.wait_for_function("() => !document.querySelector('.lucide-loader') && !document.querySelector('.animate-spin')")
        print("Spinner disappeared.")

        # Click new note button if needed
        try:
            page.wait_for_selector("text=+ New", timeout=3000)
            page.click("text=+ New")
            print("Clicked + New")
        except:
            print("No + New button found or not needed.")

        # Wait for editor to load
        page.wait_for_selector(".ProseMirror", state="attached")
        print("ProseMirror attached.")

        editor = page.locator(".ProseMirror")
        editor.click()

        # Give it a moment to initialize
        time.sleep(2)

        # We need to simulate a paste that triggers handlePaste. Playwright's page.evaluate way:
        page.evaluate("""() => {
            const dt = new DataTransfer();
            dt.setData('text/plain', 'https://twitter.com/elonmusk/status/1608273870901096454');
            const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
            document.querySelector('.ProseMirror').dispatchEvent(e);
        }""")

        print("Pasted Twitter URL.")
        time.sleep(4) # Wait for embed iframe to render

        if not os.path.exists("verification"):
            os.makedirs("verification")

        page.screenshot(path="verification/twitter_embed.png")
        print("Twitter embed screenshot saved.")

        # Let's test figma too via slash command
        page.evaluate("""() => {
            document.querySelector('.ProseMirror').innerHTML = '<p></p>';
        }""")
        time.sleep(1)
        editor.click()
        editor.type("/Figma")
        time.sleep(1)
        page.keyboard.press("Enter")
        time.sleep(1)

        page.screenshot(path="verification/figma_command.png")

        browser.close()

if __name__ == "__main__":
    verify_rich_embeds()
