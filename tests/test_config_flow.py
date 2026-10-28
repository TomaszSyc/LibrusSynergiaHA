"""Options flow: liczba wiadomosci i przejscie ze starego klucza forka."""
import pytest
import voluptuous as vol
from homeassistant.data_entry_flow import InvalidData
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.librus_apix.const import DOMAIN


def _wpis(hass, options=None):
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={"username": "jan.test", "password": "haslo"},
        options=options or {},
    )
    entry.add_to_hass(hass)
    return entry


def _domyslna(result, klucz):
    return next(k for k in result["data_schema"].schema if k == klucz).default()


async def _zapisz(hass, entry, **opcje):
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], user_input=opcje)
    assert result["step_id"] == "ai"
    return await hass.config_entries.options.async_configure(result["flow_id"], user_input={})


async def test_liczba_wiadomosci_zakres(hass):
    entry = _wpis(hass)
    for zla in (0, 26):
        result = await hass.config_entries.options.async_init(entry.entry_id)
        with pytest.raises((InvalidData, vol.Invalid)):
            await hass.config_entries.options.async_configure(
                result["flow_id"], user_input={"fetch_messages_count": zla}
            )

    result = await _zapisz(hass, entry, fetch_messages_count=25)
    assert result["type"] == "create_entry"
    assert result["data"]["fetch_messages_count"] == 25


@pytest.mark.parametrize("opcje, domyslna", [
    ({}, 10),
    ({"liczba_wiadomosci": 7}, 7),
    ({"liczba_wiadomosci": 40}, 25),
])
async def test_stary_klucz_przechodzi_na_nowy(hass, opcje, domyslna):
    """Wpis z opcja forka "liczba_wiadomosci" dostaje ja jako domyslna, zapis usuwa stary klucz."""
    entry = _wpis(hass, opcje)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert _domyslna(result, "fetch_messages_count") == domyslna

    result = await _zapisz(hass, entry)
    assert result["data"]["fetch_messages_count"] == domyslna
    assert "liczba_wiadomosci" not in result["data"]
