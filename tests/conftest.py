"""Wspólne fixtury testów."""
import pytest


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Pozwala HA ładować integrację z custom_components."""
    yield
