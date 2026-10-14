"""Fuzja terminarza z planem lekcji: brak sztucznych lekcji dla nieobecności nauczyciela."""

from unittest.mock import AsyncMock, MagicMock

from custom_components.librus_apix.__init__ import LibrusApiClient
from custom_components.librus_apix.sensor import LibrusDataUpdateCoordinator


def _lekcja(nr, od, do):
    return {
        "przedmiot": "Matematyka", "nauczyciel_i_sala": "Kowalska Anna s. 12", "godzina_od": od,
        "godzina_do": do, "data": "2026-10-07", "numer": nr, "zdarzenie": None,
        "odwolana": False, "zastepstwo": False, "nauczyciel": "Kowalska Anna", "sala": "s. 12",
    }


def _wpis(tytul, nr, rodzaj, data="2026-10-07"):
    return {"data": data, "tydzien": "Środa", "tytul": tytul, "rodzaj": rodzaj, "przedmiot": "Historia",
            "godzina": "unknown", "numer_lekcji": nr, "szczegoly": {}, "href": ""}


async def test_bez_sztucznej_lekcji_dla_nieobecnosci_nauczyciela(hass):
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = {}
    for name in ("async_get_student_information", "async_get_grades", "async_get_messages", "async_get_homework",
                 "async_get_attendance", "async_get_announcements", "async_get_completed_lessons"):
        setattr(client, name, AsyncMock(return_value=[]))
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=[
        {"dzien_tygodnia": "Środa", "data": "2026-10-07",
         "lekcje": [_lekcja(1, "08:00", "08:45"), _lekcja(2, "08:55", "09:40")]},
    ])
    client.async_get_schedule = AsyncMock(return_value=[
        _wpis("Nauczyciel: Nowak Jan", "8", "nieobecnosc_nauczyciela"),
        _wpis("poprawa", "9", "wydarzenie"),
    ])
    data = await LibrusDataUpdateCoordinator(hass, client)._async_update_data()
    lekcje = data["plan_lekcji"][0]["lekcje"]
    assert [l["numer"] for l in lekcje] == [1, 2, 9]  # 8 (nieobecność nauczyciela) pominięta
    for l in lekcje:
        assert {"sala", "nauczyciel", "odwolana", "zastepstwo", "zdarzenie"} <= set(l)


async def test_dzien_wolny_czysci_lekcje(hass):
    """Dzień wolny z terminarza czyści lekcje w planie i ustawia pole dzien_wolny."""
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = {}
    for name in ("async_get_student_information", "async_get_grades", "async_get_messages", "async_get_homework",
                 "async_get_attendance", "async_get_announcements", "async_get_completed_lessons"):
        setattr(client, name, AsyncMock(return_value=[]))
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=[
        {"dzien_tygodnia": "Środa", "data": "2026-10-14",
         "lekcje": [_lekcja(1, "08:00", "08:45"), _lekcja(2, "08:55", "09:40")]},
        {"dzien_tygodnia": "Czwartek", "data": "2026-10-15",
         "lekcje": [_lekcja(1, "08:00", "08:45")]},
    ])
    client.async_get_schedule = AsyncMock(return_value=[
        _wpis("Święto Edukacji Narodowej", "unknown", "dzien_wolny", data="2026-10-14"),
    ])
    data = await LibrusDataUpdateCoordinator(hass, client)._async_update_data()
    plan = data["plan_lekcji"]
    # Środa (dzień wolny)
    assert plan[0]["lekcje"] == []
    assert plan[0]["dzien_wolny"] == "Święto Edukacji Narodowej"
    # Czwartek (zwykły dzień)
    assert len(plan[1]["lekcje"]) == 1
    assert plan[1]["dzien_wolny"] is None


async def test_fuzja_dopasowuje_do_wlasciwej_lekcji_bez_sztucznej_lekcji(hass):
    """Zdarzenie dla lekcji w środku dnia dopasowuje się do niej i nie tworzy sztucznej lekcji ??:??."""
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = {}
    for name in ("async_get_student_information", "async_get_grades", "async_get_messages", "async_get_homework",
                 "async_get_attendance", "async_get_announcements", "async_get_completed_lessons"):
        setattr(client, name, AsyncMock(return_value=[]))
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])

    lekcja1 = dict(_lekcja(1, "08:00", "08:45"), przedmiot="Biologia")
    lekcja2 = dict(_lekcja(2, "08:55", "09:40"), przedmiot="Język polski")
    lekcja3 = dict(_lekcja(3, "09:50", "10:35"), przedmiot="Religia")
    lekcja4 = dict(_lekcja(4, "10:45", "11:30"), przedmiot="Matematyka")
    lekcja5 = dict(_lekcja(5, "11:50", "12:35"), przedmiot="Muzyka")

    client.async_get_timetable = AsyncMock(return_value=[
        {"dzien_tygodnia": "Poniedziałek", "data": "2026-10-19",
         "lekcje": [lekcja1, lekcja2, lekcja3, lekcja4, lekcja5]},
    ])
    client.async_get_schedule = AsyncMock(return_value=[
        {"data": "2026-10-19", "tydzien": "Poniedziałek", "tytul": "Sprawdzian", "rodzaj": "sprawdzian",
         "przedmiot": "Język polski", "godzina": "unknown", "numer_lekcji": "2",
         "szczegoly": {"Opis": "Lektura"}, "href": ""},
        {"data": "2026-10-19", "tydzien": "Poniedziałek", "tytul": "Kartkówka", "rodzaj": "kartkowka",
         "przedmiot": "Matematyka", "godzina": "unknown", "numer_lekcji": "4",
         "szczegoly": {"Opis": "Ułamki"}, "href": ""},
    ])

    data = await LibrusDataUpdateCoordinator(hass, client)._async_update_data()
    lekcje = data["plan_lekcji"][0]["lekcje"]

    # Dokładnie 5 lekcji - ani jednej sztucznej lekcji ??:??
    assert len(lekcje) == 5
    assert not any(l.get("godzina_od") == "??:??" for l in lekcje)

    # Lekcja 2 (polski) ma przypisany Sprawdzian
    assert lekcje[1]["przedmiot"] == "Język polski"
    assert lekcje[1]["zdarzenie"] == "Sprawdzian"
    assert lekcje[1]["zdarzenie_opis"] == "Lektura"

    # Lekcja 4 (matematyka) ma przypisaną Kartkówkę
    assert lekcje[3]["przedmiot"] == "Matematyka"
    assert lekcje[3]["zdarzenie"] == "Kartkówka"
    assert lekcje[3]["zdarzenie_opis"] == "Ułamki"



def _klient_planu(plan, terminarz):
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = {}
    for name in ("async_get_student_information", "async_get_grades", "async_get_messages", "async_get_homework",
                 "async_get_attendance", "async_get_announcements", "async_get_completed_lessons"):
        setattr(client, name, AsyncMock(return_value=[]))
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=plan)
    client.async_get_schedule = AsyncMock(return_value=terminarz)
    return client


def _zdarzenie(data, tytul, nr):
    return {"data": data, "tydzien": "", "tytul": tytul, "rodzaj": "sprawdzian", "przedmiot": "Przyroda",
            "godzina": "unknown", "numer_lekcji": nr, "szczegoly": {}, "href": ""}


def _plan_piatek():
    return [{"dzien_tygodnia": "Piątek", "data": "2026-10-16",
             "lekcje": [dict(_lekcja(3, "09:50", "10:35"), przedmiot="Przyroda", data="2026-10-16")]}]


async def test_zdarzenie_spoza_planu_nie_nadpisuje_lekcji(hass):
    """#42: zdarzenie z daty spoza planu nie trafia do lekcji dopasowanej dla poprzedniego zdarzenia."""
    client = _klient_planu(_plan_piatek(), [
        _zdarzenie("2026-10-16", "Kartkówka", "3"),
        _zdarzenie("2026-11-13", "Sprawdzian", "3"),
    ])
    data = await LibrusDataUpdateCoordinator(hass, client)._async_update_data()
    lekcje = data["plan_lekcji"][0]["lekcje"]
    assert len(lekcje) == 1
    assert lekcje[0]["zdarzenie"] == "Kartkówka"


async def test_pierwsze_zdarzenie_spoza_planu_nie_psuje_odswiezania(hass):
    """Zdarzenie spoza planu na początku terminarza nie przerywa fuzji (UnboundLocalError)."""
    client = _klient_planu(_plan_piatek(), [
        _zdarzenie("2026-10-09", "Kartkówka", "3"),
        _zdarzenie("2026-10-16", "Sprawdzian", "3"),
    ])
    data = await LibrusDataUpdateCoordinator(hass, client)._async_update_data()
    lekcje = data["plan_lekcji"][0]["lekcje"]
    assert len(lekcje) == 1
    assert lekcje[0]["zdarzenie"] == "Sprawdzian"
