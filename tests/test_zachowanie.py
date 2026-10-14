"""Testy parsowania ocen i punktów z zachowania oraz sensora LibrusZachowanieSensor."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from custom_components.librus_apix import LibrusApiClient, _parse_behavior_grades
from custom_components.librus_apix.sensor import (
    LibrusDataUpdateCoordinator,
    LibrusZachowanieSensor,
)

SAMPLE_BEHAVIOR_HTML = """
<tr class="bolded line1">
    <td class="center micro screen-only">
        <img src="/images/tree_colapsed.png" id="przedmioty_zachowanie_node"
             onclick="showHide.ShowHide('zachowanie');" />
    </td>
    <td>
        Zachowanie
    </td>
    <td colspan="2">
        <span class="tooltip" style="cursor: pointer;" title="Punkty startowe">
            240
        </span>
        <span class="grade-box negative-behaviour"><a title="Agresywne zachowanie(-20)<br/>Zakres od: -20<br/>Zakres do: -20<br />Data wystawienia: 2026-09-21<br />Dodał: NAUCZYCIEL1<br>Komentarz: Zły wpływ na innych" href="/przegladaj_oceny/zachowanie_szczegoly/25302">-20</a></span>
        <span class="grade-box negative-behaviour"><a title="Aroganckie odzywanie się do nauczyciela(-10)<br/>Zakres od: -10<br/>Zakres do: -10<br />Data wystawienia: 2026-09-22<br />Dodał: NAUCZYCIEL1<br>Komentarz: Brak szacunku" href="/przegladaj_oceny/zachowanie_szczegoly/27401">-10</a></span>
        <span class="grade-box positive-behaviour"><a title="Akcje charytatywne(5)<br/>Zakres od: 5<br/>Zakres do: 5<br />Data wystawienia: 2026-10-08<br />Dodał: NAUCZYCIEL2<br>Komentarz: Zbiórka karmy" href="/przegladaj_oceny/zachowanie_szczegoly/69296">5</a></span>
    </td>
    <td class="center">
        -
    </td>
    <td colspan="2">
        <span class="tooltip" style="cursor: pointer;" title="Punkty startowe">
            240
        </span>
    </td>
    <td class="center" colspan="3">
        -
    </td>
</tr>
<tr class="line0" name="przedmioty_all" id="przedmioty_zachowanie" style="display: none; visibility: hidden;">
    <td>&nbsp;</td>
    <td colspan="14">
        <table class="stretch">
            <thead>
                <tr>
                    <td>Kategoria</td>
                    <td>Komentarz</td>
                    <td>Oceny</td>
                    <td>Data wystawienia</td>
                    <td>Dodał</td>
                </tr>
            </thead>
            <tr class="line0 bolded"><td colspan="5" class="center">Okres 1</td></tr>
            <tr class="line1"><td>Agresywne zachowanie</td><td class="center"><a title="Komentarz oceny" href="javascript:void(0);">K</a></td><td class="right">-20</td><td class="center">2026-09-21</td><td>NAUCZYCIEL1</td></tr>
            <tr class="line0">
                <td colspan="2" class="right">Punkty startowe</td>
                <td class="right">240</td>
                <td class="right" colspan="2">&nbsp;</td>
            </tr>
            <tr class="line1">
                <td colspan="2" class="right"><strong>Suma</strong></td>
                <td class="right"><strong>215</strong></td>
                <td colspan="2">&nbsp;</td>
            </tr>
            <tr class="line0"><td colspan="2">&nbsp;</td><td>&nbsp;</td><td colspan="3">Ocena śródroczna przewidywana wystawiona przez nauczyciela: poprawne</td></tr>
            <tr class="line1 bolded"><td colspan="5" class="center">Okres 2</td></tr>
            <tr class="line0"><td colspan="5" class="center">Brak ocen</td></tr>
            <tr class="line1"><td colspan="2" class="right">Punkty startowe</td><td class="right">240</td><td colspan="2">&nbsp;</td></tr>
            <tr class="line1"><td colspan="2" class="right"><strong>Suma</strong></td><td class="right"><strong>240</strong></td><td colspan="2">&nbsp;</td></tr>
            <tr class="line1"><td colspan="2">&nbsp;</td><td>&nbsp;</td><td colspan="3">Ocena roczna przewidywana wystawiona przez nauczyciela: wzorowe</td></tr>
        </table>
    </td>
</tr>
"""


def test_parse_behavior_grades_from_html():
    """Test prawidłowego wyciągania punktów i wpisów zachowania z HTML."""
    res = _parse_behavior_grades(SAMPLE_BEHAVIOR_HTML)
    assert res is not None
    assert res["punkty_startowe"] == 240
    assert res["suma_okres_1"] == 215
    assert res["suma_okres_2"] == 240
    assert res["ocena_przewidywana_okres_1"] == "poprawne"
    assert res["ocena_przewidywana_okres_2"] == "wzorowe"
    assert len(res["wpisy"]) == 3

    # Wpisy powinny być posortowane malejąco po dacie
    assert res["wpisy"][0]["data"] == "2026-10-08"
    assert res["wpisy"][0]["kategoria"] == "Akcje charytatywne"
    assert res["wpisy"][0]["punkty"] == 5
    assert res["wpisy"][0]["typ"] == "pozytywny"
    assert res["wpisy"][0]["komentarz"] == "Zbiórka karmy"

    assert res["wpisy"][1]["data"] == "2026-09-22"
    assert res["wpisy"][1]["punkty"] == -10
    assert res["wpisy"][1]["typ"] == "negatywny"


def test_parse_behavior_grades_brak_danych():
    """Gdy w HTML nie ma wiersza ani tabeli zachowania, parser zwraca None."""
    html = "<table><tr><td>Matematyka</td><td>5</td></tr></table>"
    assert _parse_behavior_grades(html) is None


async def test_sensor_zachowanie_punkty_i_atrybuty(hass):
    """Test sensora LibrusZachowanieSensor wystawiającego sumę punktów i atrybuty."""
    coordinator = MagicMock()
    coordinator.data = {
        "semestr_biezacy": 1,
        "zachowanie": {
            "punkty_startowe": 240,
            "suma_okres_1": 215,
            "suma_okres_2": 240,
            "ocena_przewidywana_okres_1": "poprawne",
            "ocena_przewidywana_okres_2": "wzorowe",
            "ocena_srodroczna": "",
            "ocena_roczna": "",
            "wpisy": [
                {
                    "kategoria": "Akcje charytatywne",
                    "punkty": 5,
                    "typ": "pozytywny",
                    "data": "2026-10-08",
                    "nauczyciel": "Nauczyciel",
                    "komentarz": "Zbiórka",
                    "okres": 1,
                },
                {
                    "kategoria": "Agresywne zachowanie",
                    "punkty": -20,
                    "typ": "negatywny",
                    "data": "2026-09-21",
                    "nauczyciel": "Nauczyciel",
                    "komentarz": "Incydent",
                    "okres": 1,
                },
            ],
        },
    }
    entry = MagicMock(entry_id="test_entry", options={})
    sensor = LibrusZachowanieSensor(coordinator, entry)

    assert sensor.native_value == 215
    attrs = sensor.extra_state_attributes
    assert attrs["punkty_startowe"] == 240
    assert attrs["suma_okres_1"] == 215
    assert attrs["ocena_przewidywana_okres_1"] == "poprawne"
    assert attrs["liczba_wpisow_pozytywnych"] == 1
    assert attrs["liczba_wpisow_negatywnych"] == 1
    assert attrs["ostatni_wpis"]["kategoria"] == "Akcje charytatywne"


async def test_sensor_zachowanie_brak_danych(hass):
    """Gdy konto nie posiada modułu zachowania, sensor zwraca 'Brak'."""
    coordinator = MagicMock()
    coordinator.data = {"semestr_biezacy": 1, "zachowanie": None}
    entry = MagicMock(entry_id="test_entry", options={})
    sensor = LibrusZachowanieSensor(coordinator, entry)

    assert sensor.native_value == "Brak"
    attrs = sensor.extra_state_attributes
    assert attrs["punkty_startowe"] is None
    assert attrs["wpisy"] == []


async def test_client_async_get_behavior(hass):
    """Test metody async_get_behavior w LibrusApiClient zwracającej zbuforowane dane."""
    client = LibrusApiClient("test_user", "test_pass", {}, hass=hass)
    mock_data = {"punkty_startowe": 240, "suma_okres_1": 220}
    client._behavior_data = mock_data

    res = await client.async_get_behavior()
    assert res == mock_data
