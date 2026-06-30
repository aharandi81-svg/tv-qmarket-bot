from playwright.sync_api import sync_playwright

URL = "https://www.tradingview.com/markets/cryptocurrencies/prices-all/"


with sync_playwright() as p:

    browser = p.chromium.launch(headless=True)

    page = browser.new_page()

    page.goto(URL, wait_until="networkidle")

    print(page.title())

    page.screenshot(path="page.png", full_page=True)

    browser.close()
