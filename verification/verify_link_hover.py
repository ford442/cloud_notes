import asyncio
from playwright.async_api import async_playwright
import sys
import os
from contextlib import asynccontextmanager
import glob

MOCK_API_URL = "http://localhost:5173/mock-api"

@asynccontextmanager
async def browser_context(record_video_dir=None):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(record_video_dir=record_video_dir)
        page = await context.new_page()
        try:
            yield page, context
        finally:
            await context.close()
            await browser.close()

async def verify_link_hover():
    video_dir = "/home/jules/verification/videos"
    screenshot_dir = "/home/jules/verification/screenshots"
    os.makedirs(video_dir, exist_ok=True)
    os.makedirs(screenshot_dir, exist_ok=True)

    for f in glob.glob(f"{video_dir}/*.webm"):
        os.remove(f)

    async with browser_context(record_video_dir=video_dir) as (page, context):
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)

        await page.evaluate(f"localStorage.setItem('api_url', '{MOCK_API_URL}');")
        await page.evaluate("localStorage.setItem('author_name', 'Tester');")
        await page.reload()
        await page.wait_for_selector("#root > div", timeout=10000)
        await page.wait_for_timeout(500)

        # Let's create a new note with a link
        await page.keyboard.press("Meta+k")
        await page.wait_for_selector("input[placeholder*='Search']", timeout=5000)
        await page.keyboard.type("Create New Note")
        await page.keyboard.press("Enter")

        await page.wait_for_selector(".ProseMirror")
        await page.locator(".ProseMirror").click()
        await page.wait_for_timeout(500)

        # Link to ourself
        await page.locator(".ProseMirror").type("Hovering over ")
        await page.wait_for_timeout(500)
        await page.locator(".ProseMirror").type("[[")
        await page.wait_for_timeout(500)
        await page.keyboard.type("Untit")
        await page.wait_for_timeout(1000)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        # Hover
        link = page.locator(".internal-wiki-link").first
        await link.hover()
        await page.wait_for_timeout(2000) # wait for timeout and load

        # Verify popup is there
        await page.wait_for_selector("#link-preview-popup", timeout=2000)

        screenshot_path = os.path.join(screenshot_dir, "link_hover.png")
        await page.screenshot(path=screenshot_path)

if __name__ == "__main__":
    asyncio.run(verify_link_hover())
