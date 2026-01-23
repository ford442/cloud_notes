from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating...")
            page.goto("http://localhost:5173")

            page.wait_for_selector("text=Rich", timeout=10000)
            time.sleep(1)

            print("Creating Note via Sidebar...")
            page.click("button:has-text('New')")
            time.sleep(1)

            print("Editing Note...")
            page.fill("input[placeholder='Untitled Note...']", "Flashcard Test")

            page.click(".ProseMirror")
            page.keyboard.type("Capital of France :: Paris")

            page.click("button:has-text('Save Note')")
            time.sleep(3) # Wait for save to complete

            print("Reloading page to ensure persistence...")
            page.reload()
            page.wait_for_selector("text=Rich", timeout=10000)
            time.sleep(2)

            print("Opening Command Palette via JS...")
            page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));")

            # Wait for input
            print("Waiting for Command Palette input...")
            page.wait_for_selector("input[placeholder='Type a command or search...']", timeout=5000)

            print("Typing command...")
            page.fill("input[placeholder='Type a command or search...']", "Review Flashcards")
            time.sleep(1) # Wait for Fuse.js

            print("Selecting command...")
            # Click the result that contains the text. Use a specific selector to avoid ambiguity.
            # The result has "Review Flashcards" in a div.
            page.click("div:text('Review Flashcards')")

            print("Waiting for Flashcard View...")
            # We either see a card ("Question") or "All Caught Up!"
            # We need to wait for either.

            # Using wait_for_function or just attempting selector
            try:
                page.wait_for_selector("text=Question", timeout=5000)
                print("Found Flashcard Question!")
            except:
                print("Question not found, checking for 'All Caught Up'...")
                page.wait_for_selector("text=All Caught Up!", timeout=5000)
                print("Found 'All Caught Up!'")

            print("Taking Screenshot...")
            page.screenshot(path="verification/flashcards.png")
            print("Done.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            # We don't raise here so we can see the output in the tool result
        finally:
            browser.close()

if __name__ == "__main__":
    run()
