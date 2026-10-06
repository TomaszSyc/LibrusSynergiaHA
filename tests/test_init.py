"""Test the Librus APIX integration."""

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from unittest.mock import AsyncMock, patch, MagicMock

from custom_components.librus_apix.const import DOMAIN


@pytest.fixture
def mock_config_entry():
    """Return a mock config entry."""
    return MockConfigEntry(
        version=1,
        domain=DOMAIN,
        title="Test Librus",
        data={"username": "test_user", "password": "test_password"},
        source="user",
        entry_id="test_entry_id"
    )


@pytest.fixture
def mock_librus_client():
    """Return a mock Librus client."""
    client = MagicMock()
    client.async_authenticate = AsyncMock(return_value=True)
    client.async_get_student_information = AsyncMock(return_value=None)
    client.async_get_grades = AsyncMock(return_value=[])
    client.async_get_messages = AsyncMock(return_value=[])
    client.async_get_homework = AsyncMock(return_value=[])
    client.async_get_schedule = AsyncMock(return_value=[])
    client.async_get_timetable = AsyncMock(return_value=[])
    client.async_get_attendance = AsyncMock(return_value=[])
    client.async_get_announcements = AsyncMock(return_value=[])
    client.async_get_uwagi = AsyncMock(return_value=([], False))
    client.async_get_zachowanie = AsyncMock(return_value=None)
    return client


async def test_setup_entry(hass: HomeAssistant, mock_config_entry, mock_librus_client):
    """Test the setup entry."""
    mock_config_entry.add_to_hass(hass)
    with patch(
        "custom_components.librus_apix.LibrusApiClient",
        return_value=mock_librus_client
    ):
        result = await hass.config_entries.async_setup(mock_config_entry.entry_id)
        assert result is True


async def test_unload_entry(hass: HomeAssistant, mock_config_entry, mock_librus_client):
    """Test unloading an entry."""
    mock_config_entry.add_to_hass(hass)
    with patch(
        "custom_components.librus_apix.LibrusApiClient",
        return_value=mock_librus_client
    ):
        # Setup first
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        
        # Then unload
        result = await hass.config_entries.async_unload(mock_config_entry.entry_id)
        assert result is True