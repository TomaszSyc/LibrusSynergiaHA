import pytest
from custom_components.librus_apix.ai_summary import _parse_ai_json_response


def test_parse_clean_json():
    """Weryfikacja bezpośredniego parsowania czystego JSON."""
    raw = '{"rodzic": "Wszystko w porządku.", "uczen": "Dobra robota!"}'
    res = _parse_ai_json_response(raw)
    assert res == {"rodzic": "Wszystko w porządku.", "uczen": "Dobra robota!"}


def test_parse_markdown_json_block():
    """Weryfikacja parsowania bloku ```json ... ```."""
    raw = """```json
{
  "rodzic": "Ocena 5 z historii.",
  "uczen": "Świetny tydzień!"
}
```"""
    res = _parse_ai_json_response(raw)
    assert res == {"rodzic": "Ocena 5 z historii.", "uczen": "Świetny tydzień!"}


def test_parse_markdown_without_language_tag():
    """Weryfikacja parsowania bloku ``` ... ``` bez etykiety json."""
    raw = """```
{"rodzic": "Brak uwag.", "uczen": "Odpocznij."}
```"""
    res = _parse_ai_json_response(raw)
    assert res == {"rodzic": "Brak uwag.", "uczen": "Odpocznij."}


def test_parse_with_conversational_preamble_and_postamble():
    """Weryfikacja parsowania gdy model dodaje wstęp i zakończenie."""
    raw = """Oto wygenerowane podsumowanie:

```json
{
  "rodzic": "Wiadomość od wychowawcy o zebraniu.",
  "uczen": "Pamiętaj o stroju galowym."
}
```

Mam nadzieję, że pomogłem! Pozdrawiam serdecznie."""
    res = _parse_ai_json_response(raw)
    assert res == {
        "rodzic": "Wiadomość od wychowawcy o zebraniu.",
        "uczen": "Pamiętaj o stroju galowym.",
    }


def test_parse_embedded_json_without_markdown():
    """Weryfikacja parsowania gdy JSON jest wpleciony w tekst bez znaczników markdown."""
    raw = 'Oto dane: {"rodzic": "Podsumowanie", "uczen": "Zadania domowe zrobione"} - koniec raportu.'
    res = _parse_ai_json_response(raw)
    assert res == {"rodzic": "Podsumowanie", "uczen": "Zadania domowe zrobione"}


def test_parse_fallback_raw_text():
    """Weryfikacja działania fallbacku gdy model zwróci czysty tekst zamiast JSON."""
    raw = "W tym tygodniu uczeń radził sobie znakomicie we wszystkich przedmiotach."
    res = _parse_ai_json_response(raw)
    assert res == {"rodzic": raw, "uczen": raw}


def test_parse_empty():
    """Weryfikacja pustej odpowiedzi."""
    assert _parse_ai_json_response("") == {}
    assert _parse_ai_json_response("   \n  ") == {}


def test_default_prompts_placeholders():
    """Weryfikacja czy domyślne prompty zawierają wymagane placeholdery."""
    from custom_components.librus_apix.ai_prompts import (
        DEFAULT_PROMPT_MESSAGES_PARENT,
        DEFAULT_PROMPT_MESSAGES_STUDENT,
        DEFAULT_PROMPT_WEEKLY_PARENT,
        DEFAULT_PROMPT_WEEKLY_STUDENT,
    )
    for p in (DEFAULT_PROMPT_MESSAGES_PARENT, DEFAULT_PROMPT_MESSAGES_STUDENT):
        assert "{dzisiejsza_data}" in p
        assert "{imie}" in p
        assert "{wiadomosci}" in p

    for p in (DEFAULT_PROMPT_WEEKLY_PARENT, DEFAULT_PROMPT_WEEKLY_STUDENT):
        assert "{imie}" in p
        assert "{oceny}" in p
        assert "{frekwencja}" in p
        assert "{nieobecnosci}" in p
        assert "{zadania}" in p
        assert "{uwagi}" in p
        assert "{sprawdziany}" in p


def test_extract_ai_role_text():
    """Weryfikacja odpornego wyciągania ról z JSON (case-insensitive, synonimy, zagnieżdżenia)."""
    from custom_components.librus_apix.ai_summary import _extract_ai_role_text

    # 1. Wielkie litery i polskie znaki
    data = {"Rodzic": "Tekst dla rodzica", "Uczeń": "Tekst dla ucznia"}
    assert _extract_ai_role_text(data, "rodzic") == "Tekst dla rodzica"
    assert _extract_ai_role_text(data, "uczen") == "Tekst dla ucznia"

    # 2. Angielskie klucze
    data_en = {"parent": "Parent notes", "student": "Student tips"}
    assert _extract_ai_role_text(data_en, "rodzic") == "Parent notes"
    assert _extract_ai_role_text(data_en, "uczen") == "Student tips"

    # 3. Zagnieżdżona struktura
    data_nested = {"Wiktor": {"rodzic": "Wszystko ok", "uczen": "Dobra robota"}}
    assert _extract_ai_role_text(data_nested, "rodzic") == "Wszystko ok"
    assert _extract_ai_role_text(data_nested, "uczen") == "Dobra robota"


def test_substitute_prompt_tags_with_custom_days():
    """Weryfikacja dynamicznego formatowania {sprawdziany:8}, {oceny:10} i domyślnych 7 dni."""
    from datetime import date, timedelta
    from custom_components.librus_apix.ai_summary import _substitute_prompt_tags

    today = date.today()
    in_5_days = (today + timedelta(days=5)).strftime("%Y-%m-%d")
    in_10_days = (today + timedelta(days=10)).strftime("%Y-%m-%d")
    past_3_days = (today - timedelta(days=3)).strftime("%Y-%m-%d")
    past_12_days = (today - timedelta(days=12)).strftime("%Y-%m-%d")

    coordinator_data = {
        "oceny_wg_przedmiotu": {
            "Matematyka": [
                {"ocena": "5", "kategoria": "sprawdzian", "data": past_3_days},
                {"ocena": "3", "kategoria": "kartkówka", "data": past_12_days},
            ]
        },
        "terminarz": [
            {
                "data": in_5_days,
                "tytul": "Sprawdzian",
                "przedmiot": "Język polski",
                "rodzaj": "sprawdzian",
                "szczegoly": {"Opis": "I rozdział"},
            },
            {
                "data": in_10_days,
                "tytul": "Sprawdzian",
                "przedmiot": "Historia",
                "rodzaj": "sprawdzian",
                "szczegoly": {"Opis": "Średniowiecze"},
            },
        ],
        "zadania": [],
        "uwagi": [],
        "frekwencja_stat": {"procent_semestr": "98.5", "rodzaje": {}},
    }

    # 1. Domyślne 7 dni: sprawdzian z polskiego (5 dni) wchodzi, historia (10 dni) nie wchodzi
    prompt_default = "Sprawdziany: {sprawdziany}\nOceny: {oceny}"
    out_default = _substitute_prompt_tags(prompt_default, coordinator_data, today.strftime("%Y-%m-%d"), "Wiktor")
    assert "Język polski" in out_default
    assert "Historia" not in out_default
    assert "Matematyka: 5" in out_default
    assert "Matematyka: 3" not in out_default  # ocena sprzed 12 dni odpada przy 7 dniach

    # 2. Parametryczne: {sprawdziany:12} i {oceny:14} - oba wchodzą
    prompt_custom = "Sprawdziany: {sprawdziany:12}\nOceny: {oceny:14}"
    out_custom = _substitute_prompt_tags(prompt_custom, coordinator_data, today.strftime("%Y-%m-%d"), "Wiktor")
    assert "Język polski" in out_custom
    assert "Historia" in out_custom
    assert "Matematyka: 5" in out_custom
    assert "3 (kartkówka)" in out_custom

    # 3. Parametryczne: {sprawdziany:3} - żaden sprawdzian nie wchodzi
    prompt_short = "Sprawdziany: {sprawdziany:3}"
    out_short = _substitute_prompt_tags(prompt_short, coordinator_data, today.strftime("%Y-%m-%d"), "Wiktor")
    assert "Brak zapowiedzianych sprawdzianów" in out_short



