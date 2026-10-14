"""Testy B1-B4: atrybuty poza historia, async_fire, strefa czasowa, logi bez spamu."""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.core import HomeAssistant

from custom_components.librus_apix import LibrusApiClient
from custom_components.librus_apix import calendar as librus_calendar
from custom_components.librus_apix import sensor as s
from custom_components.librus_apix.sensor import LibrusDataUpdateCoordinator

from test_init import mock_config_entry, mock_librus_client  # noqa: F401
from test_start_i_zapis import CACHE

# --- B1: duze listy w atrybutach nie trafiaja do historii (recorder) ---

DANE = {
    "student_info": None,
    "oceny": [{"subject": "Matematyka"}],
    "oceny_wg_przedmiotu": {"Matematyka": [{"ocena": "5", "data": "2026-10-01", "jest_nowa": False}]},
    "wiadomosci": [{"author": "A", "title": "T", "date": "2026-10-01", "href": "/w/1"}],
    "zadania": [{"przedmiot": "Fizyka", "kategoria": "Zadanie", "termin": "2026-10-20"}],
    "terminarz": [{"data": "2026-10-20", "tytul": "Sprawdzian", "rodzaj": "sprawdzian"}],
    "plan_lekcji": [
        {"dzien_tygodnia": "Środa", "data": "2026-10-14", "lekcje": []},
        {"dzien_tygodnia": "Czwartek", "data": "2026-10-15", "lekcje": []},
    ],
    "frekwencja": [{"symbol": "nb", "typ": "Nieobecność"}],
    "ogloszenia": [{"tytul": "Wywiadowka"}],
    "tematy_lekcji": [{"data": "2026-10-14", "numer": 1, "przedmiot": "WF", "obecnosc": "nb"}],
    "uwagi": [{"id": 1, "data": "2026-10-14", "rodzaj": "pozytywna"}],
    "zachowanie": {"wpisy": [{"kategoria": "Pomoc", "typ": "pozytywny"}]},
    "frekwencja_stat": None,
    "semestr_biezacy": 1,
}

NIEZAPISYWANE = {
    s.LibrusOcenySensor: {"oceny_wg_przedmiotu"},
    s.LibrusTerminarzSensor: {"zdarzenia"},
    s.LibrusZadaniaSensor: {"zadania"},
    s.LibrusWiadomosciSensor: {"wiadomosci"},
    s.LibrusPlanLekcjiSensor: {
        "kolejne_7_dni", "dzisiaj", "jutro", "poniedzialek", "wtorek", "sroda",
        "czwartek", "piatek", "sobota", "niedziela",
    },
    s.LibrusFrekwencjaSensor: {"lista_wpisow"},
    s.LibrusTematyLekcjiSensor: {"lekcje", "dzisiaj", "lekcje_ostatniego_dnia", "nieobecnosci"},
    s.LibrusUwagiSensor: {"uwagi"},
    s.LibrusZachowanieSensor: {"wpisy"},
    s.LibrusOgloszeniaSensor: {"lista_ogloszen"},
}


@pytest.mark.parametrize("klasa,klucze", list(NIEZAPISYWANE.items()), ids=lambda x: getattr(x, "__name__", ""))
def test_duze_atrybuty_poza_historia(klasa, klucze):
    """Klucze sa wylaczone z recordera i nadal wystepuja w atrybutach (bez literowek)."""
    coord = MagicMock()
    coord.data = DANE
    entry = MagicMock()
    entry.entry_id = "e1"
    encja = klasa(coord, entry)
    assert klucze <= klasa._unrecorded_attributes
    assert klucze <= set(encja.extra_state_attributes)


def test_przedmiot_oceny_poza_historia():
    coord = MagicMock()
    coord.data = DANE
    entry = MagicMock()
    entry.entry_id = "e1"
    encja = s.LibrusPrzedmiotSensor(coord, "Matematyka", entry)
    assert "oceny" in s.LibrusPrzedmiotSensor._unrecorded_attributes
    assert "oceny" in encja.extra_state_attributes


@pytest.mark.parametrize("klasa", [s.LibrusAISummarySensor, s.LibrusAIMessagesSummarySensor])
def test_ai_pelny_tekst_poza_historia(klasa):
    assert "pełny_tekst" in klasa._unrecorded_attributes


def test_liczniki_nadal_zapisywane():
    """Male atrybuty (liczniki, procenty) zostaja w historii - do wykresow."""
    assert "liczba_ocen" not in s.LibrusOcenySensor._unrecorded_attributes
    assert "frekwencja_procent" not in s.LibrusFrekwencjaSensor._unrecorded_attributes
    assert "srednia" not in s.LibrusPrzedmiotSensor._unrecorded_attributes


# --- B2: zdarzenia wysylane przez async_fire (jestesmy w petli zdarzen) ---


def test_zdarzenia_przez_async_fire():
    client = MagicMock()
    client.username = "u"
    client.options = {}
    coord = LibrusDataUpdateCoordinator(MagicMock(), client)
    coord.hass = MagicMock()
    coord._fire_events(
        [{"href": "/w/1", "title": "T"}],
        [{"subject": "M", "date": "2026-10-14", "grade": "5", "category": "", "teacher": ""}],
        "Jan",
    )
    coord._fire_homework_events(
        [{"przedmiot": "F", "termin": "2026-10-20", "kategoria": "Z", "nauczyciel": ""}], "Jan"
    )
    coord._fire_schedule_events(
        [{"data": "2026-10-20", "tytul": "S", "przedmiot": "M", "godzina": ""}], "Jan"
    )
    coord._fire_absence_events([{"data": "2026-10-14", "numer": 1, "przedmiot": "WF", "obecnosc": "nb"}], "Jan")
    coord._fire_note_events(
        [{"id": 1, "data": "2026-10-14", "rodzaj": "pozytywna", "kategoria": "", "nauczyciel": "", "tresc": ""}],
        "Jan",
    )
    assert coord.hass.bus.async_fire.call_count == 6
    coord.hass.bus.fire.assert_not_called()


# --- B3: strefa czasowa ladowana raz, przy imporcie modulu ---


def test_kalendarz_bez_tworzenia_strefy_w_petli():
    coord = MagicMock()
    coord.data = {
        "plan_lekcji": [{"data": "2026-10-14", "lekcje": [
            {"przedmiot": "WF", "godzina_od": "08:00", "godzina_do": "08:45", "data": "2026-10-14"},
        ]}],
        "terminarz": [{"data": "2026-10-20", "tytul": "Sprawdzian", "przedmiot": "M"}],
    }
    entry = MagicMock()
    entry.entry_id = "e1"
    encje = [
        klasa(coord, entry)
        for klasa in (librus_calendar.LibrusTimetableCalendar, librus_calendar.LibrusScheduleCalendar)
    ]
    with patch.object(librus_calendar.zoneinfo, "ZoneInfo", side_effect=AssertionError("ZoneInfo w petli")):
        for encja in encje:
            assert encja._get_events()
            encja.event  # noqa: B018


# --- B4: logi bledow bez tracebacku (chyba ze wlaczony debug) ---


def _klient_z_bledem():
    client = LibrusApiClient("test_user", "test_pass")
    client._client = MagicMock()
    client._token = "token"
    return client


async def test_blad_bez_tracebacku_w_logu(caplog):
    client = _klient_z_bledem()
    with caplog.at_level(logging.INFO, logger="custom_components.librus_apix"), \
         patch("librus_apix.homework.get_homework", side_effect=RuntimeError("Librus nie odpowiada")):
        assert await client.async_get_homework() is None
    bledy = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(bledy) == 1
    assert "Librus nie odpowiada" in bledy[0].getMessage()
    assert not bledy[0].exc_info
    assert "Traceback" not in bledy[0].getMessage()


async def test_blad_z_tracebackiem_przy_debug(caplog):
    client = _klient_z_bledem()
    with caplog.at_level(logging.DEBUG, logger="custom_components.librus_apix"), \
         patch("librus_apix.homework.get_homework", side_effect=RuntimeError("Librus nie odpowiada")):
        assert await client.async_get_homework() is None
    bledy = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(bledy) == 1
    assert bledy[0].exc_info is not None


async def test_blad_logowania_bez_tracebacku(caplog):
    client = LibrusApiClient("test_user", "test_pass")
    lib = MagicMock()
    lib.get_token.side_effect = RuntimeError("brak sieci")
    with caplog.at_level(logging.INFO, logger="custom_components.librus_apix"), \
         patch("custom_components.librus_apix.new_client", return_value=lib):
        assert await client.async_authenticate() is False
    bledy = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert len(bledy) == 1
    assert not bledy[0].exc_info
    assert "brak sieci" in bledy[0].getMessage()


# --- Ochrona przed update_interval = None ---


async def test_start_gdy_update_interval_none(
    hass: HomeAssistant, mock_config_entry, mock_librus_client  # noqa: F811
):
    """Bez interwalu (odpytywanie wylaczone) start nie wywala sie i odswieza od razu."""
    with patch("custom_components.librus_apix.LibrusApiClient", return_value=mock_librus_client), \
         patch.object(LibrusDataUpdateCoordinator, "_interwal_odpytywania", return_value=None), \
         patch.object(LibrusDataUpdateCoordinator, "async_load_cached_data",
                      AsyncMock(return_value=dict(CACHE))), \
         patch.object(LibrusDataUpdateCoordinator, "wiek_cache", return_value=300):
        assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()
    mock_librus_client.async_get_grades.assert_awaited()
