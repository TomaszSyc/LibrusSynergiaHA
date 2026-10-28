"""Testy kreatora dashboardu ze strony projektu (docs/generator.js + docs/dashboard-templates.js)."""

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

DOCS = Path(__file__).parent.parent / "docs"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="brak Node.js")

URUCHOM = r"""
const fs = require("fs"), vm = require("vm"), path = require("path");
const [docs, wejscie] = process.argv.slice(2);
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ["dashboard-templates.js", "generator.js"]) {
  vm.runInContext(fs.readFileSync(path.join(docs, f), "utf8"), ctx, { filename: f });
}
const G = ctx.window.LibrusGenerator;
const { uczniowie, wybrane, encje } = JSON.parse(fs.readFileSync(wejscie, "utf8"));
const P = Object.fromEntries(G.DASH_PALETY.map(p => [p.id, p]));
const lista = uczniowie.map(u => Object.assign({}, u, {
  paleta: P[u.paleta],
  encje: Object.assign(G.dashDomyslneEncje(u.fullName), G.dashDopasujEncje(encje || "", u.fullName)),
}));
const ids = wybrane || G.dashKatalog().flatMap(s => s.elementy.map(e => e.id));
const widok = G.generateDashboardView(lista, ids, { tytul: "Szkoła", sciezka: "szkola" });
const elementy = G.generateDashboardElements(lista, ids);
process.stdout.write(JSON.stringify({
  katalog: G.dashKatalog(),
  widok: G.toYaml(widok),
  elementy: elementy.map(e => ({ id: e.id, yaml: G.toYaml(e.karta) })),
  wymagane: G.dashWymaganeKarty(ids).map(k => k.id),
}));
"""


def _generuj(tmp_path, **dane):
    skrypt = tmp_path / "uruchom.js"
    skrypt.write_text(URUCHOM, encoding="utf-8")
    wejscie = tmp_path / "wejscie.json"
    wejscie.write_text(json.dumps(dane, ensure_ascii=False), encoding="utf-8")
    wynik = subprocess.run(
        ["node", str(skrypt), str(DOCS), str(wejscie)],
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    return json.loads(wynik.stdout)


UCZNIOWIE = [
    {"fullName": "Jan Kowalski", "shortName": "Jan", "emoji": "🧑‍🎓", "paleta": "indygo", "cel": "4.75"},
    {"fullName": "Zofia Łęcka-Nowak", "shortName": "Zofia", "emoji": "👧", "paleta": "morski", "cel": "5"},
]


def test_widok_wszystkich_elementow_to_poprawny_yaml(tmp_path):
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE)
    widok = yaml.safe_load(wynik["widok"])
    assert widok["type"] == "sections"
    liczba_sekcji = len(wynik["katalog"])
    assert len(widok["sections"]) == 2 * liczba_sekcji
    # Pierwsza sekcja kazdego ucznia na pelna szerokosc, z jego imieniem
    assert widok["sections"][0]["column_span"] == 3
    assert widok["sections"][0]["cards"][0]["heading"] == "Jan"
    assert widok["sections"][liczba_sekcji]["cards"][0]["heading"] == "Zofia"


def test_brak_niepodstawionych_tokenow(tmp_path):
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE)
    tekst = wynik["widok"] + "".join(e["yaml"] for e in wynik["elementy"])
    assert not re.search(r"__(E\[|HELPER_|IMIE|EMOJI|ACC|C1|C2|GOAL)", tekst)


def test_encje_i_kolory_ucznia(tmp_path):
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE)
    tekst = wynik["widok"]
    assert "sensor.librus_jan_kowalski_oceny" in tekst
    # Polskie znaki i myslnik w nazwisku jak w identyfikatorach HA
    assert "sensor.librus_zofia_lecka_nowak_oceny" in tekst
    # Kolory i cel sredniej w bloku JS kart button-card (indygo dla Jana, morski dla Zofii)
    assert '"ACC": "#3f51b5"' in tekst
    assert '"ACC": "#00897b"' in tekst
    assert '"GOAL": 5' in tekst


def test_dopasowanie_encji_z_listy(tmp_path):
    encje = "\n".join([
        "sensor.jan_librus_jan_kowalski_uwagi_o_zachowaniu",
        "binary_sensor.jan_librus_jan_kowalski_obowiazki_szkolne_nauka",
        "sensor.librus_jan_kowalski_oceny",
    ])
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE[:1], encje=encje)
    assert "sensor.jan_librus_jan_kowalski_uwagi_o_zachowaniu" in wynik["widok"]
    assert "binary_sensor.jan_librus_jan_kowalski_obowiazki_szkolne_nauka" in wynik["widok"]
    # Encje spoza listy zostaja wg wzorca
    assert "sensor.librus_jan_kowalski_frekwencja" in wynik["widok"]


def test_wybrane_elementy_i_naglowki_sekcji(tmp_path):
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE[:1], wybrane=["tematy", "wiadomosci"])
    widok = yaml.safe_load(wynik["widok"])
    karty = [c for s in widok["sections"] for c in s["cards"]]
    naglowki = [c["heading"] for c in karty if c["type"] == "heading"]
    # Naglowek sekcji i podnaglowek grupy tylko dla wybranych elementow
    assert naglowki == ["Plan lekcji", "Ostatnie lekcje – tematy", "Wiadomości"]
    assert [c["type"] for c in karty if c["type"] != "heading"] == ["markdown", "markdown"]
    assert wynik["wymagane"] == []


def test_kazdy_element_osobno_to_poprawna_karta(tmp_path):
    wynik = _generuj(tmp_path, uczniowie=UCZNIOWIE)
    assert len(wynik["elementy"]) == 2 * sum(len(s["elementy"]) for s in wynik["katalog"])
    for e in wynik["elementy"]:
        karta = yaml.safe_load(e["yaml"])
        assert isinstance(karta, dict) and "type" in karta, e["id"]


PODGLAD = r"""
const fs = require("fs"), vm = require("vm"), path = require("path");
const [docs] = process.argv.slice(2);
const bledy = [];
const ctx = { window: {}, console: { error: (...a) => bledy.push(a.join(" ")), log() {} } };
vm.createContext(ctx);
for (const f of ["dashboard-templates.js", "generator.js", "dashboard-demo.js"]) {
  vm.runInContext(fs.readFileSync(path.join(docs, f), "utf8"), ctx, { filename: f });
}
const G = ctx.window.LibrusGenerator, D = ctx.window.LibrusDemo;
const uczen = { fullName: "Jan Kowalski", shortName: "Jan", emoji: "🧑‍🎓", paleta: G.DASH_PALETY[0], cel: "4.75" };
uczen.encje = G.dashDomyslneEncje(uczen.fullName);
const ids = G.dashKatalog().flatMap(s => s.elementy.map(e => e.id));
const S = D.stany(uczen);
const karty = G.generateDashboardElements([uczen], ids).map(e => ({ id: e.id, typ: e.karta.type, html: D.renderujKarte(e.id, e.karta, S, uczen.encje) }));
const widok = D.renderujSekcje(G.generateDashboardPreview(uczen, ids), uczen);
process.stdout.write(JSON.stringify({ karty, widok, bledy }));
"""


def test_podglad_na_danych_przykladowych(tmp_path):
    skrypt = tmp_path / "podglad.js"
    skrypt.write_text(PODGLAD, encoding="utf-8")
    wynik = json.loads(subprocess.run(
        ["node", str(skrypt), str(DOCS)], capture_output=True, text=True, encoding="utf-8", check=True,
    ).stdout)
    assert wynik["bledy"] == []
    assert len(wynik["karty"]) == 33
    for k in wynik["karty"]:
        assert "Nie udało się narysować" not in k["html"], k["id"]
        assert len(k["html"]) > 100, k["id"]
        if k["typ"] == "custom:button-card":
            # Prawdziwy kod karty: naglowek z ikona i tytulem z funkcji head()
            assert "<ha-icon icon=\"mdi:" in k["html"], k["id"]
    # Encje ucznia trafiaja do danych demo (np. imie i nazwisko w wizytowce)
    assert "Jan Kowalski" in wynik["widok"]
    assert wynik["widok"].count('class="ha-sekcja') == 13


def test_szablony_bez_danych_osobowych():
    tekst = (DOCS / "dashboard-templates.js").read_text(encoding="utf-8")
    # Identyfikatory encji i ID uzytkownikow HA tylko jako tokeny
    assert not re.search(r"\b(sensor|binary_sensor|todo|calendar|button)\.[a-z0-9_]*librus_", tekst)
    assert '"visible"' not in tekst
