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
    client.options = {}
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
        LibrusSredniaOcenSensor, LibrusSredniaPrzedmiotuSensor, LibrusPrzedmiotSensor,
    )
    entry = MagicMock()
    entry.entry_id = "test_123"
    return (
        LibrusSredniaOcenSensor(coordinator, entry),
        LibrusSredniaPrzedmiotuSensor(coordinator, subject, entry),
        LibrusPrzedmiotSensor(coordinator, subject, entry),
    )


@pytest.mark.asyncio
async def test_srednie_z_poprawa_i_waga(coordinator, mock_client):
    from custom_components.librus_apix.oceny import srednia_wazona
    mock_client.async_get_student_information.return_value = None
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


@pytest.mark.asyncio
async def test_semestr_biezacy_z_klienta(coordinator, mock_client):
    mock_client.async_get_student_information.return_value = None
    mock_client.async_get_grades.return_value = []
    mock_client.biezacy_semestr = 2
    result = await coordinator._async_update_data()
    assert result["semestr_biezacy"] == 2


@pytest.mark.asyncio
async def test_cache_bez_nowych_pol(coordinator, mock_client):
    mock_client.async_get_student_information.return_value = None
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


@pytest.mark.asyncio
async def test_srednia_procentowa_atrybut(coordinator, mock_client):
    mock_client.async_get_student_information.return_value = None
    mock_client.async_get_grades.return_value = [
        _ocena("Fizyka", "80", scale="punkty"),
        _ocena("Fizyka", "60%", scale="punkty"),
    ]
    coordinator.data = await coordinator._async_update_data()
    ogolna, przedmiotu, przedmiot = _sensory(coordinator, "Fizyka")
    for s in (ogolna, przedmiotu, przedmiot):
        assert s.extra_state_attributes["srednia_procentowa"] == 70.0
    assert przedmiotu.native_value is None
    assert ogolna.native_value is None


@pytest.mark.asyncio
async def test_klient_oznacza_poprawe_i_semestr():
    from types import SimpleNamespace as NS
    from custom_components.librus_apix.__init__ import LibrusApiClient

    def g(grade, desc="", weight=1, sem=2):
        return NS(grade=grade, counts=True, date="2025-10-01", href="x", desc=desc,
                  semester=sem, category="Sprawdzian", teacher="Anna Nowak", weight=weight)

    numeric = [{}, {"Fizyka": [g("2", weight=3), g("4", "Poprawa oceny: 2", weight=3)]}]
    opisowe = [{}, {}]
    client = LibrusApiClient("u", "p")
    client._client = MagicMock()
    client._token = "t"
    with patch("librus_apix.grades.get_grades", return_value=(numeric, {}, opisowe)):
        grades = await client.async_get_grades()
    assert client.biezacy_semestr == 2
    assert [x["superseded"] for x in grades] == [True, False]
    assert [x["improvement"] for x in grades] == [False, True]
    assert grades[0]["weight"] == 3 and grades[0]["scale"] == "1-6"


@pytest.mark.asyncio
async def test_licz_do_sredniej_z_opisu():
    from types import SimpleNamespace as NS
    from custom_components.librus_apix.__init__ import LibrusApiClient

    def g(grade, desc, counts):
        return NS(grade=grade, counts=counts, date="2025-10-01", href="x", desc=desc,
                  semester=2, category="Sprawdzian", teacher="Anna Nowak", weight=1)

    numeric = [{}, {"Fizyka": [
        g("4", "Kategoria: Sprawdzian", False),
        g("3", "Licz do średniej: tak", True),
        g("2", "Licz do średniej: nie", False),
    ]}]
    client = LibrusApiClient("u", "p")
    client._client = MagicMock()
    client._token = "t"
    with patch("librus_apix.grades.get_grades", return_value=(numeric, {}, [{}, {}])):
        grades = await client.async_get_grades()
    assert [x["counts"] for x in grades] == [True, True, False]


@pytest.mark.parametrize("rodzaj", ["Pochwała", "pochwala", "Pozytywna"])
def test_pochwala_jest_pozytywna(rodzaj):
    from custom_components.librus_apix.sensor import _licz_rodzaj, POZYTYWNE, NEGATYWNE
    wpisy = [{"rodzaj": rodzaj}, {"rodzaj": "Nagana"}, {"rodzaj": "Negatywna"}]
    assert _licz_rodzaj(wpisy, POZYTYWNE) == 1
    assert _licz_rodzaj(wpisy, NEGATYWNE) == 2


@pytest.mark.asyncio
async def test_zablokowany_modul_uwag_daje_puste_dane(coordinator, mock_client):
    mock_client.async_get_grades.return_value = []
    mock_client.async_get_uwagi.return_value = ([], False)
    coordinator.data = None
    wynik = await coordinator._async_update_data()
    assert wynik["uwagi"] == []
    assert wynik["uwagi_nierozpoznane"] is False


def _ocena_api(przedmiot, ocena="5"):
    return {
        "subject": przedmiot,
        "grade": ocena,
        "date": "10.03.2025",
        "category": "Sprawdzian",
        "teacher": "Jan Kowalski",
        "weight": 1,
        "semester": 1,
    }


async def test_nowy_przedmiot_dodaje_encje(hass, mock_client):
    """Nowy przedmiot w danych dodaje encje bez przeladowania wpisu."""
    from homeassistant.helpers import entity_registry as er
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from custom_components.librus_apix.const import DOMAIN

    mock_client.biezacy_semestr = 1
    mock_client.async_get_student_information.return_value = None
    mock_client.async_get_grades.return_value = [_ocena_api("Fizyka")]
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"username": "u", "password": "p"},
        entry_id="entry_x",
    )
    entry.add_to_hass(hass)
    with patch("custom_components.librus_apix.LibrusApiClient", return_value=mock_client):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

        registry = er.async_get(hass)
        sred = lambda n: registry.async_get_entity_id("sensor", DOMAIN, f"entry_x_srednia_{n}")
        przed = lambda n: registry.async_get_entity_id("sensor", DOMAIN, f"entry_x_przedmiot_{n}")
        assert sred("fizyka") and przed("fizyka")
        assert sred("chemia") is None

        coordinator = mock_client.coordinator
        nowe = dict(coordinator.data)
        nowe["oceny_wg_przedmiotu"] = {
            **coordinator.data["oceny_wg_przedmiotu"],
            "Chemia": [{"ocena": "4", "data": "11.03.2025", "kategoria": "Kartkowka",
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


@pytest.mark.asyncio
async def test_wiadomosci_wg_opcji(hass, coordinator, mock_client):
    """Opcja liczby wiadomosci trafia do klienta i do atrybutu sensora."""
    from custom_components.librus_apix.sensor import LibrusWiadomosciSensor

    mock_client.options = {"liczba_wiadomosci": 7}
    mock_client.async_get_grades.return_value = []
    student_info = MagicMock()
    student_info.name = "Jan Kowalski"
    mock_client.async_get_student_information.return_value = student_info
    mock_client.async_get_messages.return_value = [
        {"author": f"Autor {i}", "title": f"Temat {i}", "date": "2026-01-01", "href": f"/w/{i}"}
        for i in range(9)
    ]
    coordinator.data = None

    coordinator.data = await coordinator._async_update_data()

    mock_client.async_get_messages.assert_awaited_once_with(count=7)
    entry = MagicMock()
    entry.entry_id = "test_123"
    attrs = LibrusWiadomosciSensor(coordinator, entry).extra_state_attributes
    assert len(attrs["wiadomosci"]) == 7
    assert attrs["wiadomosci"][6]["temat"] == "Temat 6"


@pytest.mark.asyncio
async def test_wiadomosci_domyslna_liczba(hass, coordinator, mock_client):
    """Bez opcji pobieramy 10 wiadomosci."""
    mock_client.async_get_grades.return_value = []
    mock_client.async_get_student_information.return_value = MagicMock()
    coordinator.data = None
    await coordinator._async_update_data()
    mock_client.async_get_messages.assert_awaited_once_with(count=10)


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
