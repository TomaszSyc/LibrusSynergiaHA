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
