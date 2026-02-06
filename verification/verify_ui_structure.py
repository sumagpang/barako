from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    file_path = os.path.abspath("wifi-sa-bukid/src/hotspot/login.html")
    page.goto(f"file://{file_path}")

    # Check for Tailwind body class presence (partial match)
    # The actual class string is long, so we check if body exists and has classes
    expect(page.locator("body")).to_have_attribute("class", "font-sans antialiased text-gray-900 min-h-screen flex flex-col")

    # Check for Marquee
    expect(page.locator("#announcement-text")).to_be_visible()

    # Check for Payment Button
    expect(page.locator("#pay-btn")).to_be_visible()

    print("UI Structure Verified")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
