import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to dev server...")
        await page.goto("http://localhost:5173")

        await page.wait_for_selector(".lucide-loader", state="hidden")
        await page.wait_for_selector(".animate-spin", state="hidden")

        print("Setting webhook secret in settings...")
        await page.click("button[title='Settings']")
        await page.click("text=Integrations")
        await page.fill("input[placeholder='Paste your webhook secret here']", "test-secret")

        # Click the SVG close button instead of relying on a title
        await page.locator(".fixed.inset-0.z-50 button").nth(0).click()

        print("Checking if webhook_secret is saved in localStorage...")
        secret = await page.evaluate("localStorage.getItem('webhook_secret')")
        assert secret == "test-secret", f"Secret not saved, got {secret}"

        print("Success!")
        await browser.close()

asyncio.run(run())
