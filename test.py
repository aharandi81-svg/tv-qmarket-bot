from scraper import get_quotes

quotes = get_quotes()

print()

for k, v in quotes.items():

    print(k)

    print("Price :", v["price"])

    print("Change:", v["change"])

    print("%     :", v["percent"])

    print("-" * 30)
