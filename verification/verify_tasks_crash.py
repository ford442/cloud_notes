import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        crash_detected = False
        def handle_console_message(msg):
            nonlocal crash_detected
            text = msg.text
            if "Browser error: Invalid content for node listItem: <>" in text or "Invalid content for node listItem" in text:
                print(f"CRASH DETECTED IN CONSOLE: {text}")
                crash_detected = True

        page.on("console", handle_console_message)
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        print("Navigating to app...")
        await page.goto("http://localhost:5173")

        # Wait for app to load
        await page.wait_for_selector(".ProseMirror", state="attached")

        try:
            await page.wait_for_selector(".lucide-loader", state="hidden", timeout=5000)
            await page.wait_for_selector(".animate-spin", state="hidden", timeout=5000)
        except:
            pass

        print("Triggering evaluate script to test raw createNote issue...")
        # The issue states: "When using ctx.createNote() to create a note initialized with a Markdown string containing task lists (- [ ]), navigating to the new note causes <BlockEditor> to crash."
        # We can simulate this using the plugin system which is exposed on window (or we can just evaluate code to inject the action).

        await page.evaluate("""() => {
             // Create a fake plugin that calls createNote
             window.dispatchEvent(new CustomEvent('cloud-notes-command', {
                 detail: {
                     action: 'createNote',
                     payload: {
                         title: 'Test Crash',
                         content: '- [ ] ',
                         subject: 'Test',
                         section: 'Test',
                         tags: 'test'
                     }
                 }
             }));
        }""")

        # That event doesn't exist, let's use the UI
        # First we'll edit our daily.tsx temporarily to see if it causes a crash

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
