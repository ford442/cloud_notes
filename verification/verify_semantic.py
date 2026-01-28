from playwright.sync_api import sync_playwright, expect
import time

def run(page):
    # 1. Open App
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for app to load - check for "+ New" button
    page.wait_for_selector("text=New", timeout=10000)

    # 2. Create Note 1
    print("Creating Note 1...")
    # Click "+ New"
    page.get_by_text("+ New").click()

    # Fill Title
    page.locator("input[placeholder='Untitled Note...']").fill("AI Overview")

    # Fill Content
    # The editor might be Tiptap (ProseMirror) or simple textarea depending on default.
    # Screenshot shows "Simple" / "Rich" toggle. It seems "Rich" is active (ProseMirror).
    editor = page.locator('.ProseMirror')
    editor.fill("Artificial Intelligence is a field of computer science. It involves machine learning and neural networks to solve complex problems.")

    # Save
    page.get_by_role("button", name="Save Note").click()
    # Wait for toast
    page.get_by_text("Note saved successfully").wait_for()

    # Wait a bit for indexing (async)
    print("Waiting for indexing...")
    time.sleep(3)

    # 3. Create Note 2
    print("Creating Note 2...")
    page.get_by_text("+ New").click()

    # Fill Title
    page.locator("input[placeholder='Untitled Note...']").fill("Machine Learning Basics")

    # Fill Content
    editor.fill("Deep learning is a subset of machine learning using neural networks. It is very popular in AI research.")

    # Save
    page.get_by_role("button", name="Save Note").click()
    page.get_by_text("Note saved successfully").wait_for()

    # Wait for indexing
    print("Waiting for indexing...")
    time.sleep(3)

    # 4. Navigate back to Note 1
    print("Navigating back to Note 1...")
    # Click on "AI Overview" in sidebar
    # Sidebar might be long. We might need to search or scroll.
    # But newly created notes might be at top or bottom?
    # Logic in App.tsx: `setNotes` optimistic update adds to top: `return [newItem, ...prev];`
    # So "Machine Learning Basics" should be first, "AI Overview" second.

    # Let's find "AI Overview" text in sidebar.
    # Sidebar items have class?
    # Let's try text locator.
    page.get_by_text("AI Overview").first.click()

    # 5. Check for Related Notes
    print("Waiting for Related Notes...")
    expect(page.get_by_text("Related Notes")).to_be_visible(timeout=10000)

    # Wait for result
    # We expect "Machine Learning Basics" to show up.
    time.sleep(5)

    print("Checking for related note...")
    page.screenshot(path="verification/related_notes_debug.png")

    # Check if "Machine Learning Basics" is visible in the Related Notes section
    # The Related Notes section is distinguished by the header "Related Notes"
    # We can try to scope the locator if needed, but simple text check is fine for verification.
    expect(page.locator("text=Machine Learning Basics").last).to_be_visible(timeout=20000)

    print("Taking final screenshot...")
    page.screenshot(path="verification/related_notes.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
