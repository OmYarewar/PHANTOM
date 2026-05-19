import re
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5173")

    # Wait for the DOM to be ready, state='attached' means it's in the DOM, even if hidden
    page.wait_for_selector("#preview-popout-btn", state="attached")

    print("Page loaded and UI elements exist.")
    browser.close()

with sync_playwright() as p:
    run(p)
