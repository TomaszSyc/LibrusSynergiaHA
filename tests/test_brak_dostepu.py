"""#48: moduły bez dostępu ("Brak dostępu" w Librusie) nie powodują ponownego logowania."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from librus_apix.exceptions import TokenError

from custom_components.librus_apix import LibrusApiClient
from custom_components.librus_apix.config_flow import validate_input


def _klient(wiek_sesji: float) -> LibrusApiClient:
    client = LibrusApiClient("przedszkole", "haslo")
    client._client = MagicMock()
    client._token = "token"
    client._auth_time = time.monotonic() - wiek_sesji
    client.async_authenticate = AsyncMock(return_value=True)
    return client


async def test_brak_dostepu_tuz_po_logowaniu_bez_ponownego_logowania():
    """TokenError na świeżej sesji to brak dostępu do modułu, a nie wygasły token."""
    client = _klient(wiek_sesji=5)
    with patch("librus_apix.homework.get_homework", side_effect=TokenError("Brak dostępu")) as gh:
        assert await client.async_get_homework() is None
    assert gh.call_count == 1
    client.async_authenticate.assert_not_awaited()
    assert client._client is not None  # sesja nie została zresetowana


async def test_modul_bez_dostepu_pomijany_w_kolejnych_cyklach():
    client = _klient(wiek_sesji=5)
    with patch("librus_apix.homework.get_homework", side_effect=TokenError("Brak dostępu")) as gh:
        await client.async_get_homework()
        await client.async_get_homework()
        await client.async_get_homework()
    assert gh.call_count == 1


async def test_blokada_modulu_wygasa():
    client = _klient(wiek_sesji=5)
    with patch("librus_apix.homework.get_homework", side_effect=TokenError("Brak dostępu")):
        await client.async_get_homework()
    client._brak_dostepu["zadania"] = time.monotonic() - 1  # minęła doba
    with patch("librus_apix.homework.get_homework", return_value=["zadanie"]) as gh:
        assert await client.async_get_homework() == ["zadanie"]
    assert gh.call_count == 1


async def test_brak_dostepu_jednego_modulu_nie_blokuje_innych():
    client = _klient(wiek_sesji=5)
    with patch("librus_apix.homework.get_homework", side_effect=TokenError("Brak dostępu")):
        await client.async_get_homework()
    with patch("librus_apix.announcements.get_announcements", return_value=[]) as ga:
        assert await client.async_get_announcements() == []
    assert ga.call_count == 1


async def test_wygasla_sesja_nadal_odswieza_logowanie():
    """Stara sesja + TokenError: jedno ponowne logowanie i druga próba (jak dotąd)."""
    client = _klient(wiek_sesji=3600)

    async def _auth():
        client._client = MagicMock()
        client._token = "nowy"
        client._auth_time = time.monotonic()
        return True

    client.async_authenticate = AsyncMock(side_effect=_auth)
    with patch("librus_apix.homework.get_homework", side_effect=[TokenError("wygasł"), ["zadanie"]]) as gh:
        assert await client.async_get_homework() == ["zadanie"]
    assert gh.call_count == 2
    client.async_authenticate.assert_awaited_once()
    assert client._brak_dostepu == {}


async def test_brak_dostepu_po_ponownym_logowaniu_konczy_bez_kolejnych_prob():
    """Stara sesja: po ponownym logowaniu dalej "Brak dostępu" - moduł oznaczony, bez trzeciej próby."""
    client = _klient(wiek_sesji=3600)

    async def _auth():
        client._client = MagicMock()
        client._client.post.return_value.text = "<html><h2 class='inside'>Brak dostępu</h2></html>"
        client._token = "nowy"
        client._auth_time = time.monotonic()
        return True

    client._client.post.return_value.text = "<html><h2 class='inside'>Brak dostępu</h2></html>"
    client.async_authenticate = AsyncMock(side_effect=_auth)
    with patch("librus_apix.grades.no_access_check", side_effect=TokenError("Brak dostępu")):
        assert await client.async_get_grades() is None
    assert "oceny" in client._brak_dostepu
    client.async_authenticate.assert_awaited_once()


async def test_ostrzezenie_o_braku_dostepu_raz(caplog):
    import logging

    client = _klient(wiek_sesji=5)
    with caplog.at_level(logging.WARNING, logger="custom_components.librus_apix"), \
         patch("librus_apix.homework.get_homework", side_effect=TokenError("Brak dostępu")):
        await client.async_get_homework()
        client._brak_dostepu["zadania"] = time.monotonic() - 1
        await client.async_get_homework()
    ostrzezenia = [r for r in caplog.records if r.levelno == logging.WARNING and "Brak dostępu" in r.getMessage()]
    assert len(ostrzezenia) == 1


async def test_udane_logowanie_zapisuje_czas_sesji():
    client = LibrusApiClient("u", "p")
    lib = MagicMock()
    lib.get_token.return_value = "token"
    with patch("custom_components.librus_apix.new_client", return_value=lib):
        assert await client.async_authenticate() is True
    assert time.monotonic() - client._auth_time < 5


# --- Konfiguracja konta ---


def _lib_klient():
    lib = MagicMock()
    lib.get_token.return_value = "token"
    return lib


async def test_konfiguracja_konto_bez_dostepu_do_dziennika(hass):
    with patch("custom_components.librus_apix.config_flow.nowy_klient", return_value=_lib_klient()), \
         patch("librus_apix.student_information.get_student_information", side_effect=TokenError("Brak dostępu")), \
         patch("librus_apix.messages.get_received", side_effect=TokenError("Brak dostępu")):
        with pytest.raises(PermissionError):
            await validate_input(hass, {"username": "przedszkole", "password": "x"})


async def test_konfiguracja_konto_tylko_z_wiadomosciami(hass):
    """Brak dziennika, ale wiadomości działają - konto można dodać."""
    with patch("custom_components.librus_apix.config_flow.nowy_klient", return_value=_lib_klient()), \
         patch("librus_apix.student_information.get_student_information", side_effect=TokenError("Brak dostępu")), \
         patch("librus_apix.messages.get_received", return_value=[]):
        wynik = await validate_input(hass, {"username": "przedszkole", "password": "x"})
    assert wynik["title"]


async def test_konfiguracja_zwykle_konto(hass):
    with patch("custom_components.librus_apix.config_flow.nowy_klient", return_value=_lib_klient()), \
         patch("librus_apix.student_information.get_student_information", return_value=MagicMock()) as gs, \
         patch("librus_apix.messages.get_received") as gr:
        await validate_input(hass, {"username": "jan", "password": "x"})
    gs.assert_called_once()
    gr.assert_not_called()


async def test_formularz_pokazuje_blad_braku_dostepu(hass):
    from custom_components.librus_apix.const import DOMAIN

    with patch("custom_components.librus_apix.config_flow.validate_input", side_effect=PermissionError("brak")):
        wynik = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
        wynik = await hass.config_entries.flow.async_configure(wynik["flow_id"], {"username": "a", "password": "b"})
    assert wynik["errors"] == {"base": "no_access"}
