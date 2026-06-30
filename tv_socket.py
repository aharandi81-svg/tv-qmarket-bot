import json
import random
import string
import websocket


def _rand(prefix):
    return prefix + ''.join(random.choice(string.ascii_lowercase) for _ in range(12))


def _msg(func, args):
    return f'~m~{len(json.dumps({"m": func, "p": args}))}~m~{json.dumps({"m": func, "p": args})}'


def get_quotes():

    ws = websocket.create_connection(
        "wss://data.tradingview.com/socket.io/websocket",
        header=[
            "Origin: https://www.tradingview.com"
        ]
    )

    session = _rand("qs_")

    ws.send(_msg("quote_create_session", [session]))

    ws.send(_msg("quote_set_fields", [
        session,
        "lp",
        "ch",
        "chp",
        "short_name",
        "description"
    ]))

    symbols = [
        "OANDA:XAUUSD",
        "BINANCE:BTCUSDT",
        "BINANCE:BNBUSDT"
    ]

    for s in symbols:
        ws.send(_msg("quote_add_symbols", [session, s]))

    result = {}

    while len(result) < 3:

        data = ws.recv()

        if "quote_completed" in data:
            continue

        if '"lp"' not in data:
            continue

        try:

            start = data.find("{")
            payload = json.loads(data[start:])

            symbol = payload["p"][1]

            values = payload["p"][2]["v"]

            result[symbol] = {
                "price": values.get("lp"),
                "change": values.get("ch"),
                "percent": values.get("chp"),
                "description": values.get("description")
            }

        except:
            pass

    ws.close()

    return result
