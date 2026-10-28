"""Zmiany forka: srednia wazona, semestr, frekwencja, liczba wiadomosci, zdarzenia."""

from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.librus_apix.__init__ import LibrusApiClient
from custom_components.librus_apix.sensor import LibrusDataUpdateCoordinator


def _uczen(imie):
    info = MagicMock()
    info.name = imie
    return info


def _entry():
    e = MagicMock()
    e.entry_id = "test_123"
    return e


@pytest.fixture
def mock_client():
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = {}
    client.async_authenticate = AsyncMock(return_value=True)
    client.async_init_cache = AsyncMock()
    client.async_get_student_information = AsyncMock(return_value=None)
    client.async_get_grades = AsyncMock(return_value=[])
    client.async_get_messages = AsyncMock(return_value=[])
    client.async_get_homework = AsyncMock(return_value=[])
    client.async_get_schedule = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=[])
    client.async_get_attendance = AsyncMock(return_value=[])
    client.async_get_announcements = AsyncMock(return_value=[])
    client.async_get_completed_lessons = AsyncMock(return_value=[])
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])
    client.async_get_behavior = AsyncMock(return_value=None)
    return client


@pytest.fixture
def coordinator(hass, mock_client):
    return LibrusDataUpdateCoordinator(hass, mock_client)


# --- Srednia wazona, poprawy, skala ---


def _ocena(subject, grade, **kw):
    d = {
        "subject": subject, "grade": grade, "date": "2025-10-01",
        "category": "Sprawdzian", "teacher": "Anna Nowak", "semester": 1,
        "komentarz": "", "type": "numeric",
        "weight": 1, "counts": True, "improvement": False,
        "superseded": False, "scale": "1-6",
    }
    d.update(kw)
    return d


def _sensory(coordinator, subject):
    from custom_components.librus_apix.sensor import (
        LibrusPrzedmiotSensor, LibrusSredniaOcenSensor, LibrusSredniaPrzedmiotuSensor,
    )
    entry = _entry()
    return (
        LibrusSredniaOcenSensor(coordinator, entry),
        LibrusSredniaPrzedmiotuSensor(coordinator, subject, entry),
        LibrusPrzedmiotSensor(coordinator, subject, entry),
    )


async def test_srednie_z_poprawa_i_waga(coordinator, mock_client):
    from custom_components.librus_apix.oceny import srednia_wazona
    mock_client.async_get_grades.return_value = [
        _ocena("Fizyka", "2", weight=3, superseded=True),
        _ocena("Fizyka", "4", weight=3, improvement=True),
        _ocena("Fizyka", "5", weight=1),
        _ocena("Fizyka", "1", weight=2, counts=False),
    ]
    result = await coordinator._async_update_data()
    oceny = result["oceny_wg_przedmiotu"]["Fizyka"]
    assert [o["zastapiona"] for o in oceny] == [True, False, False, False]
    assert [o["waga"] for o in oceny] == [3, 3, 1, 2]
    assert oceny[1]["poprawa"] is True
    assert oceny[3]["licz_do_sredniej"] is False
    assert oceny[0]["skala"] == "1-6"
    oczekiwana = srednia_wazona(oceny)
    assert oczekiwana == pytest.approx(4.25)
    coordinator.data = result
    ogolna, przedmiotu, przedmiot = _sensory(coordinator, "Fizyka")
    assert przedmiotu.native_value == oczekiwana
    assert ogolna.native_value == oczekiwana
    assert przedmiot.extra_state_attributes["srednia"] == oczekiwana


async def test_semestr_biezacy_z_klienta(coordinator, mock_client):
    mock_client.biezacy_semestr = 2
    result = await coordinator._async_update_data()
    assert result["semestr_biezacy"] == 2


async def test_cache_bez_nowych_pol(coordinator, mock_client):
    mock_client.async_get_grades.return_value = None
    coordinator.data = {"oceny": [{
        "subject": "Fizyka", "grade": "4", "date": "2025-10-01",
        "category": "Kartkowka", "teacher": "Anna Nowak",
    }]}
    result = await coordinator._async_update_data()
    oceny = result["oceny_wg_przedmiotu"]["Fizyka"]
    assert oceny[0]["waga"] == 1 and oceny[0]["licz_do_sredniej"] is True
    assert oceny[0]["zastapiona"] is False and oceny[0]["skala"] is None
    coordinator.data = result
    _, przedmiotu, _ = _sensory(coordinator, "Fizyka")
    assert przedmiotu.native_value == 4.0


async def test_srednia_procentowa_z_ocen_punktowych(coordinator, mock_client):
    """Oceny punktowe nie wchodza do sredniej wazonej, tylko do procentowej."""
    punkty = dict(type="points", scale=None, weight=None)
    mock_client.async_get_grades.return_value = [
        _ocena("Fizyka", "16", max_points=20, percent=80.0, **punkty),
        _ocena("Fizyka", "6", max_points=10, percent=60.0, **punkty),
    ]
    coordinator.data = await coordinator._async_update_data()
    oceny = coordinator.data["oceny_wg_przedmiotu"]["Fizyka"]
    assert {o["skala"] for o in oceny} == {"punkty"}
    ogolna, przedmiotu, przedmiot = _sensory(coordinator, "Fizyka")
    for s in (ogolna, przedmiotu, przedmiot):
        assert s.extra_state_attributes["srednia_procentowa"] == 70.0
    assert przedmiotu.native_value is None
    assert ogolna.native_value is None


def _klient_ocen():
    client = LibrusApiClient("u", "p")
    client._client = MagicMock()
    client._token = "t"
    client._client.post.return_value.text = '<html><table><tr class="line0"><td>x</td></tr></table></html>'
    return client


async def _pobierz_oceny(numeric):
    client = _klient_ocen()
    with patch("librus_apix.grades._extract_grades_numeric", return_value=(numeric, {})), \
         patch("librus_apix.grades._extract_grades_descriptive", return_value=[{}, {}]), \
         patch("custom_components.librus_apix._parse_point_grades", return_value=[]), \
         patch("custom_components.librus_apix._parse_behavior_grades", return_value=None):
        return client, await client.async_get_grades()


async def test_klient_oznacza_poprawe_i_semestr():
    def g(grade, desc="", weight=1, sem=2):
        return NS(grade=grade, counts=True, date="2025-10-01", href="x", desc=desc,
                  semester=sem, category="Sprawdzian", teacher="Anna Nowak", weight=weight)

    client, grades = await _pobierz_oceny(
        [{}, {"Fizyka": [g("2", weight=3), g("4", "Poprawa oceny: 2", weight=3)]}])
    assert client.biezacy_semestr == 2
    assert [x["superseded"] for x in grades] == [True, False]
    assert [x["improvement"] for x in grades] == [False, True]
    assert grades[0]["weight"] == 3 and grades[0]["scale"] == "1-6"


async def test_licz_do_sredniej_z_opisu():
    def g(grade, desc, counts):
        return NS(grade=grade, counts=counts, date="2025-10-01", href="x", desc=desc,
                  semester=2, category="Sprawdzian", teacher="Anna Nowak", weight=1)

    _, grades = await _pobierz_oceny([{}, {"Fizyka": [
        g("4", "Kategoria: Sprawdzian", False),
        g("3", "Licz do średniej: tak", True),
        g("2", "Licz do średniej: nie", False),
    ]}])
    assert [x["counts"] for x in grades] == [True, True, False]


# --- Liczba wiadomosci ---


def _wiadomosc(i):
    return {"author": f"Autor {i}", "title": f"Temat {i}", "date": "2026-01-01", "href": f"/w/{i}"}


@pytest.mark.parametrize("opcje, liczba", [
    ({}, 10),
    ({"fetch_messages_count": 7}, 7),
    ({"liczba_wiadomosci": 5}, 5),
    ({"fetch_messages_count": 7, "liczba_wiadomosci": 5}, 7),
])
async def test_liczba_wiadomosci_z_opcji(coordinator, mock_client, opcje, liczba):
    mock_client.options = opcje
    await coordinator._async_update_data()
    mock_client.async_get_messages.assert_awaited_once_with(count=liczba)


# --- Nowe przedmioty bez przeladowania ---


async def _setup(hass, mock_client, entry_id):
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from custom_components.librus_apix.const import DOMAIN

    entry = MockConfigEntry(domain=DOMAIN, data={"username": "u", "password": "p"}, entry_id=entry_id)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def test_nowy_przedmiot_dodaje_encje(hass, mock_client):
    from homeassistant.helpers import entity_registry as er
    from custom_components.librus_apix.const import DOMAIN

    mock_client.biezacy_semestr = 1
    mock_client.async_get_grades.return_value = [_ocena("Fizyka", "5")]
    with patch("custom_components.librus_apix.LibrusApiClient", return_value=mock_client):
        await _setup(hass, mock_client, "entry_x")
        registry = er.async_get(hass)
        sred = lambda n: registry.async_get_entity_id("sensor", DOMAIN, f"entry_x_srednia_{n}")
        przed = lambda n: registry.async_get_entity_id("sensor", DOMAIN, f"entry_x_przedmiot_{n}")
        assert sred("fizyka") and przed("fizyka")
        assert sred("chemia") is None

        coordinator = mock_client.coordinator
        nowe = dict(coordinator.data)
        nowe["oceny_wg_przedmiotu"] = {
            **coordinator.data["oceny_wg_przedmiotu"],
            "Chemia": [{"ocena": "4", "data": "2025-10-02", "kategoria": "Kartkowka",
                        "nauczyciel": "Jan Kowalski", "semestr": 1, "waga": 1, "jest_nowa": False}],
        }
        coordinator.async_set_updated_data(nowe)
        await hass.async_block_till_done()
        assert sred("chemia") and przed("chemia")
        assert hass.states.get(sred("chemia")) is not None
        liczba = len(hass.states.async_entity_ids("sensor"))

        coordinator.async_set_updated_data(dict(nowe))
        await hass.async_block_till_done()
        assert len(hass.states.async_entity_ids("sensor")) == liczba


async def test_liczniki_frekwencji_rejestruja_entity_id(hass, mock_client):
    from homeassistant.helpers import entity_registry as er
    from custom_components.librus_apix.const import DOMAIN

    mock_client.biezacy_semestr = 1
    with patch("custom_components.librus_apix.LibrusApiClient", return_value=mock_client):
        await _setup(hass, mock_client, "entry_y")
        reg = er.async_get(hass)
        for k in ("nieobecnosci_nieusprawiedliwione", "nieobecnosci_usprawiedliwione",
                  "spoznienia", "zwolnienia"):
            assert reg.async_get_entity_id("sensor", DOMAIN, f"entry_y_{k}")


# --- Frekwencja biezacego semestru ---


def _fr(symbol, semestr, data="2026-02-10", przedmiot="Fizyka"):
    return {"symbol": symbol, "typ": "x", "data": data, "przedmiot": przedmiot,
            "nauczyciel": "Anna Wzorowa", "godzina": 2, "semestr": semestr, "wycieczka": False}


def _frekwencja_dane():
    return [
        _fr("nb", 1, "2025-10-01"), _fr("u", 1, "2025-10-02"), _fr("sp", 1, "2025-10-03"),
        _fr("nb", 2, "2026-02-10"), _fr("nb", 2, "2026-02-11"), _fr("u", 2, "2026-02-12"),
        _fr("sp", 2, "2026-02-13"), _fr("zw", 2, "2026-02-14"), _fr("ns", 2, "2026-02-15"),
        _fr("zw", 1, "2025-10-04"),
    ]


def _sensor_frekwencji(coordinator, klasa, dane, semestr=2, *args):
    coordinator.data = {"frekwencja": dane, "semestr_biezacy": semestr}
    return klasa(coordinator, _entry(), *args)


def test_liczniki_licza_biezacy_semestr(coordinator):
    from custom_components.librus_apix import sensor as s
    L, opisy = s.LibrusLicznikFrekwencjiSensor, s._LICZNIKI_FREKWENCJI
    nb, u, sp, zw = (_sensor_frekwencji(coordinator, L, _frekwencja_dane(), 2, *o) for o in opisy[:4])
    assert (nb.native_value, u.native_value, sp.native_value, zw.native_value) == (2, 1, 1, 1)
    assert nb.unique_id == "test_123_nieobecnosci_nieusprawiedliwione"
    assert u.unique_id == "test_123_nieobecnosci_usprawiedliwione"
    assert sp.unique_id == "test_123_spoznienia"
    assert zw.unique_id == "test_123_zwolnienia"
    wpisy = nb.extra_state_attributes["wpisy"]
    assert [w["data"] for w in wpisy] == ["2026-02-11", "2026-02-10"]
    assert set(wpisy[0]) == {"data", "przedmiot", "godzina", "nauczyciel"}


def test_frekwencja_biezacy_semestr(coordinator):
    from custom_components.librus_apix.sensor import LibrusFrekwencjaSensor
    f = _sensor_frekwencji(coordinator, LibrusFrekwencjaSensor, _frekwencja_dane())
    assert f.native_value == "3"
    a = f.extra_state_attributes
    assert a["liczba_nieobecnosci"] == 3
    assert a["liczba_spoznien"] == 1
    assert (a["liczba_nieusprawiedliwionych"], a["liczba_usprawiedliwionych"], a["liczba_zwolnien"]) == (2, 1, 1)


def test_frekwencja_semestr_1_i_brak_semestru(coordinator):
    from custom_components.librus_apix.sensor import (
        LibrusFrekwencjaSensor, LibrusLicznikFrekwencjiSensor, _LICZNIKI_FREKWENCJI,
    )
    f = _sensor_frekwencji(coordinator, LibrusFrekwencjaSensor, _frekwencja_dane(), 1)
    assert f.native_value == "2"
    stare = [_fr("nb", None), _fr("sp", None), _fr("nb", 2), _fr("nb", 1)]
    f = _sensor_frekwencji(coordinator, LibrusFrekwencjaSensor, stare, 2)
    assert f.native_value == "2"
    sp = _sensor_frekwencji(coordinator, LibrusLicznikFrekwencjiSensor, stare, 2, *_LICZNIKI_FREKWENCJI[2])
    assert sp.native_value == 1


def test_wpisy_porzadek_i_normalizacja_symbolu(coordinator):
    from custom_components.librus_apix.sensor import LibrusLicznikFrekwencjiSensor, _LICZNIKI_FREKWENCJI
    dane = [dict(_fr("NB ", 2), godzina=2), dict(_fr("nb", 2), godzina=5), dict(_fr("nb", 2), godzina=None)]
    nb = _sensor_frekwencji(coordinator, LibrusLicznikFrekwencjiSensor, dane, 2, *_LICZNIKI_FREKWENCJI[0])
    assert nb.native_value == 3
    assert [w["godzina"] for w in nb.extra_state_attributes["wpisy"]] == [5, 2, None]


def test_brak_danych_koordynatora_daje_zera(coordinator):
    from custom_components.librus_apix.sensor import LibrusLicznikFrekwencjiSensor, _LICZNIKI_FREKWENCJI
    coordinator.data = None
    for opis in _LICZNIKI_FREKWENCJI:
        e = LibrusLicznikFrekwencjiSensor(coordinator, _entry(), *opis)
        assert e.native_value == 0
        assert e.extra_state_attributes == {"wpisy": []}


async def test_procent_frekwencji_z_biezacego_semestru(coordinator, mock_client):
    mock_client.biezacy_semestr = 2
    mock_client.async_get_attendance_stats.return_value = [
        ("ob", 1), ("nb", 1), ("ob", 2), ("ob", 2), ("sp", 2), ("nb", 2),
    ]
    stat = (await coordinator._async_update_data())["frekwencja_stat"]
    assert stat["procent_semestr"] == 75.0
    assert stat["lekcji_w_semestrze"] == 4


async def test_klient_mapuje_semestr_i_wycieczke():
    class A:
        def __init__(self, sem, exc=False):
            self.symbol, self.type, self.date = "nb", "Nieobecnosc", "2026-02-10"
            self.subject, self.teacher, self.period = "Fizyka", "Anna Wzorowa", 3
            self.semester = sem
            self.excursion = exc

    async def pobierz(dane):
        client = LibrusApiClient("u", "p")
        client._client = MagicMock()
        client._token = "t"
        with patch("librus_apix.attendance.get_attendance", return_value=dane):
            return await client.async_get_attendance()

    # Dwa semestry: biblioteka odwraca liste, a.semester to licznik markerow (0/1)
    wynik = await pobierz([[A(1, False)], [A(0, True)]])
    assert [(w["semestr"], w["wycieczka"]) for w in wynik] == [(1, False), (2, True)]
    wynik = await pobierz([[A(0)], []])
    assert [w["semestr"] for w in wynik] == [1]


# --- Zdarzenia: wpisy zachowania i baza widzianych ---


def _zbierz(hass, *typy):
    zebrane = []
    for typ in typy:
        hass.bus.async_listen(typ, lambda e: zebrane.append((e.event_type, e.data)))
    return zebrane


def _wpis(komentarz="Pomaga kolegom", **kw):
    w = {"kategoria": "Pomoc koleżeńska", "punkty": 5, "typ": "pozytywny", "data": "2026-09-20",
         "nauczyciel": "Anna Wzorowa", "komentarz": komentarz, "okres": 1}
    w.update(kw)
    return w


def _zachowanie(*wpisy):
    return {"punkty_startowe": 100, "wpisy": list(wpisy)}


async def test_zdarzenie_nowego_wpisu_zachowania(hass, coordinator, mock_client):
    from custom_components.librus_apix.sensor import EVENT_NOWY_WPIS_ZACHOWANIA
    mock_client.async_get_student_information.return_value = _uczen("Jan Kowalski")
    zebrane = _zbierz(hass, EVENT_NOWY_WPIS_ZACHOWANIA)
    mock_client.async_get_behavior.return_value = _zachowanie(_wpis())
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert zebrane == []

    nowy = _wpis("Spóźnienie", typ="negatywny", punkty=-5, kategoria="Punktualność")
    mock_client.async_get_behavior.return_value = _zachowanie(_wpis(), nowy)
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert [d for _, d in zebrane] == [{"uczen": "Jan Kowalski", **nowy}]

    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert len(zebrane) == 1


def _ustaw_dane(mock_client, oceny, wiadomosci):
    mock_client.async_get_student_information.return_value = _uczen("Jan Kowalski")
    mock_client.async_get_grades.return_value = oceny
    mock_client.async_get_messages.return_value = wiadomosci


async def test_po_restarcie_zdarzenia_tylko_dla_nowych(hass, mock_client):
    """Cache z poprzedniego uruchomienia: zdarzenia tylko dla wpisow dodanych w przestoju."""
    from custom_components.librus_apix.sensor import EVENT_NOWA_OCENA, EVENT_NOWA_WIADOMOSC

    _ustaw_dane(mock_client, [_ocena("Fizyka", "4")], [_wiadomosc(1)])
    przed = LibrusDataUpdateCoordinator(hass, mock_client)
    cache = await przed._async_update_data()

    zebrane = _zbierz(hass, EVENT_NOWA_OCENA, EVENT_NOWA_WIADOMOSC)
    _ustaw_dane(mock_client, [_ocena("Fizyka", "4"), _ocena("Chemia", "5")], [_wiadomosc(1), _wiadomosc(2)])
    po = LibrusDataUpdateCoordinator(hass, mock_client)
    po.seed_seen_from_cached_data(cache)
    po.data = await po._async_update_data()
    await hass.async_block_till_done()

    assert sorted((t, d.get("przedmiot") or d.get("temat")) for t, d in zebrane) == [
        (EVENT_NOWA_OCENA, "Chemia"),
        (EVENT_NOWA_WIADOMOSC, "Temat 2"),
    ]


async def test_kategoria_pusta_w_cache_dostaje_baze_bez_zdarzen(hass, mock_client):
    """Kategoria pusta w cache (np. wtedy niepobrana) nie zalewa zdarzeniami po restarcie."""
    from custom_components.librus_apix.sensor import EVENT_NOWA_OCENA, EVENT_NOWA_WIADOMOSC

    _ustaw_dane(mock_client, [_ocena("Fizyka", "4")], None)
    przed = LibrusDataUpdateCoordinator(hass, mock_client)
    cache = await przed._async_update_data()
    assert cache["wiadomosci"] == []

    zebrane = _zbierz(hass, EVENT_NOWA_OCENA, EVENT_NOWA_WIADOMOSC)
    _ustaw_dane(mock_client, [_ocena("Fizyka", "4"), _ocena("Chemia", "5")], [_wiadomosc(1), _wiadomosc(2)])
    po = LibrusDataUpdateCoordinator(hass, mock_client)
    po.seed_seen_from_cached_data(cache)
    po.data = await po._async_update_data()
    await hass.async_block_till_done()
    assert [(t, d["przedmiot"]) for t, d in zebrane] == [(EVENT_NOWA_OCENA, "Chemia")]

    mock_client.async_get_messages.return_value = [_wiadomosc(1), _wiadomosc(2), _wiadomosc(3)]
    po.data = await po._async_update_data()
    await hass.async_block_till_done()
    typ, dane = zebrane[-1]
    assert typ == EVENT_NOWA_WIADOMOSC and dane["temat"] == "Temat 3"


async def test_niepobrana_kategoria_nie_zalewa_po_pierwszym_pobraniu(hass, coordinator, mock_client):
    """Gdy wiadomosci nie pobraly sie przy starcie, pierwsze udane pobranie to baza, nie zdarzenia."""
    from custom_components.librus_apix.sensor import EVENT_NOWA_WIADOMOSC

    zebrane = _zbierz(hass, EVENT_NOWA_WIADOMOSC)
    _ustaw_dane(mock_client, [], None)
    coordinator.data = await coordinator._async_update_data()
    mock_client.async_get_messages.return_value = [_wiadomosc(1), _wiadomosc(2)]
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert zebrane == []

    mock_client.async_get_messages.return_value = [_wiadomosc(1), _wiadomosc(2), _wiadomosc(3)]
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert [d["temat"] for _, d in zebrane] == ["Temat 3"]
