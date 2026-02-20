import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173") # Default Vite port

    # Create a new note to start fresh
    page.get_by_role("button", name="+ New").click()

    # Wait for loading overlay to disappear if present
    try:
        page.locator(".animate-spin").first.wait_for(state="hidden", timeout=10000)
    except:
        print("Loading overlay did not disappear")

    page.get_by_placeholder("Note Title...").fill("Test Image Paste")

    # Focus the editor
    editor = page.locator(".ProseMirror")
    editor.click()

    # Simulate Paste Event
    base64_image = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

    # Use an arrow function to avoid "Illegal return statement" and handle f-string braces
    js_code = f"""() => {{
        return fetch("data:image/gif;base64,{base64_image}")
        .then(r => r.blob())
        .then(blob => {{
            const file = new File([blob], "test-image.webp", {{ type: "image/gif" }});
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const event = new ClipboardEvent("paste", {{
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            }});

            document.querySelector(".ProseMirror").dispatchEvent(event);
        }});
    }}"""

    page.evaluate(js_code)

    # Wait for either placeholder OR image (if upload is instant)
    try:
        # Check for placeholder text appearing in the editor content
        # Use regex to match the pattern
        placeholder = page.get_by_text("[Uploading Image")
        placeholder.wait_for(timeout=5000)
        print("Placeholder appeared!")
    except Exception as e:
        print(f"Placeholder not found within 5s: {e}")

    # Take screenshot
    page.screenshot(path="verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
