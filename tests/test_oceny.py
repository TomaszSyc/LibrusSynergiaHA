from custom_components.librus_apix.oceny import (
    oznacz_zastapione, skala_oceny, wartosc_oceny, procent_oceny,
    srednia_wazona, srednia_procentowa, biezacy_semestr)


def g(o, popr=False): return {"grade": o, "improvement": popr, "superseded": False}
def s(o, waga=1, licz=True, zast=False): return {"ocena": o, "waga": waga, "licz_do_sredniej": licz, "zastapiona": zast}


def test_poprawa_zastepuje(): assert [x["superseded"] for x in oznacz_zastapione([g("4"), g("2"), g("5", True)])] == [False, True, False]
def test_poprawa_poprawy(): assert [x["superseded"] for x in oznacz_zastapione([g("1"), g("2", True), g("3", True)])] == [True, True, False]
def test_dwa_nawiasy(): assert [x["superseded"] for x in oznacz_zastapione([g("6"), g("2"), g("4", True), g("3"), g("5", True)])] == [False, True, False, True, False]
def test_skale(): assert [skala_oceny(x) for x in ["4+", "B-", "95", "80%", "17 pkt", "7/10", "np", "+", "-", "T", "", "0"]] == ["1-6", "litery", "punkty", "punkty", "punkty", "punkty", None, None, None, None, None, None]
def test_wartosci(): assert [wartosc_oceny(x) for x in ["4+", "3-", "A", "C+", "np"]] == [4.5, 2.75, 5.0, 2.5, None]
def test_procenty(): assert [procent_oceny(x) for x in ["95", "80%", "17 pkt", "7/10", "4"]] == [95.0, 80.0, 17.0, 70.0, None]
def test_srednia_wazona(): assert srednia_wazona([s("5", 2), s("2"), s("1", licz=False), s("1", zast=True), s("90"), s("np")]) == 4.0
def test_srednia_stare_dane(): assert srednia_wazona([{"ocena": "4"}, {"ocena": "3+"}]) == 3.75
def test_srednia_pusta(): assert srednia_wazona([]) is None and srednia_procentowa([s("5")]) is None
def test_srednia_procentowa(): assert srednia_procentowa([s("90"), s("7/10"), s("50%", zast=True), s("4")]) == 80.0
def test_semestr(): assert (biezacy_semestr({}, {}), biezacy_semestr({"Fizyka": []}, {}), biezacy_semestr({"Fizyka": [object()]}, {}), biezacy_semestr({}, {"Plastyka": [object()]})) == (1, 1, 2, 2)


def test_waga_zero_i_dzielenie_przez_zero():
    assert srednia_wazona([s("4", 0), s("2", None)]) == 3.0
    assert procent_oceny("1/0") is None
    assert skala_oceny("1/0") is None
