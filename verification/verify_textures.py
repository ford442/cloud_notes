from playwright.sync_api import sync_playwright
import glob

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(5000)

    # Click the Textures button - it is rendered directly but might be hidden by scroll in the mode toggle bar
    # Find the toggle container and scroll the button into view before clicking
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const texturesBtn = buttons.find(b => b.textContent.includes('Textures'));
        if (texturesBtn) {
           texturesBtn.scrollIntoView();
           texturesBtn.click();
        }
    }''')
    page.wait_for_timeout(2000)

    # Click the textures directory
    page.evaluate('''() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dirBtn = buttons.find(b => b.textContent.includes('weeks_textures') && !b.textContent.includes('Textures'));
        if (dirBtn) dirBtn.click();
    }''')
    page.wait_for_timeout(2000)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

            # Use glob to find the recorded webm file
            video_files = glob.glob("/home/jules/verification/videos/*.webm")
            if video_files:
                # get the most recently created file
                latest_video = max(video_files, key=os.path.getctime)
                print(f"LATEST_VIDEO={latest_video}")
