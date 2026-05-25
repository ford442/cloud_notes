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

        print("Creating a secret note...")
        # Write title
        page.get_by_placeholder("Note Title...").fill("Secret Password Info")

        # Write content
        editor = page.locator(".ProseMirror")
        editor.click()
        editor.fill("My secret password is: HUNTER2")

        time.sleep(1)

        # Open Command Palette (Cmd+K)
        # Using specific keys because of Playwright's meta vs control modifier

        # Deselect editor to avoid typing into it
        page.locator("body").click(position={"x": 10, "y": 10})
        time.sleep(1)

        page.keyboard.press("Meta+k" if "Mac" in page.evaluate("navigator.platform") else "Control+k")
        time.sleep(1)

        print("Searching for Encrypt Note...")
        page.keyboard.type("Encrypt Note")
        time.sleep(1)

        page.locator("button").filter(has_text="Encrypt Note").first.click()
        time.sleep(1)

        # Handle the custom PluginRegistry.prompt
        # It's rendered as a Dialog component with a text input
        print("Entering password...")
        prompt_input = page.locator("div[role='dialog'] input")
        prompt_input.wait_for()
        prompt_input.fill("testpassword123")
        page.locator("div[role='dialog']").get_by_text("OK").click()

        time.sleep(2)

        print("Verifying note is encrypted...")
        page.screenshot(path="verification_e2ee_locked.png")
        print("Screenshot saved to verification_e2ee_locked.png")

        # The screen should now say "Encrypted Note"
        content = page.content()
        if "Encrypted Note" in content and "HUNTER2" not in content:
            print("SUCCESS: Note was encrypted and original content is hidden.")
        else:
            print("FAILURE: Note encryption failed or content is still visible.")

        print("Decrypting the note...")
        page.locator("body").click(position={"x": 10, "y": 10})
        time.sleep(1)
        page.keyboard.press("Meta+k" if "Mac" in page.evaluate("navigator.platform") else "Control+k")
        time.sleep(1)
        page.keyboard.type("Decrypt Note")
        time.sleep(2)
        page.locator("button").filter(has_text="Decrypt Note").first.click()
        time.sleep(1)

        # Enter password again
        print("Entering password for decryption...")
        prompt_input = page.locator("div[role='dialog'] input")
        prompt_input.wait_for()
        prompt_input.fill("testpassword123")
        page.locator("div[role='dialog']").get_by_text("OK").click()

        time.sleep(2)

        page.screenshot(path="verification_e2ee_unlocked.png")
        print("Screenshot saved to verification_e2ee_unlocked.png")

        content = page.content()
        if "My secret password is: HUNTER2" in content and "Encrypted Note" not in content:
            print("SUCCESS: Note was decrypted successfully and original content restored.")
        else:
            print("FAILURE: Decryption failed or original content is missing.")

        browser.close()

if __name__ == "__main__":
    run()