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


def _ocena_lub_none(tekst: str) -> str | None:
    tekst = tekst.strip()
    return None if tekst in ("", "-") else tekst


def _wpisy_zachowania(komorka: Tag, okres: int) -> list[dict[str, Any]]:
    wynik = []
    for a in komorka.select("span.grade-box > a"):
        klasy = a.parent.get("class", [])
        if "positive-behaviour" in klasy:
            rodzaj = "pozytywne"
        elif "negative-behaviour" in klasy:
            rodzaj = "negatywne"
        else:
            rodzaj = "neutralne"
        pola: dict[str, str] = {}
        # BeautifulSoup zamienia <br> w "\n" tylko przez separator get_text
        for czesc in BeautifulSoup(a.get("title", ""), "lxml").get_text("\n").split("\n"):
            klucz, _, wartosc = czesc.partition(":")
            pola[_norm(klucz)] = wartosc.strip()
        data = pola.get("data wystawienia", "")
        wynik.append({
            "okres": okres,
            "ocena": _tekst(a),
            "rodzaj": rodzaj,
            "data": data.split(" ")[0] if data else "",
            "nauczyciel": pola.get("dodal", ""),
            "komentarz": pola.get("komentarz", ""),
        })
    return wynik


def parsuj_zachowanie(html: str) -> dict[str, Any]:
    """Sparsuj wiersz "Zachowanie" ze strony ocen.

    Oceny: okres_1 = komorka I, roczna = komorka R. Osobnej komorki oceny
    Okres 2 nie ma, wiec okres_2 wynika tylko z wierszy podsumowan tabeli
    szczegolow (None, gdy nie ma niepustej wartosci). Wartosc z wiersza
    podsumowania uzupelnia tylko brakujaca ocene; propozycja=True, gdy etykieta
    zawiera "propon" lub "przewid".
    """
    soup = no_access_check(BeautifulSoup(html, "lxml"))
    wynik: dict[str, Any] = {
        k: {"ocena": None, "propozycja": False} for k in ("okres_1", "okres_2", "roczna")
    }
    wynik["wpisy"] = []

    glowny = None
    for tr in soup.find_all("tr"):
        komorki = tr.find_all("td", recursive=False)
        if len(komorki) >= 6 and _norm(_tekst(komorki[1])) == "zachowanie":
            glowny = tr
            break
    if glowny is None:
        return wynik

    k = glowny.find_all("td", recursive=False)
    wynik["okres_1"]["ocena"] = _ocena_lub_none(_tekst(k[3]))
    wynik["roczna"]["ocena"] = _ocena_lub_none(_tekst(k[5]))
    wynik["wpisy"] = _wpisy_zachowania(k[2], 1) + _wpisy_zachowania(k[4], 2)

    szczegoly = glowny.find_next_sibling("tr", id="przedmioty_zachowanie")
    okres = 1
    for tr in (szczegoly.find_all("tr") if szczegoly else []):
        komorki = tr.find_all("td", recursive=False)
        if len(komorki) == 1:
            n = _norm(_tekst(komorki[0]))
            if n in ("okres 1", "okres 2"):
                okres = int(n[-1])
            continue
        if len(komorki) < 3 or "right" not in komorki[0].get("class", []):
            continue
        etykieta = _norm(_tekst(komorki[0]))
        wartosc = next((t for t in map(_tekst, komorki[1:]) if t), "")
        if _ocena_lub_none(wartosc) is None:
            continue
        roczna = "roczn" in etykieta and "srodroczn" not in etykieta
        cel = wynik["roczna"] if roczna else wynik[f"okres_{okres}"]
        if cel["ocena"] is None:
            cel["ocena"] = wartosc
            cel["propozycja"] = "propon" in etykieta or "przewid" in etykieta
    return wynik


def pobierz_zachowanie(client: Any) -> dict[str, Any]:
    """Pobierz i sparsuj strone ocen (blokujace - wolac w executorze)."""
    odp = client.post(client.GRADES_URL, data={"zmiany_logowanie_wszystkie": "1"})
    return parsuj_zachowanie(odp.text)
