import requests

URL = "https://scanner.tradingview.com/global/scan"


def get_quotes():

    body = {
        "symbols": {
            "tickers": [
                "OANDA:XAUUSD",
                "BINANCE:BTCUSDT",
                "BINANCE:BNBUSDT"
            ]
        },
        "columns": [
            "close",
            "change",
            "change_abs"
        ]
    }

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Content-Type": "application/json"
    }

    r = requests.post(
        URL,
        json=body,
        headers=headers,
        timeout=20
    )

    r.raise_for_status()

    data = r.json()["data"]

    result = {}

    for row in data:

        ticker = row["s"]

        close, percent, change = row["d"]

        result[ticker] = {
            "price": close,
            "percent": percent,
            "change": change
        }

    return result
