"""Testy rozpoznawania braku dostępu do modułu (zamiast przelogowań co cykl)."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from homeassistant.util import dt as dt_util
from librus_apix.exceptions import TokenError

import custom_components.librus_apix as integ
from custom_components.librus_apix import LibrusApiClient


@pytest.fixture
def klient():
    """Klient z zamockowanym logowaniem (bez sieci)."""
    fake = MagicMock()
    fake.get_token.return_value = "token"
    with patch.object(integ, "new_client", return_value=fake):
        yield LibrusApiClient("jan", "haslo"), fake


def _oceny():
    return ([], [], [])


async def test_brak_dostepu_do_ocen(klient):
    c, fake = klient
    with patch(
        "librus_apix.student_information.get_student_information",
        return_value=SimpleNamespace(),
    ) as kanarek, patch(
        "librus_apix.grades.get_grades", side_effect=TokenError("x")
    ) as grades:
        assert await c.async_get_grades() == []
        assert "oceny" in c._brak_dostepu
        kanarek.assert_called_once()
        wywolania = grades.call_count
        logowania = fake.get_token.call_count

        assert await c.async_get_grades() == []
        assert grades.call_count == wywolania
        assert fake.get_token.call_count == logowania
        kanarek.assert_called_once()


async def test_wygasly_token_to_nie_brak_dostepu(klient):
    c, _ = klient
    with patch(
        "librus_apix.student_information.get_student_information",
        return_value=SimpleNamespace(),
    ) as kanarek, patch(
        "librus_apix.grades.get_grades",
        side_effect=[TokenError("x"), _oceny()],
    ):
        assert await c.async_get_grades() == []
        assert c._brak_dostepu == {}
        kanarek.assert_not_called()


async def test_awaria_librusa_nie_blokuje(klient):
    """Zapytanie kontrolne tez zawodzi - to awaria, nie brak dostepu."""
    c, _ = klient
    with patch(
        "librus_apix.student_information.get_student_information",
        side_effect=TokenError("x"),
    ), patch("librus_apix.grades.get_grades", side_effect=TokenError("x")):
        assert await c.async_get_grades() is None
        assert c._brak_dostepu == {}


async def test_brak_dostepu_wygasa(klient):
    c, _ = klient
    c._brak_dostepu["oceny"] = dt_util.utcnow() - timedelta(hours=25)
    with patch("librus_apix.grades.get_grades", return_value=_oceny()) as grades:
        assert await c.async_get_grades() == []
        grades.assert_called_once()


async def test_swiezy_wpis_blokuje_moduly_niezaleznie(klient):
    c, _ = klient
    c._brak_dostepu["oceny"] = dt_util.utcnow() - timedelta(hours=1)
    with patch("librus_apix.grades.get_grades") as grades, patch(
        "librus_apix.announcements.get_announcements", return_value=[]
    ) as ann:
        assert await c.async_get_grades() == []
        grades.assert_not_called()
        assert await c.async_get_announcements() == []
        ann.assert_called_once()
