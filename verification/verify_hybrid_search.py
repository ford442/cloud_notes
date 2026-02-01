from playwright.sync_api import sync_playwright, expect
import time

def run(page):
    # 1. Open App
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for app to load
    page.wait_for_selector("text=New", timeout=10000)

    # 2. Create Note 1: "Space Exploration"
    print("Creating Note 1...")
    page.get_by_text("+ New").click()
    page.locator("input[placeholder='Untitled Note...']").fill("Space Exploration")

    editor = page.locator('.ProseMirror')
    editor.fill("NASA and SpaceX are planning missions to Mars. The solar system has many planets orbiting the sun.")

    page.get_by_role("button", name="Save Note").click()
    page.get_by_text("Note saved successfully").wait_for()

    # Wait for indexing (First time model load might be slow)
    print("Waiting for indexing (First time, 30s)...")
    time.sleep(30)

    # 3. Create Note 2: "Planetary Science"
    print("Creating Note 2...")
    page.get_by_text("+ New").click()
    page.locator("input[placeholder='Untitled Note...']").fill("Planetary Science")
    editor.fill("Jupiter is the largest planet in our solar system. Saturn has rings. Earth is the third rock from the sun.")

    page.get_by_role("button", name="Save Note").click()
    page.get_by_text("Note saved successfully").wait_for()

    print("Waiting for indexing (10s)...")
    time.sleep(10)

    # 4. Open Command Palette
    print("Opening Command Palette...")
    # Trigger Cmd+K
    page.keyboard.press("Meta+k")

    # Scope to modal for assertions
    # The modal structure in CommandPalette.tsx:
    # <div className="fixed inset-0 ..."> ... <div className="relative w-full ...">
    modal = page.locator(".fixed.inset-0 .relative")

    # 5. Type query "Mars Mission"
    print("Typing query 'Mars Mission'...")
    page.locator("input[placeholder='Type a command or search...']").fill("Mars Mission")

    # Wait for debounce + async
    time.sleep(5)

    print("Taking screenshot of results...")
    page.screenshot(path="verification/hybrid_search_mars.png")

    # Check for Note 1 "Space Exploration" in modal
    print("Verifying 'Space Exploration' is in results...")
    expect(modal.get_by_text("Space Exploration")).to_be_visible()

    # 6. Clear and try a purely semantic query "Big gas giant"
    print("Typing query 'Big gas giant'...")
    page.locator("input[placeholder='Type a command or search...']").fill("")
    page.locator("input[placeholder='Type a command or search...']").fill("Big gas giant")

    time.sleep(5)

    print("Taking screenshot of semantic results...")
    page.screenshot(path="verification/hybrid_search_semantic.png")

    # We expect "Planetary Science" to appear.
    print("Verifying 'Planetary Science' is in results...")
    expect(modal.get_by_text("Planetary Science")).to_be_visible()

    # Check for Related badge inside modal
    print("Verifying 'Related' badge...")
    badge = modal.locator("text=Related")
    expect(badge).to_be_visible()
    print("SUCCESS: Related badge found!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_hybrid.png")
        finally:
            browser.close()
