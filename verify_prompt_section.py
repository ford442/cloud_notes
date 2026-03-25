import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        print("Waiting for editor...")
        page.wait_for_selector(".ProseMirror", timeout=10000)

        # Wait for any loading spinners to disappear
        time.sleep(3)

        page.click(".ProseMirror")

        print("Typing slash command '/prompt'...")
        page.keyboard.type("/prompt")
        time.sleep(1)

        # Select the 'Prompt Section' option
        page.keyboard.press("Enter")
        time.sleep(1)

        # Deal with the max length prompt
        print("Handling max length prompt...")
        # Since it uses PluginRegistry.prompt which opens our custom Modal dialog
        page.wait_for_selector("div[role='dialog'] input")
        page.keyboard.type("50")
        page.keyboard.press("Enter")
        time.sleep(1)

        print("Typing inside prompt section...")
        page.keyboard.type("This is a test prompt.")
        time.sleep(1)

        screenshot_path = "verification_prompt_section.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        content = page.content()
        if 'data-max-length="50"' in content or 'data-type="prompt-section"' in content:
            print("SUCCESS: Prompt section rendered.")
        else:
            print("FAILURE: Prompt section NOT found.")

        # Test over limit condition
        print("Typing to exceed limit...")
        for _ in range(40):
             page.keyboard.type("a")

        time.sleep(1)
        page.screenshot(path="verification_prompt_section_overlimit.png")
        print("Screenshot saved to verification_prompt_section_overlimit.png")

        browser.close()

if __name__ == "__main__":
    run()
