"""Logika ocen: poprawy, skale, srednie. Czysty Python, bez Home Assistanta."""
from __future__ import annotations

import re

_RE_CYFRA = re.compile(r"^([1-6])([+-]?)$")
_RE_LITERA = re.compile(r"^([A-F])([+-]?)$")
_RE_ULAMEK = re.compile(r"^(\d+(?:[.,]\d+)?)\s*/\s*(\d+(?:[.,]\d+)?)$")
_RE_SUFIKS = re.compile(r"^(\d+(?:[.,]\d+)?)\s*(%|pkt|p)$", re.IGNORECASE)
_RE_LICZBA = re.compile(r"^(\d+(?:[.,]\d+)?)$")
_LITERY = {"A": 5.0, "B": 4.0, "C": 2.0, "D": 1.0, "E": 1.0, "F": 1.0}


def _liczba(tekst: str) -> float:
    return float(tekst.replace(",", "."))


def oznacz_zastapione(oceny: list[dict]) -> list[dict]:
    """Ustawia superseded: poprawa zaznacza grupe od ostatniej nie-poprawy."""
    start = 0
    for i, ocena in enumerate(oceny):
        if not ocena.get("improvement"):
            start = i
            ocena["superseded"] = False
            continue
        for j in range(start, i):
            oceny[j]["superseded"] = True
        ocena["superseded"] = False
    return oceny


def procent_oceny(ocena: str) -> float | None:
    """Wartosc procentowa oceny punktowej albo None."""
    ocena = (ocena or "").strip()
    m = _RE_ULAMEK.match(ocena)
    if m:
        mianownik = _liczba(m.group(2))
        if mianownik == 0:
            return None
        return _liczba(m.group(1)) / mianownik * 100
    m = _RE_SUFIKS.match(ocena)
    if m:
        return _liczba(m.group(1))
    m = _RE_LICZBA.match(ocena)
    if m and _liczba(m.group(1)) >= 7:
        return _liczba(m.group(1))
    return None


def skala_oceny(ocena: str) -> str | None:
    """Zwraca "1-6", "litery", "punkty" albo None (nie liczy sie nigdzie)."""
    ocena = (ocena or "").strip()
    if _RE_CYFRA.match(ocena):
        return "1-6"
    if _RE_LITERA.match(ocena):
        return "litery"
    if procent_oceny(ocena) is not None:
        return "punkty"
    return None


def wartosc_oceny(ocena: str) -> float | None:
    """Wartosc liczbowa oceny 1-6 lub literowej albo None."""
    ocena = (ocena or "").strip()
    m = _RE_CYFRA.match(ocena)
    if m:
        baza = float(m.group(1))
    else:
        m = _RE_LITERA.match(ocena)
        if not m:
            return None
        baza = _LITERY[m.group(1)]
    if m.group(2) == "+":
        return baza + 0.5
    if m.group(2) == "-":
        return baza - 0.25
    return baza


def _liczy_sie(ocena: dict) -> bool:
    return not ocena.get("zastapiona") and ocena.get("licz_do_sredniej") is not False


def srednia_wazona(oceny: list[dict]) -> float | None:
    """Srednia wazona ocen 1-6 i literowych; waga 0/brak = 1."""
    suma = wagi = 0.0
    for o in oceny:
        if not _liczy_sie(o):
            continue
        wartosc = wartosc_oceny(o.get("ocena", ""))
        if wartosc is None:
            continue
        waga = o.get("waga") or 1
        suma += wartosc * waga
        wagi += waga
    return round(suma / wagi, 2) if wagi else None


def srednia_procentowa(oceny: list[dict]) -> float | None:
    """Srednia z ocen punktowych, bez wag."""
    wartosci = []
    for o in oceny:
        if not _liczy_sie(o):
            continue
        ocena = o.get("ocena", "")
        if skala_oceny(ocena) == "punkty":
            wartosci.append(procent_oceny(ocena))
    return round(sum(wartosci) / len(wartosci), 2) if wartosci else None


def biezacy_semestr(oceny_sem2_liczbowe: dict, oceny_sem2_opisowe: dict) -> int:
    """2, jesli jakakolwiek lista ocen semestru 2 jest niepusta, inaczej 1."""
    for slownik in (oceny_sem2_liczbowe, oceny_sem2_opisowe):
        if any(slownik.values()):
            return 2
    return 1
