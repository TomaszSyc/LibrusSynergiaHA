"""#50: oceny opisowe z nowego schematu Librusa oraz #49: brak dublowania ocen punktowych."""

import logging
from collections import defaultdict
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from custom_components.librus_apix import LibrusApiClient

STRONA = """<html><body>
<table class="decorated"><tr class="line0"><td>Fizyka</td></tr></table>
{nowy}
</body></html>"""
NOWY_SCHEMAT = '<table class="newSchemaGradesByStudentTable"><tr class="studentRow" data-subject_id="7"><td></td><td>Edukacja matematyczna</td></tr></table>'


def _ocena(przedmiot, ocena, data, kategoria="Sprawdzian", desc=""):
    return SimpleNamespace(
        title=przedmiot, grade=ocena, date=data, category=kategoria, teacher="Nowak Anna",
        semester=1, comments=None, desc=desc or f"Ocena: {ocena}\nPrzedmiot: {przedmiot}\n",
    )


def _sem(slownik):
    d = defaultdict(list)
    d.update(slownik)
    return [d, defaultdict(list)]


def _klient(html):
    client = LibrusApiClient("u", "p")
    client._client = MagicMock()
    client._token = "token"
    client._client.post.return_value.text = html
    return client


@pytest.fixture(autouse=True)
def _semestr():
    with patch("custom_components.librus_apix._current_semester", return_value=1):
        yield


# --- #50: nowy schemat ocen opisowych ---

OCENA_API = _ocena(
    "Edukacja matematyczna", "5+", "2026-10-15", kategoria="",
    desc=("Ocena: 5+\nPrzedmiot: Edukacja matematyczna\nObszar: Dodawanie i odejmowanie\n"
          "Data: 2026-10-15\nNauczyciel: Nowak Anna\nTreść oceny: Bardzo sprawnie liczy w pamięci\n"
          "Dodał: Nowak Anna\nKomentarz: \n"),
)


async def test_oceny_opisowe_z_nowego_schematu():
    client = _klient(STRONA.format(nowy=NOWY_SCHEMAT))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("librus_apix.grades._extract_grades_descriptive_from_api", create=True,
               return_value=_sem({"Edukacja matematyczna": [OCENA_API]})) as api:
        oceny = await client.async_get_grades()
    api.assert_called_once()
    wiersze = api.call_args.args[1]
    assert len(wiersze) == 1 and wiersze[0]["data-subject_id"] == "7"
    assert len(oceny) == 1
    o = oceny[0]
    assert o["subject"] == "Edukacja matematyczna"
    assert o["grade"] == "5+"
    assert o["category"] == "Dodawanie i odejmowanie"
    assert o["opis"] == "Bardzo sprawnie liczy w pamięci"
    assert o["type"] == "descriptive"


async def test_oceny_z_html_maja_pierwszenstwo_przed_api():
    """Jak w librus-apix: API uzupełnia tylko przedmioty bez ocen opisowych z HTML."""
    z_html = _ocena("Edukacja matematyczna", "6", "2026-10-10")
    client = _klient(STRONA.format(nowy=NOWY_SCHEMAT))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({"Edukacja matematyczna": [z_html]})), \
         patch("librus_apix.grades._extract_grades_descriptive_from_api", create=True,
               return_value=_sem({"Edukacja matematyczna": [OCENA_API]})):
        oceny = await client.async_get_grades()
    assert [o["grade"] for o in oceny] == ["6"]


async def test_bez_nowego_schematu_bez_zapytan_do_api():
    client = _klient(STRONA.format(nowy=""))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("librus_apix.grades._extract_grades_descriptive_from_api", create=True) as api:
        await client.async_get_grades()
    api.assert_not_called()


async def test_blad_api_nie_psuje_ocen(caplog):
    zwykla = _ocena("Fizyka", "5", "2026-10-10")
    client = _klient(STRONA.format(nowy=NOWY_SCHEMAT))
    with caplog.at_level(logging.WARNING, logger="custom_components.librus_apix"), \
         patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({"Fizyka": [zwykla]}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("librus_apix.grades._extract_grades_descriptive_from_api", create=True, side_effect=RuntimeError("API")):
        oceny = await client.async_get_grades()
    assert [o["grade"] for o in oceny] == ["5"]
    assert any("opisowych" in r.getMessage() for r in caplog.records)


async def test_stara_biblioteka_bez_obslugi_nowego_schematu(caplog):
    """librus-apix < 1.6.0: ostrzeżenie zamiast błędu, reszta ocen bez zmian."""
    import librus_apix.grades as gr

    client = _klient(STRONA.format(nowy=NOWY_SCHEMAT))
    with caplog.at_level(logging.WARNING, logger="custom_components.librus_apix"), \
         patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch.object(gr, "_extract_grades_descriptive_from_api", None, create=True):
        assert await client.async_get_grades() == []
    assert any("1.6.0" in r.getMessage() for r in caplog.records)


# --- #49: oceny punktowe nie dublują ocen z biblioteki ---


async def test_ocena_punktowa_nie_dubluje_oceny_z_biblioteki():
    z_biblioteki = [_ocena("Fizyka", "100", "2026-10-20"), _ocena("Fizyka", "99", "2026-10-13")]
    punktowe = [
        {"subject": "Fizyka", "grade": "100", "date": "2026-10-20", "category": "Sprawdzian", "teacher": "",
         "semester": 1, "komentarz": "", "type": "points", "max_points": None, "percent": None, "counts": True},
        {"subject": " fizyka ", "grade": "99", "date": "2026-10-13", "category": "Kartkówka", "teacher": "",
         "semester": 1, "komentarz": "", "type": "points", "max_points": None, "percent": None, "counts": True},
        {"subject": "Fizyka", "grade": "87", "date": "2026-10-06", "category": "Aktywność", "teacher": "",
         "semester": 1, "komentarz": "", "type": "points", "max_points": 100, "percent": 87.0, "counts": True},
    ]
    client = _klient(STRONA.format(nowy=""))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({"Fizyka": z_biblioteki}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("custom_components.librus_apix._parse_point_grades", return_value=punktowe):
        oceny = await client.async_get_grades()
    assert sorted(o["grade"] for o in oceny) == ["100", "87", "99"]
    # Zostaje pełniejsza wersja punktowa (skala, procent, kategoria bez "(0-100)")
    assert all(o["type"] == "points" for o in oceny)


async def test_ocena_punktowa_ze_skala_zastepuje_wpis_biblioteki():
    """#49: biblioteka zwraca ocenę punktową z kategorią "kartkówka (0-20)" - zostaje wersja z procentem."""
    z_biblioteki = [_ocena("Fizyka", "14", "2026-10-19", kategoria="kartkówka (0-20)")]
    punktowe = [{"subject": "Fizyka", "grade": "14", "date": "2026-10-19", "category": "kartkówka", "teacher": "",
                 "semester": 1, "komentarz": "", "type": "points", "max_points": 20, "percent": 70.0, "counts": True}]
    client = _klient(STRONA.format(nowy=""))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({"Fizyka": z_biblioteki}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("custom_components.librus_apix._parse_point_grades", return_value=punktowe):
        oceny = await client.async_get_grades()
    assert len(oceny) == 1
    assert oceny[0]["percent"] == 70.0
    assert oceny[0]["category"] == "kartkówka"


async def test_dwie_takie_same_oceny_punktowe_zastepuja_po_jednej():
    """Dwie identyczne oceny w obu źródłach: dwie wersje punktowe, bez trzeciego wpisu."""
    z_biblioteki = [_ocena("Fizyka", "100", "2026-10-20"), _ocena("Fizyka", "100", "2026-10-20")]
    p = {"subject": "Fizyka", "grade": "100", "date": "2026-10-20", "category": "Kartkówka", "teacher": "",
         "semester": 1, "komentarz": "", "type": "points", "max_points": 100, "percent": 100.0, "counts": True}
    client = _klient(STRONA.format(nowy=""))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({"Fizyka": z_biblioteki}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("custom_components.librus_apix._parse_point_grades", return_value=[dict(p), dict(p)]):
        oceny = await client.async_get_grades()
    assert [o["type"] for o in oceny] == ["points", "points"]


async def test_dwie_takie_same_oceny_z_biblioteki_zostaja():
    """Zabezpieczenie dotyczy tylko ocen punktowych - prawdziwe powtórzenia z biblioteki zostają."""
    dwie = [_ocena("Fizyka", "5", "2026-10-20"), _ocena("Fizyka", "5", "2026-10-20")]
    client = _klient(STRONA.format(nowy=""))
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(_sem({"Fizyka": dwie}), [])), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=_sem({})), \
         patch("custom_components.librus_apix._parse_point_grades", return_value=[]):
        oceny = await client.async_get_grades()
    assert [o["grade"] for o in oceny] == ["5", "5"]
