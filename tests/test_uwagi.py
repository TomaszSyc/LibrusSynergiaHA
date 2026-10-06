"""Testy parsera strony uwag."""

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from librus_apix.exceptions import TokenError

from custom_components.librus_apix.uwagi import UWAGI_URL, parsuj_uwagi, pobierz_uwagi

FIX = Path(__file__).parent / "fixtures"


def _wczytaj(nazwa):
    return (FIX / nazwa).read_text(encoding="utf-8")


def test_uklad_tabelaryczny_nietypowa_kolejnosc():
    uwagi, flaga = parsuj_uwagi(_wczytaj("uwagi_tabela.html"))
    assert flaga is False
    assert len(uwagi) == 2
    # od najnowszej
    assert uwagi[0]["data"] == "2025-05-20"
    assert uwagi[0]["nauczyciel"] == "Jan Kowalski"
    assert uwagi[0]["rodzaj"] == "Negatywna"
    assert uwagi[0]["kategoria"] == "Zachowanie na lekcji"
    assert uwagi[0]["tresc"] == "Rozmowa podczas lekcji"
    assert uwagi[1]["tresc"] == "Pomoc kolegom przy projekcie"
    assert all(len(u["id"]) == 12 for u in uwagi)


def test_uklad_kart():
    uwagi, flaga = parsuj_uwagi(_wczytaj("uwagi_karty.html"))
    assert flaga is False
    assert [u["data"] for u in uwagi] == ["03.04.2025", "12.01.2025"]
    assert uwagi[1]["rodzaj"] == "Pochwała"
    assert uwagi[1]["tresc"] == "Aktywny udział w zajęciach"


def test_brak_uwag():
    assert parsuj_uwagi(_wczytaj("uwagi_brak.html")) == ([], False)


def test_nieznana_tabela_bez_brak_uwag():
    assert parsuj_uwagi(_wczytaj("uwagi_nieznane.html")) == ([], True)


def test_strona_bez_tabel_i_bez_brak_uwag():
    assert parsuj_uwagi("<html><body><p>cokolwiek</p></body></html>") == ([], True)


def test_brak_dostepu():
    with pytest.raises(TokenError):
        parsuj_uwagi(_wczytaj("uwagi_brak_dostepu.html"))


def test_identyczne_uwagi_maja_rozne_id():
    wiersz = (
        "<tr><td>2025-02-01</td><td>Anna Nowak</td><td>Pochwała</td>"
        "<td>Pomoc</td><td>Pomoc kolegom przy projekcie</td></tr>"
    )
    html = (
        '<table class="decorated"><thead><tr><th>Data</th><th>Nauczyciel</th>'
        "<th>Rodzaj</th><th>Kategoria</th><th>Treść</th></tr></thead><tbody>"
        + wiersz * 2
        + "</tbody></table>"
    )
    uwagi, flaga = parsuj_uwagi(html)
    assert flaga is False
    assert len(uwagi) == 2
    assert uwagi[0]["id"] != uwagi[1]["id"]
    # stabilne między wywołaniami
    assert {u["id"] for u in parsuj_uwagi(html)[0]} == {u["id"] for u in uwagi}


def test_sortowanie_mieszane_formaty_i_nieparsowalne_na_koncu():
    def w(d, t):
        return f"<tr><td>{d}</td><td>X</td><td>Y</td><td>Z</td><td>{t}</td></tr>"

    html = (
        '<table class="decorated"><thead><tr><th>Data</th><th>Nauczyciel</th>'
        "<th>Rodzaj</th><th>Kategoria</th><th>Treść</th></tr></thead><tbody>"
        + w("brak", "a")
        + w("01.02.2025", "b")
        + w("2025-03-01", "c")
        + w("niedziela", "d")
        + "</tbody></table>"
    )
    uwagi, _ = parsuj_uwagi(html)
    assert [u["tresc"] for u in uwagi] == ["c", "b", "a", "d"]


def test_pobierz_uwagi():
    client = MagicMock()
    client.get.return_value.text = _wczytaj("uwagi_brak.html")
    assert pobierz_uwagi(client) == ([], False)
    client.get.assert_called_once_with(UWAGI_URL)
    assert UWAGI_URL == "https://synergia.librus.pl/uwagi"


def test_naglowek_w_td_w_thead():
    uwagi, flaga = parsuj_uwagi(_wczytaj("uwagi_thead_td.html"))
    assert flaga is False
    assert len(uwagi) == 1
    assert uwagi[0]["data"] == "2025-03-01"
    assert uwagi[0]["nauczyciel"] == "Jan Kowalski"
    assert uwagi[0]["kategoria"] == "Pozytywna"
    assert uwagi[0]["tresc"] == "Pomoc kolegom"


def test_naglowek_w_td_pierwszy_wiersz_bez_thead():
    html = (
        '<table class="decorated"><tr><td>Data</td><td>Treść</td></tr>'
        "<tr><td>2025-03-01</td><td>Pomoc kolegom</td></tr></table>"
    )
    uwagi, flaga = parsuj_uwagi(html)
    assert flaga is False and [u["tresc"] for u in uwagi] == ["Pomoc kolegom"]


# --- zachowanie ---

from custom_components.librus_apix.uwagi import parsuj_zachowanie, pobierz_zachowanie  # noqa: E402

_PUSTA = {"ocena": None, "propozycja": False}


def test_zachowanie_pusty():
    w = parsuj_zachowanie(_wczytaj("zachowanie_pusty.html"))
    assert w == {"okres_1": _PUSTA, "okres_2": _PUSTA, "roczna": _PUSTA, "wpisy": []}


def test_zachowanie_okres1_wpisy():
    w = parsuj_zachowanie(_wczytaj("zachowanie_okres1.html"))
    assert w["okres_1"] == _PUSTA and w["roczna"] == _PUSTA
    assert w["wpisy"] == [
        {"okres": 1, "ocena": "nb", "rodzaj": "negatywne", "data": "2025-03-10",
         "nauczyciel": "Kowalski Jan", "komentarz": "Rozmowa podczas lekcji"},
        {"okres": 1, "ocena": "pb", "rodzaj": "pozytywne", "data": "2025-03-12",
         "nauczyciel": "Kowalski Jan", "komentarz": "Pomoc przy organizacji wycieczki"},
    ]


def test_zachowanie_propozycja():
    w = parsuj_zachowanie(_wczytaj("zachowanie_propozycja.html"))
    assert w["okres_1"] == {"ocena": "bardzo dobre", "propozycja": True}
    assert w["okres_2"] == _PUSTA
    assert w["roczna"] == _PUSTA


def test_zachowanie_pelny():
    w = parsuj_zachowanie(_wczytaj("zachowanie_pelny.html"))
    assert w["okres_1"] == {"ocena": "dobre", "propozycja": False}
    assert w["roczna"] == {"ocena": "bardzo dobre", "propozycja": False}
    assert [(x["okres"], x["rodzaj"]) for x in w["wpisy"]] == [
        (1, "negatywne"), (1, "pozytywne"), (2, "neutralne")]
    assert w["wpisy"][2]["komentarz"] == ""


def test_zachowanie_brak_wiersza():
    w = parsuj_zachowanie(_wczytaj("zachowanie_brak_wiersza.html"))
    assert w == {"okres_1": _PUSTA, "okres_2": _PUSTA, "roczna": _PUSTA, "wpisy": []}


def test_zachowanie_brak_dostepu():
    with pytest.raises(TokenError):
        parsuj_zachowanie(_wczytaj("uwagi_brak_dostepu.html"))


def test_pobierz_zachowanie():
    client = MagicMock()
    client.post.return_value.text = _wczytaj("zachowanie_pelny.html")
    assert pobierz_zachowanie(client)["roczna"]["ocena"] == "bardzo dobre"
    client.post.assert_called_once_with(
        client.GRADES_URL, data={"zmiany_logowanie_wszystkie": "1"})
