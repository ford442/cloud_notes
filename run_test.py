import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        crash_detected = False
        def handle_console_message(msg):
            nonlocal crash_detected
            text = msg.text
            if "Invalid content for node listItem" in text:
                print(f"CRASH DETECTED IN CONSOLE: {text}")
                crash_detected = True

        page.on("console", handle_console_message)
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        await page.goto("http://localhost:5173")
        await page.wait_for_selector(".ProseMirror", state="attached")

        await page.evaluate("""() => {
             window.PluginRegistry.createNote({
                 title: 'Test Crash',
                 content: '- [ ] ',
                 subject: 'Test',
                 section: 'Test',
                 tags: 'test'
             });
        }""")

        await asyncio.sleep(2)
        print(f"Test completed. Crashed: {crash_detected}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
