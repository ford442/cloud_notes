from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(err))

        page.goto('http://localhost:5173')

        page.wait_for_selector('.lucide-loader', state='hidden', timeout=10000)
        page.wait_for_timeout(1000)

        page.click('body')

        # trigger createNote
        page.evaluate("""
          window.PluginRegistry.actions.find(a => a.id === 'create-daily-note').perform()
        """)

        page.wait_for_timeout(2000)

        for err in errors:
            print(f"Browser error: {err}")

        browser.close()

run()
