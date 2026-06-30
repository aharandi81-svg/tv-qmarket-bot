from tv_socket import get_quotes

quotes = get_quotes()

for k, v in quotes.items():

    print("=" * 40)
    print(k)
    print(v)
