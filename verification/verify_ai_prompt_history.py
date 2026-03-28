import time
import os
import shutil
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    # Wait for app to be ready
    page.wait_for_selector(".ProseMirror", state="visible")
    page.wait_for_timeout(1000)

    # Type / in the editor
    page.locator(".ProseMirror").click()
    page.wait_for_timeout(500)
    page.keyboard.type("/")
    page.wait_for_timeout(500)

    # Type "draft" to filter command menu
    page.keyboard.type("draft")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)

    # In the prompt dialog, enter a prompt
    page.keyboard.type("Write a haiku about coding.")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")

    # Wait for AI to finish (it inserts text)
    page.wait_for_timeout(3000)

    # Trigger slash command again
    page.locator(".ProseMirror").click()
    page.keyboard.press("End")
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    page.keyboard.type("/")
    page.wait_for_timeout(500)
    page.keyboard.type("draft")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)

    # Take a screenshot showing the history
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

    # Choose option 1
    page.keyboard.type("1")
    page.keyboard.press("Enter")
    page.wait_for_timeout(3000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    for f in os.listdir("/home/jules/verification/videos"):
        os.remove(os.path.join("/home/jules/verification/videos", f))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/screenshots/error.png")
            raise e
        finally:
            context.close()
            browser.close()
