import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from homeassistant.helpers.update_coordinator import UpdateFailed

from custom_components.librus_apix.sensor import LibrusDataUpdateCoordinator
from custom_components.librus_apix.__init__ import LibrusApiClient

PUSTE_ZACHOWANIE = {
    "okres_1": {"ocena": None, "propozycja": False},
    "okres_2": {"ocena": None, "propozycja": False},
    "roczna": {"ocena": None, "propozycja": False},
    "wpisy": [],
}


def _uwaga(i, rodzaj="Negatywna"):
    return {
        "data": "2026-09-1%d" % i,
        "nauczyciel": "Anna Wzorowa",
        "rodzaj": rodzaj,
        "kategoria": "Zachowanie na lekcji",
        "tresc": "Fikcyjna uwaga %d" % i,
        "id": "u%d" % i,
    }


def _wpis(komentarz="Pomagal kolegom"):
    return {
        "okres": "okres_1",
        "ocena": "bardzo dobre",
        "rodzaj": "Pozytywny",
        "data": "2026-09-20",
        "nauczyciel": "Anna Wzorowa",
        "komentarz": komentarz,
    }


def _zachowanie(**kw):
    d = {k: dict(v) if isinstance(v, dict) else list(v) for k, v in PUSTE_ZACHOWANIE.items()}
    d.update(kw)
    return d


def _entry():
    e = MagicMock()
    e.entry_id = "test_123"
    return e


@pytest.fixture
def mock_client():
    client = MagicMock(spec=LibrusApiClient)
    client.async_authenticate = AsyncMock(return_value=True)
    client.async_get_student_information = AsyncMock()
    client.async_get_grades = AsyncMock()
    client.async_get_messages = AsyncMock(return_value=[])
    client.async_get_homework = AsyncMock(return_value=[])
    client.async_get_schedule = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=[])
    client.async_get_attendance = AsyncMock(return_value=[])
    client.async_get_announcements = AsyncMock(return_value=[])
    client.async_get_uwagi = AsyncMock(return_value=([], False))
    client.async_get_zachowanie = AsyncMock(return_value=dict(PUSTE_ZACHOWANIE))
    return client

@pytest.fixture
def coordinator(hass, mock_client):
    # Dummy config entry
    config_entry = MagicMock()
    config_entry.entry_id = "test_123"
    
    # Utworz koordynator
    coord = LibrusDataUpdateCoordinator(hass, mock_client)
    return coord

@pytest.mark.asyncio
async def test_update_missing_grades(coordinator, mock_client):
    """Test czy pobranie None przy ocenach nie blokuje aktualizacji gdy cache jest puste."""
    
    # Mock zwrocenia None dla ocen (np. konto przedszkolaka)
    mock_client.async_get_grades.return_value = None
    
    # Mock student info
    student_info = MagicMock()
    student_info.name = "Jan Kowalski"
    student_info.class_name = "1A"
    mock_client.async_get_student_information.return_value = student_info
    
    # Upewnijmy sie ze koordynator ma puste dane
    coordinator.data = None
    
    # Zamiast wyrzucac wyjatek, powinno zwrocic puste tablice z fallbacku
    result = await coordinator._async_update_data()
    
    # Oceny powinny być pustą listą a nie rzucać UpdateFailed
    assert result["oceny"] == []
    assert result["student_info"].name == "Jan Kowalski"

@pytest.mark.asyncio
async def test_student_info_getattr_fix(coordinator, mock_client):
    """Test upewniajacy sie ze zabezpieczony dostep przez getattr nie rzuca wyjatkiem."""
    
    # Normalne oceny
    mock_client.async_get_grades.return_value = []
    
    # Symulujemy zwrocenie obiektu StudentInformation przez APIX
    class FakeStudentInformation:
        def __init__(self, name):
            self.name = name
            self.class_name = "2B"
    
    student_info = FakeStudentInformation("Piotr Nowak")
    mock_client.async_get_student_information.return_value = student_info
    
    result = await coordinator._async_update_data()
    
    assert result["student_info"].name == "Piotr Nowak"
    # To potwierdza ze wywolania getattr(student_info, 'name') wewnatrz integracji nie zglosza AttributeError


@pytest.mark.asyncio
async def test_uwagi_sensor(coordinator, mock_client):
    from custom_components.librus_apix.sensor import LibrusUwagiSensor
    mock_client.async_get_grades.return_value = []
    mock_client.async_get_uwagi.return_value = (
        [_uwaga(1), _uwaga(2, "Pozytywna"), _uwaga(3, "negatywna")], True)
    coordinator.data = await coordinator._async_update_data()
    s = LibrusUwagiSensor(coordinator, _entry())
    assert s.unique_id == "test_123_uwagi"
    assert s.name == "Uwagi"
    assert s.native_value == 3
    a = s.extra_state_attributes
    assert a["pozytywne"] == 1
    assert a["negatywne"] == 2
    assert a["nierozpoznany_uklad"] is True
    assert len(a["uwagi"]) == 3


@pytest.mark.asyncio
async def test_zachowanie_sensor(coordinator, mock_client):
    from custom_components.librus_apix.sensor import LibrusZachowanieSensor
    mock_client.async_get_grades.return_value = []
    wpisy = [_wpis(), dict(_wpis(), rodzaj="Negatywny", komentarz="x")]
    mock_client.async_get_zachowanie.return_value = _zachowanie(
        okres_1={"ocena": "dobre", "propozycja": False},
        okres_2={"ocena": "bardzo dobre", "propozycja": True},
        wpisy=wpisy)
    coordinator.data = await coordinator._async_update_data()
    s = LibrusZachowanieSensor(coordinator, _entry())
    assert s.unique_id == "test_123_zachowanie"
    assert s.name == "Zachowanie"
    assert s.native_value == "bardzo dobre"
    a = s.extra_state_attributes
    assert a["okres_1"]["ocena"] == "dobre"
    assert a["roczna"]["ocena"] is None
    assert a["wpisy_pozytywne"] == 1
    assert a["wpisy_negatywne"] == 1
    assert len(a["wpisy"]) == 2

    mock_client.async_get_zachowanie.return_value = _zachowanie(
        okres_1={"ocena": "dobre", "propozycja": False},
        roczna={"ocena": "wzorowe", "propozycja": False})
    coordinator.data = await coordinator._async_update_data()
    assert s.native_value == "wzorowe"
    mock_client.async_get_zachowanie.return_value = _zachowanie()
    coordinator.data = await coordinator._async_update_data()
    assert s.native_value is None


@pytest.mark.asyncio
async def test_zdarzenie_nowej_uwagi(coordinator, mock_client, hass):
    from custom_components.librus_apix.sensor import EVENT_NOWA_UWAGA
    mock_client.async_get_grades.return_value = []
    zdarzenia = []
    hass.bus.async_listen(EVENT_NOWA_UWAGA, lambda e: zdarzenia.append(e.data))
    mock_client.async_get_uwagi.return_value = ([_uwaga(1)], False)
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert zdarzenia == []

    mock_client.async_get_uwagi.return_value = ([_uwaga(1), _uwaga(2)], False)
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert len(zdarzenia) == 1
    assert zdarzenia[0] == {
        "data": "2026-09-12", "nauczyciel": "Anna Wzorowa",
        "rodzaj": "Negatywna", "kategoria": "Zachowanie na lekcji",
        "tresc": "Fikcyjna uwaga 2",
    }
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert len(zdarzenia) == 1


@pytest.mark.asyncio
async def test_zdarzenie_nowego_wpisu_zachowania(coordinator, mock_client, hass):
    from custom_components.librus_apix.sensor import EVENT_NOWY_WPIS_ZACHOWANIA
    mock_client.async_get_grades.return_value = []
    zdarzenia = []
    hass.bus.async_listen(EVENT_NOWY_WPIS_ZACHOWANIA, lambda e: zdarzenia.append(e.data))
    mock_client.async_get_zachowanie.return_value = _zachowanie(wpisy=[_wpis()])
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert zdarzenia == []

    mock_client.async_get_zachowanie.return_value = _zachowanie(
        wpisy=[_wpis(), _wpis("Inny komentarz")])
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert zdarzenia == [_wpis("Inny komentarz")]
    coordinator.data = await coordinator._async_update_data()
    await hass.async_block_till_done()
    assert len(zdarzenia) == 1


@pytest.mark.asyncio
async def test_none_z_klienta_zachowuje_cache(coordinator, mock_client):
    mock_client.async_get_grades.return_value = []
    mock_client.async_get_uwagi.return_value = ([_uwaga(1)], True)
    mock_client.async_get_zachowanie.return_value = _zachowanie(wpisy=[_wpis()])
    coordinator.data = await coordinator._async_update_data()
    mock_client.async_get_uwagi.return_value = None
    mock_client.async_get_zachowanie.return_value = None
    wynik = await coordinator._async_update_data()
    assert len(wynik["uwagi"]) == 1
    assert len(wynik["zachowanie"]["wpisy"]) == 1
    assert wynik["uwagi_nierozpoznane"] is True


@pytest.mark.asyncio
async def test_none_bez_cache_daje_puste(coordinator, mock_client):
    mock_client.async_get_grades.return_value = []
    mock_client.async_get_uwagi.return_value = None
    mock_client.async_get_zachowanie.return_value = None
    coordinator.data = None
    wynik = await coordinator._async_update_data()
    assert wynik["uwagi"] == []
    assert wynik["zachowanie"] == PUSTE_ZACHOWANIE
