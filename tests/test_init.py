"""Test the Librus APIX integration."""

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from unittest.mock import AsyncMock, patch, MagicMock

from custom_components.librus_apix.const import DOMAIN


@pytest.fixture
def mock_config_entry(hass):
    """Return a mock config entry added to hass."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Test Librus",
        data={"username": "test_user", "password": "test_password"},
        entry_id="test_entry_id",
    )
    entry.add_to_hass(hass)
    return entry


@pytest.fixture
def mock_librus_client():
    """Return a mock Librus client."""
    client = MagicMock()
    client.async_authenticate = AsyncMock(return_value=True)
    client.async_init_cache = AsyncMock()
    client.async_get_grades = AsyncMock(return_value=[
        {
            'subject': 'Mathematyka',
            'grade': '5',
            'date': '2025-01-01',
            'category': 'Test',
            'teacher': 'Jan Kowalski',
            'type': 'numeric'
        }
    ])
    client.async_get_messages = AsyncMock(return_value=[])
    client.options = {}
    client.async_get_student_information = AsyncMock(return_value=None)
    for name in (
        "async_get_homework", "async_get_schedule", "async_get_timetable",
        "async_get_attendance", "async_get_announcements", "async_get_completed_lessons",
    ):
        setattr(client, name, AsyncMock(return_value=[]))
    client.async_get_attendance_stats = AsyncMock(return_value=None)
    client.async_get_notes = AsyncMock(return_value=[])
    client.async_get_behavior = AsyncMock(return_value=None)
    return client


async def test_setup_entry(hass: HomeAssistant, mock_config_entry, mock_librus_client):
    """Test the setup entry."""
    with patch(
        "custom_components.librus_apix.LibrusApiClient",
        return_value=mock_librus_client
    ):
        result = await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()
        assert result is True
        assert mock_config_entry.state is ConfigEntryState.LOADED


async def test_unload_entry(hass: HomeAssistant, mock_config_entry, mock_librus_client):
    """Test unloading an entry."""
    with patch(
        "custom_components.librus_apix.LibrusApiClient",
        return_value=mock_librus_client
    ):
        # Setup first
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        
        # Then unload
        result = await hass.config_entries.async_unload(mock_config_entry.entry_id)
        await hass.async_block_till_done()
        assert result is True
        assert mock_config_entry.state is ConfigEntryState.NOT_LOADED


def test_manifest_excludes_buggy_soupsieve():
    """Weryfikacja czy manifest.json wyklucza wadliwą wersję soupsieve 3.0 (Issue #39)."""
    import json
    import os

    manifest_path = os.path.join(
        os.path.dirname(__file__), "..", "custom_components", "librus_apix", "manifest.json"
    )
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    reqs = manifest.get("requirements", [])
    assert any("soupsieve" in r and "!=3.0" in r for r in reqs)


async def test_soupsieve_buggy_version_logged(hass: HomeAssistant, mock_config_entry, mock_librus_client, caplog):
    """Weryfikacja czy wykrycie soupsieve 3.0 loguje błąd ostrzegawczy z odniesieniem do Issue #39."""
    import logging

    fake_soupsieve = MagicMock()
    fake_soupsieve.__version__ = "3.0.0"

    with patch.dict("sys.modules", {"soupsieve": fake_soupsieve}):
        with patch("custom_components.librus_apix.LibrusApiClient", return_value=mock_librus_client):
            with caplog.at_level(logging.ERROR):
                await hass.config_entries.async_setup(mock_config_entry.entry_id)
                await hass.async_block_till_done()

    assert any("Issue #39" in record.message for record in caplog.records)