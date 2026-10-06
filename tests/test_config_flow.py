"""Testy options flow integracji Librus APIX."""
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


async def test_opcje_liczba_wiadomosci(hass):
    """Options flow przyjmuje 25, odrzuca 0 i 51."""
    entry = _wpis(hass)

    for zla in (0, 51):
        result = await hass.config_entries.options.async_init(entry.entry_id)
        with pytest.raises((InvalidData, vol.Invalid)):
            await hass.config_entries.options.async_configure(
                result["flow_id"], user_input={"liczba_wiadomosci": zla}
            )

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={"liczba_wiadomosci": 25}
    )
    assert result["type"] == "create_entry"
    assert result["data"]["liczba_wiadomosci"] == 25


async def test_opcje_domyslne_stary_wpis(hass):
    """Wpis bez opcji dostaje formularz z domyslna 10 i da sie go zapisac."""
    entry = _wpis(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] == "form"
    assert not result.get("errors")
    klucz = next(k for k in result["data_schema"].schema if k == "liczba_wiadomosci")
    assert klucz.default() == 10

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], user_input={}
    )
    assert result["type"] == "create_entry"
    assert result["data"]["liczba_wiadomosci"] == 10
