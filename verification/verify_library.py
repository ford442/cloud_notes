import asyncio
import os
import shutil
import re
from playwright.sync_api import sync_playwright, expect

def run_cuj(page):
    print("Navigating to dev server...")
    page.goto("http://localhost:5173")

    print("Waiting for app to load...")
    page.wait_for_selector(".lucide-loader", state="hidden")
    page.wait_for_selector(".animate-spin", state="hidden")
    page.wait_for_timeout(1000)

    print("Switching to library mode via command palette...")
    page.click("body") # Ensure focus
    page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")

    page.wait_for_selector('input[placeholder="Type to search notes, commands, or ask AI..."]', timeout=5000)
    page.locator('input[placeholder="Type to search notes, commands, or ask AI..."]').fill("Library")

    page.wait_for_timeout(1500)
    page.keyboard.press('Enter')

    print("Waiting for library panel...")
    page.wait_for_selector('[data-testid="library-browser"]', timeout=10000)
    expect(page.get_by_role("heading", name=re.compile(r"Cloud Library Browser", re.IGNORECASE))).to_be_visible(timeout=10000)
    page.wait_for_timeout(1000)

    print("Switching to Samples tab...")
    # More resilient locator as suggested by user
    page.get_by_role("tab", name=re.compile(r"samples?", re.IGNORECASE)).click()
    page.wait_for_timeout(2000)

    print("Capturing screenshot...")
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    page.screenshot(path="/home/jules/verification/screenshots/library_browser.png")

    print("Switching back to rich editor mode...")
    page.get_by_role("button", name="Close").click()
    page.wait_for_timeout(1000)

    print("Creating a new note to test embed command...")
    page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
    page.wait_for_selector('input[placeholder="Type to search notes, commands, or ask AI..."]', timeout=5000)
    page.fill('input[placeholder="Type to search notes, commands, or ask AI..."]', "Library Test Note")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)

    print("Executing /embed sample...")
    page.click('.tiptap', force=True)
    page.keyboard.type("/embed sample")
    page.wait_for_timeout(1000)
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)

    print("Entering fake sample ID...")
    page.keyboard.type("test-sample-id-1234")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)

    print("Capturing editor screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/embed_sample.png")

    # Wait for video final state
    page.wait_for_timeout(1500)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    # clear old videos
    shutil.rmtree("/home/jules/verification/videos")
    os.makedirs("/home/jules/verification/videos", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
            print("Success!")
        finally:
            context.close()
            browser.close()
