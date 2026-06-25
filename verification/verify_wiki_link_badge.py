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
        # MUST use context for video recording
        context = await browser.new_context(record_video_dir=record_video_dir)
        page = await context.new_page()
        try:
            yield page, context
        finally:
            await context.close()
            await browser.close()

async def verify_wiki_link_badge():
    video_dir = "/home/jules/verification/videos"
    screenshot_dir = "/home/jules/verification/screenshots"
    os.makedirs(video_dir, exist_ok=True)
    os.makedirs(screenshot_dir, exist_ok=True)

    # Clear existing videos
    for f in glob.glob(f"{video_dir}/*.webm"):
        os.remove(f)

    async with browser_context(record_video_dir=video_dir) as (page, context):
        print("1. Loading app...")
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(1000)

        await page.evaluate(f"localStorage.setItem('api_url', '{MOCK_API_URL}');")
        await page.evaluate("localStorage.setItem('author_name', 'Tester');")
        await page.reload()
        await page.wait_for_selector("#root > div", timeout=10000)
        await page.wait_for_timeout(500)

        print("2. Creating a test note with a wiki link...")
        await page.keyboard.press("Meta+k")
        await page.wait_for_selector("input[placeholder*='Search']", timeout=5000)
        await page.keyboard.type("Create New Note")
        await page.keyboard.press("Enter")

        # Wait for editor to be ready
        await page.wait_for_selector(".ProseMirror")
        await page.locator(".ProseMirror").click()
        await page.wait_for_timeout(500)

        # Type the text to create a link
        await page.locator(".ProseMirror").type("Here is a link to ")
        await page.wait_for_timeout(500)
        await page.locator(".ProseMirror").type("[[")
        await page.wait_for_timeout(500)
        await page.keyboard.type("Another Note")
        await page.wait_for_timeout(1000)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1000)

        # Let's hover over the link to show hover styles
        link = page.locator(".internal-wiki-link")
        await link.hover()
        await page.wait_for_timeout(1000)

        print("3. Taking screenshot...")
        screenshot_path = os.path.join(screenshot_dir, "wiki_link_badge.png")
        await page.screenshot(path=screenshot_path)

        print("Done capturing verification media.")

if __name__ == "__main__":
    asyncio.run(verify_wiki_link_badge())
