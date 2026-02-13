
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")

            # Wait for editor
            page.wait_for_selector(".ProseMirror")
            page.locator(".ProseMirror").click()
            page.locator(".ProseMirror").fill("This is a test block")
            time.sleep(1)

            # Move mouse over the text
            p_locator = page.locator(".ProseMirror p")
            box = p_locator.bounding_box()

            if box:
                print(f"Hovering at {box['x'] + 20}, {box['y'] + 10}")
                page.mouse.move(box["x"] + 20, box["y"] + 10)
                time.sleep(1)

                # Check handle visibility
                handle = page.locator('[data-testid="block-handle"]')

                # Take debug screenshot
                page.screenshot(path="verification/debug_hover.png")

                if handle.is_visible():
                    print("Handle visible!")

                    # Click handle
                    handle_box = handle.bounding_box()
                    page.mouse.click(handle_box["x"] + handle_box["width"]/2, handle_box["y"] + handle_box["height"]/2)
                    time.sleep(0.5)

                    page.screenshot(path="verification/block_menu_open.png")

                    # Click "Heading 1"
                    menu_item = page.get_by_text("Heading 1")
                    if menu_item.is_visible():
                        menu_item.click()
                        time.sleep(0.5)

                        # Verify H1
                        if page.locator("h1").count() > 0:
                            print("Success: Block turned into H1")
                        else:
                            print("Failure: H1 not found")
                    else:
                        print("Menu item 'Heading 1' not found")
                else:
                    print("Handle not visible")

            else:
                print("Paragraph not found")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
