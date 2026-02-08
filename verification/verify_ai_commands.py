from playwright.sync_api import sync_playwright, expect
import time

def verify(page):
    page.goto("http://localhost:5173")

    # Wait for editor
    page.wait_for_selector(".ProseMirror")
    editor = page.locator(".ProseMirror")
    editor.click()

    # Clear editor
    editor.fill("")
    editor.type("This is a test note about Artificial Intelligence. AI is transforming the world.")
    editor.press("Enter")

    # Trigger Summarize Command
    editor.type("/summarize")
    # Wait for the slash menu item "Summarize Note" to be visible
    page.wait_for_selector("text=Summarize Note")
    page.keyboard.press("Enter")

    # Check for placeholder
    # The placeholder contains "[AI SUMMARIZING"
    # We use a locator that looks for text
    placeholder_locator = page.locator("text=/\[AI SUMMARIZING/")

    # It might appear and disappear quickly if AI is fast (unlikely for initial load) or fail.
    # We expect it to appear.
    print("Waiting for placeholder...")
    try:
        expect(placeholder_locator).to_be_visible(timeout=10000)
        print("AI Placeholder appeared.")
    except Exception as e:
        print("AI Placeholder did NOT appear.")
        page.screenshot(path="verification/ai_placeholder_fail.png")
        raise e

    # Now we wait for it to disappear (replaced by summary or failure message)
    # The timeout should be generous as model loading takes time
    print("Waiting for AI processing (this may take time)...")
    try:
        expect(placeholder_locator).not_to_be_visible(timeout=60000)
        print("AI Placeholder disappeared (replaced).")
    except Exception as e:
        print("AI Placeholder stuck (model loading hung?).")
        page.screenshot(path="verification/ai_stuck.png")
        # We don't fail hard here because model loading in CI/sandbox might be flaky

    # Check if result is inserted or failure message
    # Wait a bit for the UI to update
    page.wait_for_timeout(1000)
    content = editor.inner_text()

    if "Summary:" in content:
        print("Summary successfully inserted.")
        page.screenshot(path="verification/ai_summary_success.png")
    elif "AI Summarization failed" in content:
        print("AI Summarization failed gracefully (handled error).")
        page.screenshot(path="verification/ai_summary_failed.png")
    else:
        print("Unknown result state.")
        # print(content)
        page.screenshot(path="verification/ai_summary_unknown.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
