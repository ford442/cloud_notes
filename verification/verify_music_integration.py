import asyncio
import os
import json
from playwright.async_api import async_playwright, expect

async def verify_music_integration():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        captured_patch_data = None

        async def handle_route(route):
            nonlocal captured_patch_data

            if route.request.method == "GET" and "/api/songs" in route.request.url:
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='[{"id":"1","title":"Test Song A","author":"Test Artist","rating":8,"tags":["chill","ambient"],"play_count":10}]'
                )
            elif route.request.method == "PATCH" and "/api/songs/1" in route.request.url:
                try:
                    data_str = route.request.post_data
                    print(f"DEBUG: raw post data: {data_str}")
                    captured_patch_data = json.loads(data_str)
                except Exception as e:
                    print(f"Failed to parse PATCH data: {e}")

                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"success": true}'
                )
            else:
                await route.continue_()

        page.on("request", lambda r: print(f">> {r.method} {r.url}"))
        await page.route("**/api/songs*", handle_route)

        try:
            print("Navigating to dev server...")
            await page.goto("http://localhost:5173")

            await page.wait_for_selector(".lucide-loader", state="hidden")
            await page.wait_for_selector(".animate-spin", state="hidden")

            await page.evaluate("""() => {
                localStorage.setItem('flac_api_url', 'http://localhost:8000');
            }""")

            print("Switching to music mode...")
            await page.click("body") # Ensure focus
            await page.evaluate("() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); }")
            await page.wait_for_selector('input[placeholder="Type a command or search..."]', timeout=5000)
            await page.get_by_placeholder("Type a command or search...").fill("Music Library")
            await page.wait_for_timeout(1000)
            await page.get_by_text("Music Library", exact=True).first.click()

            print("Waiting for library view...")
            await expect(page.get_by_text("Music Library Manager")).to_be_visible()

            print("Opening edit mode...")
            await page.get_by_text("Edit").nth(0).click()
            await page.wait_for_timeout(500)

            await page.get_by_placeholder("Add tag...").fill("new_test_tag")
            await page.get_by_text("Add").click()
            await page.wait_for_timeout(500)

            print("Saving edits to trigger PATCH request...")
            async with page.expect_request(lambda request: "api/songs/1" in request.url and request.method == "PATCH") as request_info:
                row = page.locator("tbody tr").first
                await row.get_by_text("Save").click()

            request = await request_info.value

            # captured_patch_data is already populated by handle_route
            if captured_patch_data is None:
                # Fallback to the captured request directly if handle_route missed it
                print("Fallback: extracting JSON from captured request object")
                captured_patch_data = json.loads(request.post_data)

            print(f"Captured payload: {captured_patch_data}")

            assert "new_test_tag" in captured_patch_data.get("tags", []), "New tag was not in payload!"
            assert captured_patch_data.get("title") == "Test Song A", "Title was modified incorrectly!"

            print("Integration test passed! The frontend correctly formats and sends the PATCH payload.")

        except Exception as e:
            print(f"Error: {e}")
            raise
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_music_integration())
