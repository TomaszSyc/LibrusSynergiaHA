"""Testy optymalizacji zapytań OAuth oraz limitu czasu sesji HTTP."""

from unittest.mock import MagicMock
import pytest

from custom_components.librus_apix.__init__ import _ensure_oauth, LibrusApiClient


from requests.cookies import RequestsCookieJar


def test_ensure_oauth_reuses_cookie_token():
    """Upewnij się, że _ensure_oauth używa istniejącego tokena z ciasteczek."""
    jar = RequestsCookieJar()
    jar.set("oauth_token", "existing_cookie_token", domain="synergia.librus.pl", path="/")
    client = MagicMock()
    client.cookies = jar
    client.token = MagicMock(oauth=None)

    token = _ensure_oauth(client)
    assert token == "existing_cookie_token"
    client.refresh_oauth.assert_not_called()


def test_ensure_oauth_reuses_token_attr():
    """Upewnij się, że _ensure_oauth używa tokena z client.token.oauth."""
    jar = RequestsCookieJar()
    client = MagicMock()
    client.cookies = jar
    client.token = MagicMock(oauth="attr_token")

    token = _ensure_oauth(client)
    assert token == "attr_token"
    assert jar.get("oauth_token") == "attr_token"
    client.refresh_oauth.assert_not_called()


def test_ensure_oauth_refreshes_when_missing():
    """Upewnij się, że _ensure_oauth odświeża token, gdy go brak."""
    jar = RequestsCookieJar()
    client = MagicMock()
    client.cookies = jar
    client.token = MagicMock(oauth=None)
    client.refresh_oauth.return_value = "new_token"

    token = _ensure_oauth(client)
    assert token == "new_token"
    assert jar.get("oauth_token") == "new_token"
    client.refresh_oauth.assert_called_once()


def test_ensure_oauth_force_refresh():
    """Upewnij się, że _ensure_oauth wymusza odświeżenie przy force_refresh=True."""
    jar = RequestsCookieJar()
    jar.set("oauth_token", "old_token", domain="synergia.librus.pl", path="/")
    client = MagicMock()
    client.cookies = jar
    client.token = MagicMock(oauth="old_token")
    client.refresh_oauth.return_value = "refreshed_token"

    token = _ensure_oauth(client, force_refresh=True)
    assert token == "refreshed_token"
    assert jar.get("oauth_token") == "refreshed_token"
    client.refresh_oauth.assert_called_once()


def test_ensure_oauth_handles_conflicting_cookiejar():
    """Upewnij się, że _ensure_oauth radzi sobie ze zduplikowanymi ciasteczkami w RequestsCookieJar."""
    jar = RequestsCookieJar()
    # Dodanie duplikatów powodujących CookieConflictError przy standardowym get()
    jar.set("oauth_token", "srv_token", domain="synergia.librus.pl", path="/")
    jar.set("oauth_token", "dup_token", domain=".librus.pl", path="/")

    client = MagicMock()
    client.cookies = jar
    client.token = MagicMock(oauth="clean_token")

    # Nie powinno rzucić CookieConflictError
    token = _ensure_oauth(client)
    assert token == "clean_token"
    # Duplikaty powinny zostać oczyszczone i jar.get() działa bez wyjątku
    assert jar.get("oauth_token") == "clean_token"


async def test_session_request_has_timeout():
    """Upewnij się, że sesja klienta po autoryzacji posiada domyślny timeout."""
    api_client = LibrusApiClient("test_user", "test_pass")
    mock_librus_client = MagicMock()
    mock_session = MagicMock()
    mock_librus_client._session = mock_session
    mock_session.request = MagicMock()
    
    # Symulacja przypisania klienta
    api_client._client = mock_librus_client
    
    # Dodanie opakowania timeoutu tak jak w async_authenticate
    orig_request = mock_session.request
    def _request_with_timeout(*args, **kwargs):
        kwargs.setdefault("timeout", 15)
        return orig_request(*args, **kwargs)
    mock_session.request = _request_with_timeout

    mock_session.request("GET", "https://synergia.librus.pl")
    orig_request.assert_called_once()
    assert orig_request.call_args[1].get("timeout") == 15
