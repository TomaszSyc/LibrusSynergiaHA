"""Parser strony uwag (i pochwal) Librus Synergia.

Podejscie (mapowanie naglowkow, dwa uklady strony) za mchuc/LibrusSynergiaHA (MIT).

Uklady:
1. tabela z wierszem naglowkowym (kolumny w dowolnej kolejnosci),
2. osobna tabelka na kazda uwage, wiersze <th>Nazwa</th><td>Wartosc</td>.

`parsuj_uwagi` zwraca (uwagi, nierozpoznany_uklad). Flaga jest True, gdy strona
nie zawiera tekstu "Brak uwag", a nie znaleziono zadnej uwagi (rowniez wtedy, gdy
na stronie nie ma tabel) - czyli prawdopodobnie zmienil sie uklad strony.
"""

from __future__ import annotations

import hashlib
from datetime import date, datetime
from typing import Any

from bs4 import BeautifulSoup, Tag
from librus_apix.helpers import no_access_check

UWAGI_URL = "https://synergia.librus.pl/uwagi"

_POLA = ("data", "nauczyciel", "rodzaj", "kategoria", "tresc")

_KOLUMNY = {
    "data": ("data", "dodano", "termin"),
    "nauczyciel": ("nauczyciel", "dodal", "dodala", "wystawil", "autor"),
    "rodzaj": ("rodzaj", "typ"),
    "kategoria": ("kategoria",),
    "tresc": ("tresc", "uwaga", "opis", "komentarz"),
}

_ZAMIANA = str.maketrans("ąćęłńóśźż", "acelnoszz")


def _norm(tekst: str) -> str:
    return " ".join(tekst.lower().translate(_ZAMIANA).split())


def _klucz_kolumny(naglowek: str) -> str | None:
    n = _norm(naglowek)
    for klucz, warianty in _KOLUMNY.items():
        if any(w in n for w in warianty):
            return klucz
    return None


def _tekst(el: Tag) -> str:
    return " ".join(el.get_text(" ", strip=True).split())


def _pusta() -> dict[str, str]:
    return {p: "" for p in _POLA}


def _z_naglowkiem(tabela: Tag) -> list[dict[str, str]]:
    wiersze = tabela.find_all("tr")
    naglowki: list[str | None] = []
    start = 0
    for i, wiersz in enumerate(wiersze):
        # naglowek: wiersz w <thead> albo pierwszy <tr> tabeli (komorki th lub td)
        if wiersz.find_parent("thead") is None and i != 0:
            continue
        komorki = wiersz.find_all(["th", "td"], recursive=False)
        klucze = [_klucz_kolumny(_tekst(k)) for k in komorki]
        if sum(1 for k in klucze if k) >= 2:
            naglowki, start = klucze, i + 1
        break
    if not naglowki:
        return []
    wynik = []
    for wiersz in wiersze[start:]:
        komorki = wiersz.find_all("td", recursive=False)
        if len(komorki) < 2:
            continue
        uwaga = _pusta()
        for klucz, komorka in zip(naglowki, komorki):
            if klucz:
                uwaga[klucz] = _tekst(komorka)
        if uwaga["tresc"] or uwaga["data"]:
            wynik.append(uwaga)
    return wynik


def _klucz_wartosc(tabela: Tag) -> list[dict[str, str]]:
    uwaga = _pusta()
    trafienia = 0
    for wiersz in tabela.find_all("tr"):
        th, td = wiersz.find("th"), wiersz.find("td")
        if th is None or td is None:
            continue
        klucz = _klucz_kolumny(_tekst(th))
        if klucz:
            uwaga[klucz] = _tekst(td)
            trafienia += 1
    if trafienia >= 2 and (uwaga["tresc"] or uwaga["data"]):
        return [uwaga]
    return []


def _parsuj_date(tekst: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(tekst.strip()[:10], fmt).date()
        except ValueError:
            continue
    return None


def parsuj_uwagi(html: str) -> tuple[list[dict[str, Any]], bool]:
    """Sparsuj HTML strony /uwagi; zwroc (uwagi od najnowszej, nierozpoznany_uklad).

    Rzuca TokenError (z librus_apix), gdy strona zwraca "Brak dostepu".
    """
    soup = no_access_check(BeautifulSoup(html, "lxml"))
    tabele = soup.select("table.decorated") or soup.find_all("table")

    uwagi: list[dict[str, Any]] = []
    for tabela in tabele:
        if tabela.find_parent("table") is not None:
            continue
        uwagi.extend(_z_naglowkiem(tabela) or _klucz_wartosc(tabela))

    if not uwagi:
        return [], "Brak uwag" not in soup.get_text()

    wystapienia: dict[tuple[str, ...], int] = {}
    for uwaga in uwagi:
        krotka = tuple(uwaga[p] for p in _POLA)
        n = wystapienia.get(krotka, 0)
        wystapienia[krotka] = n + 1
        surowe = "|".join(krotka) + f"|{n}"
        uwaga["id"] = hashlib.md5(surowe.encode("utf-8")).hexdigest()[:12]

    # od najnowszej; nieparsowalne daty na koncu, kolejnosc stabilna
    daty = [_parsuj_date(u["data"]) for u in uwagi]
    pary = sorted(
        zip(daty, uwagi),
        key=lambda p: (p[0] is None, -(p[0].toordinal()) if p[0] else 0),
    )
    return [u for _, u in pary], False


def pobierz_uwagi(client: Any) -> tuple[list[dict[str, Any]], bool]:
    """Pobierz i sparsuj strone uwag (blokujace - wolac w executorze)."""
    return parsuj_uwagi(client.get(UWAGI_URL).text)
