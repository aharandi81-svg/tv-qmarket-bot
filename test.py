from playwright.sync_api import sync_playwright

URL = "https://www.tradingview.com/markets/cryptocurrencies/prices-all/"

with sync_playwright() as p:

    browser = p.chromium.launch(headless=True)

    page = browser.new_page(
        viewport={"width": 1920, "height": 1080}
    )

    page.goto(URL, wait_until="networkidle")

    page.wait_for_timeout(5000)

    html = page.content()

    with open("page.html", "w", encoding="utf-8") as f:
        f.write(html)

    print("HTML Saved")

    browser.close()
