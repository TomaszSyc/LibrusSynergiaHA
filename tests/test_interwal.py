"""Interwał odpytywania Librusa regulowany w opcjach integracji."""

from datetime import datetime, timedelta
from unittest.mock import MagicMock

from custom_components.librus_apix.__init__ import LibrusApiClient
from custom_components.librus_apix.sensor import LibrusDataUpdateCoordinator

SRODA_10 = datetime(2026, 10, 21, 10, 0)
SRODA_20 = datetime(2026, 10, 21, 20, 0)
SOBOTA_10 = datetime(2026, 10, 24, 10, 0)


def _koordynator(hass, options):
    client = MagicMock(spec=LibrusApiClient)
    client.username = "test_user"
    client.options = options
    return LibrusDataUpdateCoordinator(hass, client)


async def test_domyslne_interwaly(hass):
    koordynator = _koordynator(hass, {})
    assert koordynator._interwal_odpytywania(SRODA_10) == timedelta(minutes=15)
    assert koordynator._interwal_odpytywania(SRODA_20) == timedelta(minutes=120)
    assert koordynator._interwal_odpytywania(SOBOTA_10) == timedelta(minutes=120)


async def test_interwaly_z_opcji(hass):
    koordynator = _koordynator(hass, {"scan_interval_school_minutes": 60, "scan_interval_minutes": 360})
    assert koordynator._interwal_odpytywania(SRODA_10) == timedelta(minutes=60)
    assert koordynator._interwal_odpytywania(SRODA_20) == timedelta(minutes=360)
    assert koordynator._interwal_odpytywania(SOBOTA_10) == timedelta(minutes=360)
