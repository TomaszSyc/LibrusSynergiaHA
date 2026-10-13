"""Testy szybkiego startu integracji z cache oraz optymalizacji pobierania uwag."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from custom_components.librus_apix.sensor import (
    LibrusDataUpdateCoordinator,
    _student_info_to_dict,
    _student_info_from_dict,
)
from custom_components.librus_apix import _fetch_notes
from librus_apix.student_information import StudentInformation


@pytest.fixture
def mock_client():
    """Zwraca zamockowanego klienta LibrusApiClient."""
    client = MagicMock()
    client.username = "test_user"
    client.options = {}
    return client


def test_student_info_serialization_roundtrip():
    """Weryfikacja poprawnej konwersji StudentInformation do dict i z powrotem."""
    info = StudentInformation("Jan Kowalski", "4A", 12, "Pani Anna", "SP 1", 7)
    as_dict = _student_info_to_dict(info)
    assert as_dict == {
        "name": "Jan Kowalski",
        "class_name": "4A",
        "number": 12,
        "tutor": "Pani Anna",
        "school": "SP 1",
        "lucky_number": 7,
    }

    restored = _student_info_from_dict(as_dict)
    assert isinstance(restored, StudentInformation)
    assert restored.name == "Jan Kowalski"
    assert restored.class_name == "4A"
    assert restored.number == 12
    assert restored.tutor == "Pani Anna"
    assert restored.school == "SP 1"
    assert restored.lucky_number == 7


def test_student_info_from_dict_none_or_empty():
    """Weryfikacja odporności na puste dane."""
    assert _student_info_to_dict(None) is None
    assert _student_info_from_dict(None) is None
    assert _student_info_from_dict({}) is None


@pytest.mark.asyncio
async def test_async_load_cached_data_success(mock_client):
    """Weryfikacja wczytywania pełnego stanu z cache dyskowego."""
    coordinator = LibrusDataUpdateCoordinator(MagicMock(), mock_client)
    sample_cache = {
        "plan_lekcji": [{"data": "2026-10-14", "lekcje": []}],
        "oceny": [{"subject": "Matematyka", "grade": "5"}],
        "student_info": {
            "name": "Jan Kowalski",
            "class_name": "4A",
            "number": 12,
            "tutor": "Pani Anna",
            "school": "SP 1",
            "lucky_number": 7,
        },
    }
    coordinator.store = MagicMock()
    coordinator.store.async_load = AsyncMock(return_value=sample_cache)

    data = await coordinator.async_load_cached_data()
    assert data is not None
    assert "plan_lekcji" in data
    assert "oceny" in data
    assert isinstance(data["student_info"], StudentInformation)
    assert data["student_info"].name == "Jan Kowalski"


@pytest.mark.asyncio
async def test_async_load_cached_data_partial_returns_none(mock_client):
    """Jeśli w pliku jest tylko stary cache (np. sam plan lekcji), nie używamy go jako pełnego stanu."""
    coordinator = LibrusDataUpdateCoordinator(MagicMock(), mock_client)
    coordinator.store = MagicMock()
    coordinator.store.async_load = AsyncMock(return_value={"plan_lekcji": []})

    data = await coordinator.async_load_cached_data()
    assert data is None


@pytest.mark.asyncio
async def test_async_load_cached_data_error_handled(mock_client):
    """Błąd odczytu pliku cache nie rzuca wyjątku."""
    coordinator = LibrusDataUpdateCoordinator(MagicMock(), mock_client)
    coordinator.store = MagicMock()
    coordinator.store.async_load = AsyncMock(side_effect=OSError("Disk read failure"))

    data = await coordinator.async_load_cached_data()
    assert data is None


def test_seed_seen_from_cached_data(mock_client):
    """Zainicjalizowanie widzianych elementów zapobiega fałszywym powiadomieniom przy starcie."""
    coordinator = LibrusDataUpdateCoordinator(MagicMock(), mock_client)
    assert coordinator._first_run is True

    cached_data = {
        "wiadomosci": [{"href": "/wiadomosc/1"}],
        "oceny": [{"subject": "Historia", "date": "2026-10-10", "grade": "4"}],
        "zadania": [{"przedmiot": "Fizyka", "termin": "2026-10-15", "kategoria": "Zadanie"}],
        "terminarz": [{"data": "2026-10-16", "tytul": "Wycieczka", "przedmiot": "Wychowawcza"}],
        "tematy_lekcji": [{"data": "2026-10-10", "godzina": 1, "przedmiot": "Informatyka", "frekwencja": "nb"}],
        "uwagi": [{"id": 101}],
    }

    coordinator.seed_seen_from_cached_data(cached_data)

    assert coordinator._first_run is False
    assert "/wiadomosc/1" in coordinator._seen_message_hrefs
    assert ("Historia", "2026-10-10", "4") in coordinator._seen_grade_ids
    assert ("Fizyka", "2026-10-15", "Zadanie") in coordinator._seen_homework_ids
    assert ("2026-10-16", "Wycieczka", "Wychowawcza") in coordinator._seen_schedule_ids
    assert 101 in coordinator._seen_note_ids


def test_fetch_notes_caches_categories_and_users():
    """Weryfikacja buforowania kategorii i użytkowników w _fetch_notes."""
    client = MagicMock(spec=["BASE_URL", "cookies", "token", "get", "refresh_oauth", "_notice_categories_cache", "_notice_users_cache"])
    del client._notice_categories_cache
    del client._notice_users_cache
    client.BASE_URL = "https://synergia.librus.pl"
    client.cookies = MagicMock()
    client.token = MagicMock(oauth="test_oauth")

    notes_resp = MagicMock()
    notes_resp.status_code = 200
    notes_resp.json.return_value = {
        "Notes": [
            {
                "Id": 1,
                "CategoryId": 10,
                "Text": "Super uwaga",
                "Date": "2026-10-13",
                "Category": {"Id": 10},
                "Teacher": {"Id": 20},
            }
        ]
    }

    cat_resp = MagicMock()
    cat_resp.status_code = 200
    cat_resp.json.return_value = {
        "Categories": [{"Id": 10, "CategoryName": "Pochwała"}]
    }

    users_resp = MagicMock()
    users_resp.status_code = 200
    users_resp.json.return_value = {
        "Users": [{"Id": 20, "FirstName": "Jan", "LastName": "Nowak"}]
    }

    def _get_mock(url):
        if url.endswith("/Notes"):
            return notes_resp
        elif url.endswith("/Notes/Categories"):
            return cat_resp
        elif url.endswith("/Users"):
            return users_resp
        return MagicMock(status_code=200, json=lambda: {})

    client.get.side_effect = _get_mock

    # Pierwsze wywołanie - pobiera kategorie i użytkowników
    res1 = _fetch_notes(client)
    assert res1 is not None
    assert client._notice_categories_cache == {10: "Pochwała"}
    assert client._notice_users_cache == {20: "Nowak Jan"}
    assert res1[0]["kategoria"] == "Pochwała"
    assert res1[0]["nauczyciel"] == "Nowak Jan"

    # Drugie wywołanie - używa cache i NIE odpytuje ponownie o kategorie ani użytkowników
    client.get.reset_mock()
    client.get.return_value = notes_resp
    res2 = _fetch_notes(client)
    assert res2 is not None
    # Powinno być tylko 1 zapytanie: do Notes
    assert client.get.call_count == 1

