#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract the buffet dish database from the catering company's Excel workbook.

Reads the ~20 "event" sheets (real corporate events the caterer priced/served),
resolves each dish's per-serving cost (already computed by the workbook into the
"مبلغ نهایی" column), pulls each dish's ingredient list from its linked recipe-card
sheet (found via the cross-sheet formula, not by guessing sheet names), computes a
first-pass macro composition from those ingredients, and then applies an explicit,
documented set of category-level and dish-level sanity-check corrections before
writing data/dishes.json and data/EXTRACTION_NOTES.md.

This script does NOT modify the source .xlsx. It is deterministic given the source
file, so re-running it reproduces the same output (aside from anything in this file
being edited).
"""

import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

SOURCE_XLSX = "/root/.claude/uploads/5bf65294-f8e5-55f5-8b81-819ae50c8486/09bd73f1-14050528.xlsx"
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DISHES = REPO_ROOT / "data" / "dishes.json"
OUT_NOTES = REPO_ROOT / "data" / "EXTRACTION_NOTES.md"


def norm(s):
    """Trim + collapse internal whitespace. Keeps Farsi text untouched otherwise."""
    if s is None:
        return None
    return re.sub(r"\s+", " ", str(s)).strip()


# ---------------------------------------------------------------------------
# 1. Sheet inventory (hand-verified against the workbook structure described
#    in the task + confirmed by inspection: 365 sheets total).
# ---------------------------------------------------------------------------

EVENT_SHEETS = [
    "ایونت11 تیر ",
    "ایونت 19 تیر",
    "ایونت 22 تیر ",
    "ایونت 23تیر ",
    "ایونت پاد ",
    "ایونت فوتبال ",
    "ایونت 31 تیر و 2 مرداد  ",
    "ایونت 1 مرداد ",
    "ایونت 5 مرداد ",
    "ایونت 9 مرداد ",
    "ایونت15 , 17 مرداد ",
    "ایونت 18 مرداد ",
    "اوا تجارت -524",
    "نوونوردیسک 524",
    "ایونت ترنج 525",
    "نوونوردیسک 526",
    "ایونت اکتوورکو  630",
]

# 'لیست کالای غذای n' looks superficially like an 18th event sheet (same 4-column
# layout, same section headers) but every single row's cost column is blank -
# it is a draft/candidate menu list with zero pricing data, sitting apart from the
# named event sheets. We deliberately exclude it: including it would add ~12 more
# "dishes" with no cost signal at all and it was never an actual priced event.
EXCLUDED_NON_EVENT_SHEET = "لیست کالای غذای n"

# Rows in column A that are structural noise, not dishes: aggregate/footnote rows
# that leaked into the dish column, and one raw numeric value from a data-entry slip.
JUNK_DISH_NAMES = {
    "1050000",
    "سرشکن 20 نفر برای 18 نفر",
    "کل منو برای یک نفر",
    "کل منو برای 20 نفر",
    "موارد نارنجی قیمت با احتساب مقدار مورد استفاده می باشد و قیمت نهایی است",
}

# ---------------------------------------------------------------------------
# 2. Section-header vocabulary.
#    Every event sheet is organised as a flat list under section-header rows
#    (column A = header text, column B = blank). The task's brief named the
#    "obvious" headers (غذای اصلی / پیش غذا / ناهار / بریک 1&2 / نوشیدنی / بسته بندی).
#    Inspecting every one of the 17 sheets in full (not just the first) turned up
#    several more header words the brief didn't mention, each verified by checking
#    that it (a) always has a blank cost cell and (b) is always immediately followed
#    by rows that are clearly specific dishes, in every one of its occurrences:
#    WELCOME, میان وعده, فینگر فود / finger food, تنقلات, نوشیدنی سرد, نوشیدنی گرم,
#    نوشیدنی ها, صبحانه, and دسر (دسر is *always* a header in this workbook - it is
#    never itself a priced line - it precedes concrete dessert items every time).
#    سوپ / سالاد / پنیر و میوه appear as *sub*-headers nested one level inside
#    "پیش غذا" purely for readability in the sheet; they don't change the dish's
#    effective category (a soup or salad found there is still a پیش‌غذا), so they
#    are treated as transparent (skip the row, keep the current category).
# ---------------------------------------------------------------------------

# category value here is one of:
#   a literal target category ('غذای اصلی'/'پیش‌غذا'/'دسر'/'نوشیدنی')
#   'INSPECT'  -> mixed section (coffee break / welcome table / finger food table);
#                 classify each child item individually by keyword, see below
#   'SKIP'     -> not a dish section at all (بسته بندی = packaging)
#   None       -> transparent sub-header: skip this row, keep current category
HEADER_TO_CATEGORY = {
    "غذای اصلی": "غذای اصلی",
    "ناهار": "غذای اصلی",
    "صبحانه": "INSPECT",  # breakfast spread: mostly mains, but also drinks/pastry
    "پیش غذا": "پیش‌غذا",
    "نوشیدنی": "نوشیدنی",
    "نوشیدنی ها": "نوشیدنی",
    "نوشیدنی سرد": "نوشیدنی",
    "نوشیدنی گرم": "نوشیدنی",
    "نوشیدنی  گرم": "نوشیدنی",
    "دسر": "دسر",
    "بسته بندی": "SKIP",
    "بریک 1": "INSPECT",
    "بریک 2": "INSPECT",
    "میان وعده": "INSPECT",
    "فینگر فود": "INSPECT",
    "finger food": "INSPECT",
    "تنقلات": "INSPECT",
    "سالاد و میوه": "INSPECT",
    "WELCOME": "INSPECT",
    "سوپ": None,
    "سالاد": None,
    "پنیر و میوه": None,
}

INSPECT_DEFAULT = {
    "WELCOME": "غذای اصلی",       # dominated by egg/toast items in this workbook
    "صبحانه": "غذای اصلی",
    "بریک 1": "پیش‌غذا",
    "بریک 2": "پیش‌غذا",
    "میان وعده": "پیش‌غذا",
    "فینگر فود": "پیش‌غذا",
    "finger food": "پیش‌غذا",
    "تنقلات": "پیش‌غذا",
    "سالاد و میوه": "پیش‌غذا",
}

# Keyword classification used only inside 'INSPECT' sections (mixed coffee-break /
# welcome-table / finger-food-table sections whose child items span categories).
# 'شیر' (milk) is matched as a whole token only, to avoid matching inside 'شیرینی'.
DRINK_PHRASES = [
    "آب پرتقال", "آبمیوه", "آب میوه", "دیتاکس", "واتر", "قهوه", "چای", "دمنوش",
    "نوشابه", "آبجو", "اسموتی", "ماکتل", "الشعیر", "نوشیدنی",
]
DESSERT_PHRASES = [
    "کیک", "تارت", "شیرینی", "کوکی", "بستنی", "ژله", "موس", "تیرامیسو", "پتی فور",
    "فریز", "دسر", "آنترومه", "کروسان", "شکلات", "هندوانه", "آناناس", "توت فرنگی",
    "انگور", "آلبالو", "گیلاس", "انبه", "شلیل", "زردآلو", "بلوبری", "میوه",
]
# checked as a whole word only (substring matching would misfire: "موز" (banana)
# is a substring of "موزارلا" (mozzarella), which wrongly filed the savory
# "مافین بیکن و موزارلا" (bacon+mozzarella muffin) as a dessert).
DESSERT_EXACT_TOKENS = {"موز"}
DRINK_EXACT_TOKENS = {"شیر"}


def classify_inspect_item(name, section_key):
    toks = name.split()
    if DRINK_EXACT_TOKENS & set(toks):
        return "نوشیدنی"
    if DESSERT_EXACT_TOKENS & set(toks):
        return "دسر"
    for kw in DESSERT_PHRASES:
        if kw in name:
            return "دسر"
    for kw in DRINK_PHRASES:
        if kw in name:
            return "نوشیدنی"
    return INSPECT_DEFAULT.get(section_key, "پیش‌غذا")


# ---------------------------------------------------------------------------
# 3. Dish-name alias merging.
#    Same dish, different spelling/spacing/pluralisation across event sheets.
#    Found by eyeballing the sorted unique dish-name list for near-duplicates.
#    Left-hand side (as it appears verbatim, trimmed) -> canonical name kept in
#    the output. Picking the more complete / more common spelling as canonical.
# ---------------------------------------------------------------------------

ALIASES = {
    "بابا غنوش": "باباغنوش",
    "دیپ آووکادوو": "دیپ آووکادو",
    "دیپ اووکادو": "دیپ آووکادو",
    "سبزیجات بخار پز": "سبزیجات بخارپز",
    "ساالاد سبزیجات تابستانه": "سالاد سبزیجات تابستانه",
    "میگوی سوخاری": "میگو سوخاری",
    "تست(تخم مرغ و بیکن )": "تست تخم مرغ و بیکن",
    "کوکتل میوه های تابستانی": "کوکتل میوه",
    "قهوه ": "قهوه",  # normalised anyway, kept for clarity
    "چیکن  استراگانف": "چیکن استراگانف",
    "راویولی قارچ و پنیر": "راویولی قارچ",
    "سالاد سبزیجات با هالومی مدیترانه ای": "سالاد سبزیجات مدیترانه ای",
    "شات سالاد سبزیجات مدیترانه ای با پنیر هالومی": "سالاد سبزیجات مدیترانه ای",
}

# ---------------------------------------------------------------------------
# 4. Formula-reference parsing (to find each dish's recipe-card sheet).
#    Column B on an event sheet is a formula like ='<recipe sheet>'!E21 (quotes
#    only appear when the sheet name has spaces). We must read the *formula*
#    (data_only=False) to recover the sheet name, then read the *value*
#    (data_only=True) for the already-computed cost - the two workbooks are
#    loaded in parallel and walked row-for-row.
# ---------------------------------------------------------------------------

REF_RE = re.compile(r"^=\s*'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)\s*$")


def main():
    wb_v = openpyxl.load_workbook(SOURCE_XLSX, data_only=True, read_only=True)
    wb_f = openpyxl.load_workbook(SOURCE_XLSX, data_only=False, read_only=True)

    # ---- Pass 1: walk every event sheet, emit one record per dish row -----
    rows = []
    for ename in EVENT_SHEETS:
        ws_v = wb_v[ename]
        ws_f = wb_f[ename]
        rows_v = list(ws_v.iter_rows(min_row=1, max_row=ws_v.max_row, max_col=4))
        rows_f = list(ws_f.iter_rows(min_row=1, max_row=ws_f.max_row, max_col=4))
        current_section_key = None   # the literal header text last seen
        current_category = None      # resolved target category for that section
        for rv, rf in zip(rows_v, rows_f):
            a = norm(rv[0].value)
            if a is None:
                continue
            if a == norm("نام محصول"):
                continue

            if a in HEADER_TO_CATEGORY:
                cat = HEADER_TO_CATEGORY[a]
                if cat is None:
                    pass  # transparent sub-header: keep current_category as-is
                else:
                    current_section_key = a
                    current_category = cat
                continue
            if a in JUNK_DISH_NAMES:
                continue
            if current_category == "SKIP":
                continue

            dish = ALIASES.get(a, a)

            if current_category == "INSPECT":
                resolved_category = classify_inspect_item(dish, current_section_key)
            else:
                resolved_category = current_category

            b_val = rv[1].value
            b_formula = rf[1].value

            ref_sheet = None
            if isinstance(b_formula, str) and b_formula.startswith("="):
                m = REF_RE.match(b_formula.strip())
                if m:
                    ref_sheet = norm(m.group(1))

            cost_numeric = None
            cost_outsourced = False
            if isinstance(b_val, (int, float)):
                cost_numeric = float(b_val)
            elif isinstance(b_val, str):
                bn = norm(b_val)
                if bn in ("خرید از بیرون", "خرید"):
                    cost_outsourced = True

            rows.append({
                "event": ename,
                "dish": dish,
                "category": resolved_category,
                "cost_numeric": cost_numeric,
                "cost_outsourced": cost_outsourced,
                "ref_sheet": ref_sheet,
            })

    # ---- Pass 2: aggregate per unique dish name -----------------------------
    by_dish = defaultdict(lambda: {
        "categories": Counter(),
        "costs": [],
        "outsourced": False,
        "events": [],
        "ref_sheets": Counter(),
    })
    for r in rows:
        d = by_dish[r["dish"]]
        if r["category"]:
            d["categories"][r["category"]] += 1
        if r["cost_numeric"] is not None:
            d["costs"].append(r["cost_numeric"])
        if r["cost_outsourced"]:
            d["outsourced"] = True
        if r["event"] not in d["events"]:
            d["events"].append(r["event"])
        if r["ref_sheet"]:
            d["ref_sheets"][r["ref_sheet"]] += 1

    category_conflicts = {}
    for name, d in by_dish.items():
        if len(d["categories"]) > 1:
            category_conflicts[name] = dict(d["categories"])

    # ---- Pass 3: recipe-card lookup -----------------------------------------
    all_sheet_names = set(wb_v.sheetnames)
    norm_sheet_lookup = {norm(n): n for n in all_sheet_names}

    def find_recipe_sheet(name, ref_sheets_counter):
        if ref_sheets_counter:
            best, _ = ref_sheets_counter.most_common(1)[0]
            if best in all_sheet_names:
                return best
            if norm(best) in norm_sheet_lookup:
                return norm_sheet_lookup[norm(best)]
        # fallback: direct name match against sheet list (handles outsourced /
        # no-formula dishes that still happen to have a same-named recipe sheet)
        if norm(name) in norm_sheet_lookup:
            return norm_sheet_lookup[norm(name)]
        return None

    UNIT_GRAM_EQUIV = {"گرم": 1.0, "سی سی": 1.0, "سی‌سی": 1.0}
    # Rough per-piece weights (grams) for ingredients counted by عدد (count) inside
    # a recipe card, used only to bring them into the same gram-ish scale as the
    # rest of the ingredient list for the macro-share calculation below.
    PIECE_WEIGHTS = [
        ("تخم مرغ", 50), ("لیمو", 50), ("لیموترش", 15), ("نان", 30),
        ("پیاز", 100), ("سیر", 5), ("گوجه", 100),
    ]

    def piece_weight(name):
        for kw, w in PIECE_WEIGHTS:
            if kw in name:
                return w
        return 50.0  # generic fallback for an unlisted countable ingredient

    def read_recipe_ingredients(sheet_name):
        if sheet_name is None or sheet_name not in all_sheet_names:
            return None
        ws = wb_v[sheet_name]
        ingredients = []
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=5):
            name_c, unit_c, qty_c, price_c, total_c = [c.value for c in row]
            name_n = norm(name_c)
            if name_n is None:
                continue
            if name_n in ("جمع کل", "بسته بندی", "نام کالا"):
                # reached the ingredients-block summary/packaging-block boundary
                if name_n == "جمع کل":
                    break
                continue
            if not isinstance(qty_c, (int, float)):
                continue
            ingredients.append({
                "name": name_n,
                "quantity": qty_c,
                "unit": norm(unit_c) or "",
            })
        return ingredients if ingredients else None

    # ---- 4. Ingredient-group master list (for naive macro classification) --
    ws_master = wb_v["مواد اولیه "]
    ingredient_group = {}
    for row in ws_master.iter_rows(min_row=2, max_row=ws_master.max_row, max_col=2):
        title, group = [c.value for c in row]
        title_n = norm(title)
        group_n = norm(group)
        if title_n and group_n:
            ingredient_group[title_n] = group_n

    # group -> macro bucket weights (carb, protein, veg, fat); weights need not
    # sum to 1, they are relative shares of that ingredient's gram-weight.
    GROUP_MACRO_WEIGHTS = {
        "مواد اولیه_مواد پروتیینی": {"protein": 1.0},
        "مواد اولیه_مواد نشاسته ای": {"carb": 1.0},
        "مواد اولیه_سبزیجات و میوه": {"veg": 1.0},
        "مواد اولیه_روغن ها": {"fat": 1.0},
        "مواد اولیه_محصولات لبنی": {"fat": 0.5, "protein": 0.3, "carb": 0.2},
        "مواد اولیه_شیرینی، کیک و دسر": {"carb": 0.7, "fat": 0.3},
        "مواد اولیه_حبوبات و خشکبار": {"carb": 0.4, "protein": 0.4, "fat": 0.2},
        "مواد اولیه_چاشنی، سس و ادویه جات": {"carb": 0.3, "fat": 0.3, "veg": 0.2, "protein": 0.2},
        "مواد اولیه_نوشیدنی ها": {"carb": 1.0},
        "مواد اولیه_سایر مواد": {"carb": 0.25, "protein": 0.25, "veg": 0.25, "fat": 0.25},
        "نیمه ساخته ها_مرینت ها": {"protein": 0.4, "fat": 0.3, "carb": 0.2, "veg": 0.1},
        "مواد اولیه_مواد شوینده": {},  # cleaning supplies - contributes nothing
    }

    # Fallback keyword buckets when an ingredient isn't in the master list at all.
    # Order matters (first match wins): fat/dairy/legume checks run before the
    # generic meat check so e.g. tahini or yogurt don't get grouped as plain
    # protein, and legumes get a realistic carb+protein split rather than being
    # lumped in with meat (a raw weight-sum that treats chickpeas as 100% protein
    # is exactly the kind of naive-computation error the task warns about - it's
    # what made a first pass at "حمص" (hummus) come out protein-dominant/low-carb
    # instead of the carb+protein+fat balance a chickpea+tahini dip should have).
    KEYWORD_MACRO = [
        (["ارده", "طحینه", "کنجد", "روغن", "کره", "خامه", "مایونز"], {"fat": 1.0}),
        # tree nuts / peanuts are fat-dominant with a meaningful protein share -
        # without this, e.g. the walnuts in "مرغ شکم پر" (walnut-stuffed chicken)
        # fall through to the generic uniform fallback and understate the dish's
        # fat content.
        (["گردو", "بادام", "پسته", "فندق", "آجیل"], {"fat": 0.7, "protein": 0.2, "carb": 0.1}),
        # prepared salad dressings are oil-based, not pure vegetable - without this,
        # any dressing with a fruit/veg word in its name (e.g. "درسینگ لیمو ترش" /
        # lemon dressing) gets misread as 100% vegetable by the plain veg-keyword
        # check below, which is exactly the kind of miscount that made a first pass
        # at "سالاد قارچ" (mushroom salad) come out with 0% fat despite being dressed.
        (["درسینگ", "سس سالاد"], {"fat": 0.5, "veg": 0.3, "carb": 0.2}),
        (["عدس", "لوبیا", "نخود"], {"carb": 0.5, "protein": 0.4, "fat": 0.1}),
        (["ماست", "پنیر"], {"protein": 0.35, "fat": 0.45, "carb": 0.2}),
        (["مرغ", "گوشت", "ماهی", "میگو", "تخم مرغ", "بوقلمون", "گوساله", "بره"],
         {"protein": 1.0}),
        (["برنج", "پاستا", "ماکارونی", "سیب زمینی", "شکر", "آرد", "نشاسته",
          "خمیر", "ذرت", "نودل", "لازانیا"], {"carb": 1.0}),
        (["سبزی", "گوجه", "خیار", "پیاز", "فلفل", "اسفناج", "کاهو", "هویج", "قارچ",
          "کدو", "جعفری", "میوه", "لیمو", "کلم", "زیتون"], {"veg": 1.0}),
    ]
    # "نان" (bread) and "شیر" (milk) are checked as whole words only. As plain
    # substrings they misfire: "نان" is (surprisingly) contained inside "اناناس"
    # (pineapple), and "شیر" inside "شیرینی" (pastry). Every actual bread/milk
    # ingredient in this workbook carries the word as its own token (e.g. "نان
    # تست", "شیر مدت دار"), so whole-word matching loses no real coverage.
    EXACT_TOKEN_MACRO = {
        "نان": {"carb": 1.0},
        "شیر": {"protein": 0.35, "fat": 0.45, "carb": 0.2},
    }

    def keyword_macro(name):
        toks = name.split()
        for tok, weights in EXACT_TOKEN_MACRO.items():
            if tok in toks:
                return weights
        for keys, weights in KEYWORD_MACRO:
            if any(k in name for k in keys):
                return weights
        return {"carb": 0.25, "protein": 0.25, "veg": 0.25, "fat": 0.25}

    # Targeted corrections to the master ingredient-group list itself: spot-checking
    # ingredient groups (see EXTRACTION_NOTES) found "سبزی پلویی" (mixed herbs
    # sold specifically for rice dishes) filed under "مواد نشاسته ای" (starch) in
    # the caterer's own master sheet, which is a data-entry quirk of their
    # inventory system (probably grouped with rice for purchasing purposes), not
    # a nutritional fact - it is fresh chopped herbs and should count as veg.
    INGREDIENT_GROUP_OVERRIDE = {
        "سبزی پلویی": "veg",
    }

    def naive_macro_from_ingredients(ingredients):
        totals = {"carb": 0.0, "protein": 0.0, "veg": 0.0, "fat": 0.0}
        for ing in ingredients:
            qty = ing["quantity"]
            unit = ing["unit"]
            if unit == "عدد":
                grams = qty * piece_weight(ing["name"])
            else:
                grams = qty * UNIT_GRAM_EQUIV.get(unit, 1.0)
            if ing["name"] in INGREDIENT_GROUP_OVERRIDE:
                weights = {INGREDIENT_GROUP_OVERRIDE[ing["name"]]: 1.0}
            else:
                group = ingredient_group.get(ing["name"])
                weights = GROUP_MACRO_WEIGHTS.get(group) if group else None
                if weights is None:
                    weights = keyword_macro(ing["name"])
            for bucket, w in weights.items():
                totals[bucket] += grams * w
        s = sum(totals.values())
        if s <= 0:
            return None
        return {k: round(v / s * 100, 1) for k, v in totals.items()}

    # -------------------------------------------------------------------
    # 5. Category-level default macros (used when a dish has no recipe card,
    #    or its computed macro needs a category-consistent floor/ceiling).
    # -------------------------------------------------------------------
    CATEGORY_DEFAULT_MACRO = {
        "غذای اصلی": {"carb": 35, "protein": 35, "veg": 20, "fat": 10},
        "پیش‌غذا": {"carb": 25, "protein": 15, "veg": 45, "fat": 15},
        "دسر": {"carb": 55, "protein": 5, "veg": 5, "fat": 35},
        "نوشیدنی": {"carb": 75, "protein": 5, "veg": 5, "fat": 15},
    }

    # -------------------------------------------------------------------
    # 6. Manual, dish-level macro overrides.
    #    Applied AFTER the naive ingredient-weight computation, as the explicit
    #    "sanity check against real-world knowledge of the dish" step the task
    #    requires. Each entry documents *why* the naive number was wrong.
    #    Keyed by the exact (post-alias) dish name.
    # -------------------------------------------------------------------
    # NOTE on method: every dish below was checked by first running the naive
    # ingredient-weight computation (see naive_macro_from_ingredients) and only
    # overridden here when that computation was actually wrong - not just
    # different from a guess. Several categories were spot-checked and found
    # to already compute sensibly once the KEYWORD_MACRO fixes above were in
    # place (legumes, nuts, dairy, dressings), so they are *not* listed here on
    # purpose - see EXTRACTION_NOTES.md "spot-check log" for the full list of
    # what was checked and left alone (e.g. رice-only sides, most salads, plain
    # kabab skewers where rice is sold as a separate buffet item so 0% carb in
    # the kabab's own macro is correct, not a bug).
    MANUAL_MACRO_OVERRIDES = {
        # --- data-entry scale errors in the source recipe card: the ingredient
        #     that defines the dish's carb content was logged at an implausible
        #     fraction of a gram, so the naive computation reads it as ~0% carb.
        #     "لازانیا" (the pasta sheet itself) logged as 1 GRAM in a dish whose
        #     other ingredients (30g meat, 20g cheese, sauce) are gram-scaled
        #     normally - almost certainly a missing "0" or wrong unit upstream.
        "لازانیا رولی": {"carb": 45, "protein": 25, "veg": 10, "fat": 20},
        # "نان یوفکا" (yufka wrapper) logged as 0.15 GRAM in all 3 spring-roll
        # variants - a real wrapper is on the order of 10-15g; as entered, the
        # naive computation reads these as ~78% vegetable with almost no carb,
        # when a fried wrapped roll should show meaningful carb from the wrapper
        # and the frying oil.
        "اسپرینگ رول": {"carb": 30, "protein": 10, "veg": 50, "fat": 10},
        "اسپرینگ رول سبزیجات": {"carb": 30, "protein": 10, "veg": 50, "fat": 10},
        "اسپرینگ رول سبزیچات (وگن)": {"carb": 30, "protein": 5, "veg": 55, "fat": 10},

        # --- pizzas: recipe cards for pizza in this workbook list toppings/sauce
        #     but the dough (the majority of the carb content) is a shared
        #     sub-recipe not attached to these sheets - naive carb comes out ~0%,
        #     which is never true for an actual pizza.
        "پیتزا پپرونی": {"carb": 45, "protein": 20, "veg": 10, "fat": 25},
        "پیتزا بیکن": {"carb": 45, "protein": 20, "veg": 10, "fat": 25},
        "پیتزا مارگاریتا": {"carb": 50, "protein": 15, "veg": 15, "fat": 20},

        # --- egg+bacon breakfast item whose recipe card has no bread/bun despite
        #     the "داگ" (dog/hotdog-style) name implying one is served with it.
        "پوچداگ با سس": {"carb": 30, "protein": 35, "veg": 15, "fat": 20},
        "پوچداگ": {"carb": 30, "protein": 35, "veg": 15, "fat": 20},
        # club sandwich: recipe card logs the toast bread at 0.15 "عدد" (pieces),
        # i.e. a sliver of a slice, versus 50g bacon + veg + cheese logged
        # normally - undercounts the bread that defines a sandwich.
        "کلاب کالیفرنیا": {"carb": 35, "protein": 30, "veg": 20, "fat": 15},
    }

    def sanity_check_macro(name, category, macro):
        """Final category-consistency guardrail applied on top of the naive
        (or manually-overridden) macro. Deliberately narrow: it only catches
        combinations that are never true in the real world, and must NOT
        flatten legitimate category members. E.g. a fruit-cup dessert like
        "کوکتل میوه" is genuinely ~100% vegetable+fruit bucket with 0% fat/carb -
        that's correct, not a bug, so this only resets on the one signal that
        actually never happens for a dessert: meaningful protein content."""
        m = dict(macro)
        if category == "دسر" and m["protein"] > 15:
            m = {"carb": 55, "protein": 5, "veg": 5, "fat": 35}
        if category == "غذای اصلی" and "پیتزا" in name and m["carb"] < 30:
            m = {"carb": 45, "protein": 20, "veg": 10, "fat": 25}
        if category == "پیش‌غذا" and "سالاد" in name and m["veg"] < 25 and m["fat"] < 40:
            m = {"carb": 20, "protein": 15, "veg": 55, "fat": 10}
        s = sum(m.values())
        if s > 0 and abs(s - 100) > 0.5:
            m = {k: round(v / s * 100, 1) for k, v in m.items()}
        return m

    # -------------------------------------------------------------------
    # 7. Assemble final dish list
    # -------------------------------------------------------------------
    def slugify(name):
        # transliteration-free id: index-based suffix keeps ids short/stable
        base = re.sub(r"[^\w]+", "-", name.strip()).strip("-")
        return base or "dish"

    dishes = []
    variance_flagged = []
    needs_price = []
    manual_macro_dishes = []
    no_recipe_dishes = []

    for idx, (name, d) in enumerate(sorted(by_dish.items(), key=lambda kv: kv[0]), start=1):
        category = d["categories"].most_common(1)[0][0] if d["categories"] else "غذای اصلی"

        costs = d["costs"]
        cost_per_serving = None
        cost_source = None
        variance_flag = False
        needs_price_flag = False

        if costs:
            median_cost = statistics.median(costs)
            cost_per_serving = round(median_cost, 2)
            n = len(costs)
            cost_source = f"میانه {n} رویداد" if n > 1 else "تک رویداد"
            if len(costs) > 1 and median_cost > 0:
                spread = (max(costs) - min(costs)) / median_cost
                if spread > 0.30:
                    variance_flag = True
                    variance_flagged.append((name, min(costs), max(costs), median_cost))
        elif d["outsourced"]:
            cost_source = "خرید از بیرون"
            needs_price_flag = True
        else:
            cost_source = "بدون داده هزینه"
            needs_price_flag = True

        if needs_price_flag:
            needs_price.append(name)

        recipe_sheet = find_recipe_sheet(name, d["ref_sheets"])
        ingredients = read_recipe_ingredients(recipe_sheet)
        if ingredients is None:
            no_recipe_dishes.append(name)

        if ingredients:
            macro = naive_macro_from_ingredients(ingredients)
            if macro is None:
                macro = dict(CATEGORY_DEFAULT_MACRO[category])
        else:
            macro = dict(CATEGORY_DEFAULT_MACRO[category])

        if name in MANUAL_MACRO_OVERRIDES:
            macro = dict(MANUAL_MACRO_OVERRIDES[name])
            manual_macro_dishes.append(name)

        macro = sanity_check_macro(name, category, macro)

        dishes.append({
            "id": f"{idx:03d}-{slugify(name)}",
            "name": name,
            "category": category,
            "macro": macro,
            "costPerServing": cost_per_serving,
            "costSource": cost_source,
            "priceVarianceFlag": variance_flag,
            "needsPrice": needs_price_flag,
            "eventsUsedIn": d["events"],
            "ingredients": ingredients,
        })

    OUT_DISHES.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_DISHES, "w", encoding="utf-8") as f:
        json.dump(dishes, f, ensure_ascii=False, indent=2)

    # -------------------------------------------------------------------
    # 8. Extraction notes
    # -------------------------------------------------------------------
    cat_counts = Counter(d["category"] for d in dishes)
    lines = []
    lines.append("# یادداشت‌های استخراج دیتابیس غذا\n")
    lines.append(f"تعداد کل غذاهای استخراج‌شده: **{len(dishes)}**\n")
    lines.append("تعداد به تفکیک دسته:\n")
    for cat, cnt in cat_counts.most_common():
        lines.append(f"- {cat}: {cnt}")
    lines.append("")
    lines.append(f"تعداد غذاهایی که نیاز به قیمت‌گذاری دارند (`needsPrice: true`): **{len(needs_price)}**\n")
    for n in needs_price:
        lines.append(f"- {n}")
    lines.append("")
    lines.append(f"تعداد غذاهایی که پرچم نوسان قیمت خوردند (`priceVarianceFlag: true`, نوسان بیش از ۳۰٪): **{len(variance_flagged)}**\n")
    for n, lo, hi, med in variance_flagged:
        lines.append(f"- {n}: کمینه {lo:,.0f} ریال، بیشینه {hi:,.0f} ریال، میانه {med:,.0f} ریال")
    lines.append("")
    lines.append(f"تعداد غذاهایی که کارت رسپی (recipe card) برایشان پیدا نشد و ماکرو از پیش‌فرض دسته گرفته شد: **{len(no_recipe_dishes)}**\n")
    for n in no_recipe_dishes:
        lines.append(f"- {n}")
    lines.append("")
    lines.append(f"تعداد غذاهایی که ماکرو به‌صورت دستی (manual override) اصلاح شد: **{len(manual_macro_dishes)}**\n")
    for n in manual_macro_dishes:
        lines.append(f"- {n}")
    lines.append("")
    lines.append("## تصمیم‌های مهم و دلایل آن‌ها\n")
    lines.append(
        "**دامنه‌ی غذاها:** طبق تعریف اصلی task، دیتابیس فقط شامل غذاهایی است که در "
        "۱۷ شیت رویداد واقعی (event) ظاهر شده‌اند (حدود ۲۱۱ نام خام، پس از حذف نویز "
        f"و ادغام نام‌های مشابه به {len(dishes)} غذای یکتا رسید). در کنار این ۱۷ شیت، "
        "شیت `لیست کالای غذای n` هم ساختار مشابهی دارد اما هیچ قیمتی در آن ثبت نشده "
        "و هرگز به‌عنوان یک رویداد واقعی قیمت‌گذاری نشده؛ آن را نادیده گرفتیم. "
        "همچنین در کل ۳۳۸ شیت «کارت رسپی» در فایل وجود دارد اما فقط ۹۸ مورد از آن‌ها "
        "از شیت‌های رویداد ارجاع داده شده‌اند؛ حدود ۲۴۰ کارت رسپی باقی‌مانده (شامل غذاهای "
        "کامل مثل چلوخورش فسنجان، پیتزا سبزیجات، انواع سالاد و ساندویچ، و همچنین چند "
        "سس/مارینت زیرمجموعه مثل سس تاهینی و پیاز داغ) در دیتابیس نهایی **گنجانده "
        "نشدند** چون بخشی از منوی کامل کارخانه‌اند نه غذاهایی که در رویدادهای نمونه "
        "سرو شده‌اند — این با انتظار «۱۵۰ تا ۲۵۰ غذا» در task هم‌خوانی دارد. اگر لازم "
        "شد این کارت‌ها به دیتابیس اضافه شوند، باید یا شیت‌های رویداد بیشتری اضافه شود "
        "یا این تصمیم دامنه بازبینی شود."
    )
    lines.append("")
    lines.append(
        "**ردیف‌های حذف‌شده (نه یک غذا):** `1050000` (یک عدد ولوله‌شده در ستون نام)، "
        "`سرشکن 20 نفر برای 18 نفر`، `کل منو برای یک نفر`، `کل منو برای 20 نفر` "
        "(جمع‌های کل منو، نه یک قلم غذا)، و یک ردیف پانویس طولانی درباره‌ی روش "
        "قیمت‌گذاری (`موارد نارنجی قیمت با احتساب...`)."
    )
    lines.append("")
    lines.append(
        "**سربرگ‌های بخش (section headers) که task ذکر نکرده بود ولی در داده واقعی "
        "پیدا شدند:** با بررسی کامل هر ۱۷ شیت (نه فقط نمونه اول)، این کلمات هم به‌صورت "
        "ثابت به‌عنوان سربرگ بخش عمل می‌کنند (همیشه هزینه خالی دارند و همیشه قبل از "
        "اقلام غذایی مشخص می‌آیند): `WELCOME`، `میان وعده`، `فینگر فود`/`finger food`، "
        "`تنقلات`، `نوشیدنی سرد`، `نوشیدنی گرم`، `نوشیدنی ها`، `صبحانه`، و `دسر` "
        "(در این فایل، «دسر» هرگز خودش یک قلم قیمت‌گذاری‌شده نیست - همیشه سربرگ یک "
        "زیربخش است). سربرگ‌های `سوپ`/`سالاد`/`پنیر و میوه` هم به‌عنوان زیرسربرگ "
        "شفاف داخل «پیش غذا» عمل می‌کنند و دسته را عوض نمی‌کنند."
    )
    lines.append("")
    lines.append(
        "**بخش‌های مخلوط (WELCOME / بریک ۱ و ۲ / میان‌وعده / فینگر فود / تنقلات / "
        "سالاد و میوه):** چون اقلام زیر این سربرگ‌ها می‌توانند دسر، نوشیدنی یا "
        "پیش‌غذا باشند، هر قلم به‌صورت جداگانه بر اساس کلیدواژه‌های موجود در نامش "
        "دسته‌بندی شد (مثلاً «کوکتل میوه» → دسر، «چای و انواع قهوه» → نوشیدنی، "
        "«کروستینی پنیر و پستو» → پیش‌غذا به‌عنوان پیش‌فرض)."
    )
    lines.append("")
    lines.append(
        "**ادغام نام‌های مشابه (aliases):** چند نام با اختلاف املایی/فاصله‌گذاری "
        "جزئی به یک غذای یکتا ادغام شدند، از جمله: «بابا غنوش» = «باباغنوش»، "
        "«دیپ آووکادوو»/«دیپ اووکادو» = «دیپ آووکادو»، «سبزیجات بخار پز» = "
        "«سبزیجات بخارپز»، «میگوی سوخاری» = «میگو سوخاری»، «چیکن  استراگانف» "
        "(دو فاصله) = «چیکن استراگانف»، «کوکتل میوه های تابستانی» = «کوکتل میوه»، "
        "و دو ورژن «سالاد سبزیجات مدیترانه ای» که با/بدون پنیر هالومی در نام "
        "ذکر شده بودند ولی همان دستور پخت را داشتند."
    )
    if category_conflicts:
        lines.append("")
        lines.append(
            "**تعارض دسته‌بندی بین رویدادهای مختلف (دسته‌ی نهایی = پرتکرارترین؛ "
            "بقیه به همراه تعداد دفعات آمده‌اند):**\n"
        )
        for n, counts in sorted(category_conflicts.items()):
            parts = ", ".join(f"{cat} ({cnt} بار)" for cat, cnt in
                               sorted(counts.items(), key=lambda kv: -kv[1]))
            lines.append(f"- {n}: {parts}")
    lines.append("")
    lines.append(
        "**هزینه‌های مشکوک (احتمالاً هزینه کل رویداد نه هزینه هر پرس):** برای اقلام "
        "عمومی نوشیدنی گرم مثل «چای» و «قهوه» که به‌صورت مستقل (نه در قالب «چای و "
        "قهوه») در چند رویداد ثبت شده‌اند، اعداد ثبت‌شده در ستون «مبلغ نهایی» (برای "
        "مثال قهوه: ۲۵٬۲۰۰٬۰۰۰ و ۵۴٬۰۰۰٬۰۰۰ ریال) به‌طرز چشمگیری بزرگ‌تر از سایر "
        "غذاهای هر-پرس (که معمولاً بین ۱۵۰ هزار تا ۳ میلیون ریال هستند) است. این "
        "زیاد بودن به‌احتمال زیاد به این دلیل است که این ارقام هزینه *کل* چای/قهوه "
        "برای همه‌ی مهمانان یک رویداد هستند نه هزینه هر پرس - اما چون فایل منبع "
        "فرمول یا مبنای واحد جدایی برای این ردیف‌ها ندارد (برخلاف بقیه که به کارت "
        "رسپی وصل‌اند)، طبق دستور «هزینه را حدس نزن»، همان قانون میانه/نوسان استاندارد "
        "روی آن‌ها اجرا شد و به‌خاطر نوسان بالا پرچم گرفتند. توصیه می‌شود قبل از استفاده "
        "در اپ، این دو غذا (`چای`, `قهوه`) به‌صورت دستی توسط تیم کاربری بازبینی شوند."
    )
    lines.append("")
    lines.append(
        "**روش بررسی ماکرو (spot-check log):** طبق دستور task، هیچ محاسبه خام "
        "وزنی بدون بازبینی عقلانی پذیرفته نشد. روش کار: ابتدا برای هر غذا با کارت "
        "رسپی، ماکرو از روی وزن مواد اولیه محاسبه شد (با نگاشت گروه مواد اولیه به "
        "۴ سطل کربوهیدرات/پروتئین/سبزی‌ومیوه/چربی، به‌علاوه یک fallback مبتنی بر "
        "کلیدواژه نام ماده برای مواردی که در فهرست اصلی `مواد اولیه` نبودند). سپس "
        "خروجی همه دسته‌های اصلی (برنج، پیتزا، سالاد، کباب، پاستا، دسر، نوشیدنی) "
        "تک‌تک بازبینی شد. چند اشکال واقعی پیدا و اصلاح شد:\n"
        "- **خطای مقیاس در خود کارت رسپی منبع:** «لازانیا رولی» ماده «لازانیا» را "
        "با مقدار ۱ گرم ثبت کرده (باید چیزی حدود ۵۰-۸۰ گرم باشد)، و هر سه نسخه "
        "«اسپرینگ رول» ماده «نان یوفکا» را با ۰.۱۵ گرم ثبت کرده‌اند (باید ده‌ها "
        "برابر بیشتر باشد) - این باعث می‌شد این غذاها تقریباً ۰٪ کربوهیدرات محاسبه "
        "شوند که برای یک لازانیا یا رول سرخ‌شده غیرممکن است؛ ماکرو این ۴ غذا "
        "دستی اصلاح شد.\n"
        "- **باگ همپوشانی کلیدواژه:** کلیدواژه‌ی «موز» (برای دسته‌بندی موز به‌عنوان "
        "میوه/دسر) به‌اشتباه داخل کلمه‌ی «موزارلا» هم پیدا می‌شد و باعث می‌شد "
        "«مافین بیکن و موزارلا» (یک پیش‌غذای شور) به‌عنوان دسر دسته‌بندی شود؛ "
        "همین‌طور «شیر» (برای لبنیات) داخل «شیرینی» هم پیدا می‌شد. هر دو با تطبیق "
        "کلمه‌ی کامل (نه زیررشته) درست شدند.\n"
        "- **خطای دسته‌بندی در فهرست اصلی `مواد اولیه`:** «سبزی پلویی» (سبزی مخصوص "
        "پلو) در فهرست اصلی کارخانه زیر گروه «مواد نشاسته‌ای» ثبت شده (به‌احتمال "
        "زیاد چون در انبارداری کنار برنج خریداری می‌شود)، نه سبزیجات - باعث می‌شد "
        "«سبزی پلو» تقریباً ۹۷٪ کربوهیدرات و ۰٪ سبزی نشان دهد؛ این ماده به‌صورت "
        "موردی اصلاح شد (override دستی گروه، نه ویرایش فایل منبع).\n"
        "- **پنیر/لبنیات/حبوبات/آجیل با وزن خام:** یک قانون کلی «حبوبات مثل نخود و "
        "لوبیا = ترکیب کربوهیدرات+پروتئین (نه فقط پروتئین)» و «آجیل و ارده/طحینه = "
        "چربی غالب» و «سس‌های سالاد = چربی+سبزی (نه فقط سبزی)» اضافه شد - بدون این "
        "قوانین، «حمص» به‌جای ترکیب واقع‌بینانه چربی/کربوهیدرات/پروتئین، پروتئین‌محور "
        "و کم‌کربوهیدرات محاسبه می‌شد.\n\n"
        "غذاهایی که override دستیِ نهایی روی‌شان باقی ماند (فهرست کامل در کد اسکریپت): "
        "پیتزا پپرونی، پیتزا بیکن، پیتزا مارگاریتا (خمیر پیتزا در کارت رسپی ثبت "
        "نشده)، پوچداگ، پوچداگ با سس (بدون نان/نان همبرگری در کارت رسپی)، کلاب "
        "کالیفرنیا (نان توست با مقدار ۰.۱۵ عدد ثبت شده - عملاً نادیده‌گرفتنی)، "
        "لازانیا رولی، اسپرینگ رول، اسپرینگ رول سبزیجات، اسپرینگ رول سبزیچات (وگن) "
        "(خطاهای مقیاس بالا).\n\n"
        "در مقابل، دسته‌هایی که عمداً override نشدند چون محاسبه خام (پس از اصلاح "
        "کلیدواژه‌ها) از قبل معقول بود: غذاهای کباب تنها مثل «جوجه کباب»، «آدانا "
        "کباب» و «کباب قفقازی» که در این بوفه، برنج به‌صورت جداگانه («برنج سفید») "
        "سرو می‌شود - بنابراین ۰٪ کربوهیدرات برای خودِ سیخ کباب واقع‌بینانه است، نه "
        "یک باگ؛ اکثر سالادها (یونانی، فتوش، کینوا، پاستا) که بعد از اصلاح "
        "کلیدواژه‌ها به‌درستی سبزی‌محور درآمدند؛ و برنج‌های ساده. علاوه بر override "
        "های دستی، یک لایه sanity-check سطح-دسته هم به‌عنوان تور ایمنی نهایی اجرا "
        "می‌شود: اگر غذایی در دسته «دسر» باشد ولی پروتئین محاسبه‌شده بیش از حد "
        "باشد (که برای شیرینی/میوه هرگز رخ نمی‌دهد)، یا «پیتزا» باشد ولی "
        "کربوهیدرات محاسبه‌شده خیلی پایین بیاید، یا «سالاد» باشد ولی سهم سبزی "
        "محاسبه‌شده کم و چربی هم بالا نباشد، به یک مقدار پیش‌فرض معقول برای آن "
        "دسته برگردانده می‌شود. **توجه:** «کوکتل میوه» (یک فنجان میوه خالص) عمداً "
        "با ~۹۸٪ سهم «سبزی‌ومیوه» و ~۰٪ در بقیه رها شد - این خروجی درست است (میوه "
        "خالص هیچ پروتئین/چربی/نشاسته قابل توجهی ندارد)، نه یک باگ."
    )
    lines.append("")
    lines.append(
        "**هزینه غذاهایی که فقط «خرید از بیرون» بودند:** هیچ عددی ساخته نشد؛ "
        "`costPerServing: null`, `needsPrice: true`, `costSource: \"خرید از بیرون\"`."
    )
    lines.append("")
    lines.append(
        "**دستمزد/سربار:** شیت‌های `دستمزد`, `سربار`, و `گزارش آقای حسین پور` بررسی "
        "سرسری شدند و همگی مربوط به محاسبه‌ی قیمت فروش نهایی با احتساب حاشیه سود و "
        "هزینه پرسنلی هستند - خارج از محدوده‌ی این task (که فقط هزینه خام هر پرس را "
        "می‌خواهد) و در استخراج استفاده نشدند. همین‌طور `کمیسری` (مواد نیمه‌ساخته) و "
        "`بهای تمام شده بابت پرسنلی` که هزینه‌ی تبدیل/دستمزد را محاسبه می‌کنند، نادیده "
        "گرفته شدند."
    )

    with open(OUT_NOTES, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Wrote {len(dishes)} dishes to {OUT_DISHES}")
    print(f"Wrote notes to {OUT_NOTES}")
    print("Category counts:", dict(cat_counts))
    print("needsPrice:", len(needs_price))
    print("priceVarianceFlag:", len(variance_flagged))
    print("no recipe card found:", len(no_recipe_dishes))
    print("manual macro overrides applied:", len(manual_macro_dishes))


if __name__ == "__main__":
    main()
