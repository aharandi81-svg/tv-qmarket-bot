import requests
from config import URL, HEADERS


SYMBOLS = [
    "OANDA:XAUUSD",
    "BINANCE:BTCUSDT",
    "BINANCE:BNBUSDT"
]


def get_quotes():

    payload = {
        "symbols": {
            "tickers": SYMBOLS,
            "query": {"types": []}
        },
        "columns": [
            "name",
            "close",
            "change",
            "change_abs",
            "description"
        ]
    }

    r = requests.post(
        URL,
        headers=HEADERS,
        json=payload,
        timeout=20
    )

    r.raise_for_status()

    data = r.json()["data"]

    result = {}

    for row in data:

        result[row["s"]] = {
            "symbol": row["d"][0],
            "price": row["d"][1],
            "percent": row["d"][2],
            "change": row["d"][3],
            "description": row["d"][4]
        }

    return result
