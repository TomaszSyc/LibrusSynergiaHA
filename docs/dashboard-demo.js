/**
 * Librus Synergia HA - podgląd dashboardu na danych przykładowych.
 *
 * Karty button-card są renderowane prawdziwym kodem z szablonu (ten sam HTML co w HA),
 * pozostałe karty (markdown z Jinja, Mushroom, wbudowane) to makiety odwzorowujące
 * logikę szablonów na tych samych danych.
 */
(function () {
  "use strict";

  // ===== Pomocnicze =====
  const DNI = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const DNI_KR = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad2 = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const dzis0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const plusDni = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const pd = (s) => { const p = String(s).slice(0, 10).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const ddiff = (s) => Math.round((pd(s) - dzis0()) / 86400000);
  const fmtd = (s) => String(s).slice(8, 10) + "." + String(s).slice(5, 7);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const roboczy = (d) => d.getDay() >= 1 && d.getDay() <= 5;

  // n-ty dzień roboczy od dziś (0 = dziś, jeśli roboczy; ujemne = wstecz)
  function dzienRoboczy(n) {
    let d = dzis0();
    const krok = n < 0 ? -1 : 1;
    let ile = Math.abs(n);
    if (n >= 0) { while (!roboczy(d)) d = plusDni(d, 1); } else { d = plusDni(d, -1); while (!roboczy(d)) d = plusDni(d, -1); ile -= 1; }
    while (ile > 0) { d = plusDni(d, krok); if (roboczy(d)) ile--; }
    return d;
  }

  // ===== Dane przykładowe =====
  const GODZINY = [["08:00", "08:45"], ["08:55", "09:40"], ["09:50", "10:35"], ["10:55", "11:40"], ["11:50", "12:35"], ["12:45", "13:30"], ["13:40", "14:25"]];
  const NAUCZYCIELE = {
    "matematyka": "Nowak Anna", "język polski": "Wiśniewska Ewa", "język angielski": "Smith John",
    "historia": "Lewandowski Piotr", "biologia": "Kamińska Maria", "geografia": "Zieliński Marek",
    "informatyka": "Wójcik Tomasz", "wychowanie fizyczne": "Kozłowski Adam", "plastyka": "Mazur Joanna",
    "muzyka": "Krawczyk Ola", "zajęcia z wychowawcą": "Nowak Anna", "religia": "Jankowski Paweł",
  };
  const SALE = { "matematyka": "12", "język polski": "21", "język angielski": "33", "historia": "14", "biologia": "28", "geografia": "27", "informatyka": "105", "wychowanie fizyczne": "sg", "plastyka": "8", "muzyka": "9", "zajęcia z wychowawcą": "12", "religia": "15" };
  const PLAN = {
    1: ["matematyka", "język polski", "język angielski", "historia", "wychowanie fizyczne", "zajęcia z wychowawcą"],
    2: ["biologia", "matematyka", "język polski", "geografia", "informatyka", "język angielski", "religia"],
    3: ["język polski", "matematyka", "historia", "wychowanie fizyczne", "plastyka", "muzyka"],
    4: ["język angielski", "biologia", "matematyka", "język polski", "geografia", "wychowanie fizyczne"],
    5: ["informatyka", "język polski", "matematyka", "historia", "religia"],
  };

  function lekcja(przedmiot, i, data, extra) {
    const n = NAUCZYCIELE[przedmiot] || "", s = SALE[przedmiot] || "";
    return Object.assign({
      przedmiot, nauczyciel_i_sala: `${n} - ${s}`, godzina_od: GODZINY[i][0], godzina_do: GODZINY[i][1],
      data, numer: i + 1, zdarzenie: null, odwolana: false, zastepstwo: false, nauczyciel: n, sala: s,
    }, extra || {});
  }

  function daneUcznia(uczen) {
    const d0 = dzis0(), dzis = ymd(d0);
    const r0 = dzienRoboczy(0), r1 = dzienRoboczy(1), r2 = dzienRoboczy(2), r4 = dzienRoboczy(4), r7 = dzienRoboczy(7), r9 = dzienRoboczy(9);

    // Terminarz
    const zd = (d, tytul, rodzaj, przedmiot, numer, opis, godzina) => ({
      data: ymd(d), tydzien: DNI[d.getDay()], tytul, rodzaj, przedmiot, godzina: godzina || "unknown",
      numer_lekcji: numer || "unknown", szczegoly: opis ? { Opis: opis } : {}, href: "", data_dodania: dzis,
    });
    const terminarz = [
      zd(r1, "Nauczyciel: Kamińska Maria", "nieobecnosc_nauczyciela", "Kamińska Maria", "1"),
      zd(r2, "Sprawdzian", "sprawdzian", "matematyka", "2", "Ułamki zwykłe i dziesiętne, działania na ułamkach"),
      zd(r4, "Kartkówka", "kartkowka", "biologia", "2", "Budowa komórki roślinnej"),
      zd(dzienRoboczy(6), "Wycieczka do Muzeum Narodowego", "wydarzenie", "Wycieczka do Muzeum Narodowego", "", "", "09:00"),
      zd(r9, "Sprawdzian", "sprawdzian", "historia", "4", "Polska pierwszych Piastów"),
      zd(dzienRoboczy(12), "Dzień Edukacji Narodowej", "dzien_wolny", "Dzień wolny od zajęć dydaktycznych"),
    ].sort((a, b) => a.data.localeCompare(b.data));

    // Plan na 7 dni od dziś
    const plan = [];
    for (let i = 0; i < 7; i++) {
      const d = plusDni(d0, i), data = ymd(d);
      const przedmioty = PLAN[d.getDay()] || [];
      const lekcje = przedmioty.map((p, idx) => {
        const extra = {};
        if (data === ymd(r0) && idx === 3) Object.assign(extra, { zastepstwo: true, nauczyciel_i_sala: "(Lewandowski Piotr ➔ Zieliński Marek) - 14" });
        if (data === ymd(r1) && idx === 0) Object.assign(extra, { odwolana: true });
        const ev = terminarz.find((z) => z.data === data && ["sprawdzian", "kartkowka"].includes(z.rodzaj) && z.przedmiot === p);
        if (ev) Object.assign(extra, { zdarzenie: ev.tytul, zdarzenie_opis: ev.szczegoly.Opis });
        return lekcja(p, idx, data, extra);
      });
      plan.push({ dzien_tygodnia: DNI[d.getDay()], data, lekcje, dzien_wolny: null });
    }

    // Oceny (od najnowszych liczone dni robocze wstecz)
    const surowe = {
      "matematyka": [["5", "sprawdzian", 30], ["4+", "kartkówka", 18], ["6", "aktywność", 9], ["5", "praca domowa", 1]],
      "język polski": [["4", "wypracowanie", 28], ["5-", "recytacja", 15], ["4", "kartkówka", 6]],
      "język angielski": [["5", "sprawdzian", 26], ["6", "odpowiedź ustna", 12], ["5+", "praca domowa", 4]],
      "historia": [["3+", "sprawdzian", 25], ["4", "kartkówka", 11], ["5", "projekt", 3]],
      "biologia": [["4", "kartkówka", 22], ["5", "aktywność", 13], ["4-", "sprawdzian", 0]],
      "geografia": [["5", "mapa konturowa", 20], ["4", "kartkówka", 8]],
      "informatyka": [["6", "projekt", 17], ["5", "ćwiczenie praktyczne", 5]],
      "wychowanie fizyczne": [["5", "aktywność", 19], ["6", "sprawność", 7], ["5", "aktywność", 2]],
    };
    const oceny_wg_przedmiotu = {};
    for (const [p, lista] of Object.entries(surowe)) {
      oceny_wg_przedmiotu[p] = lista.map(([ocena, kategoria, wstecz]) => {
        const data = ymd(wstecz === 0 ? dzienRoboczy(0) <= d0 ? dzienRoboczy(0) : dzienRoboczy(-1) : dzienRoboczy(-wstecz));
        return { ocena, data, kategoria, nauczyciel: NAUCZYCIELE[p], semestr: 1, komentarz: kategoria === "sprawdzian" ? "Dobra praca, popraw zadanie 4" : "", opis: "", jest_nowa: wstecz <= 1 };
      });
    }
    const liczba = (v) => { const m = String(v).match(/^([1-6])([+-]?)$/); return m ? +m[1] + (m[2] === "+" ? 0.5 : m[2] === "-" ? -0.25 : 0) : null; };
    const srednie = {};
    for (const [p, lista] of Object.entries(oceny_wg_przedmiotu)) {
      const w = lista.map((o) => liczba(o.ocena)).filter((v) => v != null);
      srednie[p] = Math.round(100 * w.reduce((a, b) => a + b, 0) / w.length) / 100;
    }
    const wszystkie = Object.values(oceny_wg_przedmiotu).flat().map((o) => liczba(o.ocena)).filter((v) => v != null);
    const srednia = Math.round(100 * wszystkie.reduce((a, b) => a + b, 0) / wszystkie.length) / 100;

    // Frekwencja
    const wpis = (symbol, typ, wstecz, przedmiot, godzina) => ({ symbol, typ, data: ymd(dzienRoboczy(-wstecz)), przedmiot, nauczyciel: NAUCZYCIELE[przedmiot], godzina });
    const lista_wpisow = [
      wpis("nb", "Nieobecność nieusprawiedliwiona", 2, "historia", 4),
      wpis("u", "Nieobecność usprawiedliwiona", 9, "matematyka", 1),
      wpis("u", "Nieobecność usprawiedliwiona", 9, "język polski", 2),
      wpis("u", "Nieobecność usprawiedliwiona", 9, "język angielski", 3),
      wpis("sp", "Spóźnienie", 5, "matematyka", 1),
      wpis("sp", "Spóźnienie", 14, "biologia", 1),
      wpis("zw", "Zwolnienie", 11, "wychowanie fizyczne", 5),
    ];

    // Tematy ostatniego dnia
    const ost = dzienRoboczy(-1), ostData = ymd(ost);
    const tematy = (PLAN[ost.getDay()] || PLAN[1]).map((p, i) => ({
      data: ostData, dzien_tygodnia: DNI[ost.getDay()], numer: i + 1, przedmiot: p, nauczyciel: NAUCZYCIELE[p],
      zastepca: i === 2 ? "Zieliński Marek" : "", zastepstwo: i === 2,
      temat: ["Ułamki dziesiętne – powtórzenie", "Czytanie ze zrozumieniem: „Mały Książę”", "Present Simple vs Present Continuous", "Mieszko I i chrzest Polski", "Gry zespołowe – siatkówka", "Plan pracy klasy", "Kościół w średniowieczu"][i] || "Lekcja powtórzeniowa",
      obecnosc: i === 3 ? "nb" : "ob", obecnosc_opis: i === 3 ? "nieobecność nieusprawiedliwiona" : "obecność",
    }));

    const uwagi = [
      { id: 3, data: ymd(dzienRoboczy(-3)), tresc: "Wzorowa pomoc koleżeńska podczas zajęć z informatyki.", rodzaj: "pozytywna", kategoria: "Pomoc innym", nauczyciel: "Wójcik Tomasz" },
      { id: 2, data: ymd(dzienRoboczy(-12)), tresc: "Reprezentowanie szkoły w konkursie matematycznym.", rodzaj: "pozytywna", kategoria: "Konkursy", nauczyciel: "Nowak Anna" },
      { id: 1, data: ymd(dzienRoboczy(-20)), tresc: "Rozmowy podczas lekcji.", rodzaj: "neutralna", kategoria: "Zachowanie na lekcji", nauczyciel: "Lewandowski Piotr" },
    ];
    const wpisyZach = [
      { kategoria: "Pomoc koleżeńska", punkty: 10, typ: "pozytywny", data: ymd(dzienRoboczy(-3)), nauczyciel: "Wójcik Tomasz", komentarz: "", okres: 1 },
      { kategoria: "Udział w konkursie", punkty: 15, typ: "pozytywny", data: ymd(dzienRoboczy(-12)), nauczyciel: "Nowak Anna", komentarz: "Etap szkolny", okres: 1 },
      { kategoria: "Praca na rzecz klasy", punkty: 5, typ: "pozytywny", data: ymd(dzienRoboczy(-16)), nauczyciel: "Nowak Anna", komentarz: "", okres: 1 },
      { kategoria: "Spóźnienie", punkty: -5, typ: "negatywny", data: ymd(dzienRoboczy(-14)), nauczyciel: "Kamińska Maria", komentarz: "", okres: 1 },
    ];

    const teraz = new Date();
    const wiadomosci = [
      { nadawca: "Nowak Anna (Wychowawca)", temat: "Zebranie z rodzicami", data: `${ymd(dzienRoboczy(0) <= d0 ? dzienRoboczy(0) : dzienRoboczy(-1))} 07:42:00`, nieprzeczytana: true, jest_nowa: true, ma_zalacznik: true, tresc: "Szanowni Państwo, zapraszam na zebranie w czwartek o 17:30 w sali 12. Tematem będą wyniki pierwszych sprawdzianów oraz wycieczka." },
      { nadawca: "Sekretariat szkoły", temat: "Ubezpieczenie NNW", data: `${ymd(dzienRoboczy(-2))} 12:10:00`, nieprzeczytana: false, jest_nowa: false, ma_zalacznik: false, tresc: "Przypominamy o terminie wpłat za ubezpieczenie do końca miesiąca." },
      { nadawca: "Kozłowski Adam", temat: "Zawody pływackie", data: `${ymd(dzienRoboczy(-5))} 15:31:00`, nieprzeczytana: false, jest_nowa: false, ma_zalacznik: false, tresc: "Uczniowie zakwalifikowani do zawodów proszeni są o zgody rodziców." },
    ];

    const nazwa = (uczen.fullName || "Jan Kowalski").trim();
    const stanAi = new Date(teraz.getTime() - 3 * 3600000).toISOString();
    return {
      "sensor.informacje_o_uczniu": [nazwa, { klasa: "6B", numer_w_klasie: 12, wychowawca: "mgr Anna Nowak", szkola: "Szkoła Podstawowa nr 5 im. Marii Konopnickiej,\n\nKraków", szczesliwy_numerek: 12 }],
      "sensor.szczesliwy_numerek": ["12", {}],
      "sensor.srednia_ocen": [srednia.toFixed(2), { srednie_wg_przedmiotow: srednie, semestr: 1 }],
      "sensor.oceny": [String(Object.values(oceny_wg_przedmiotu).flat().length), { oceny_wg_przedmiotu, liczba_ocen: Object.values(oceny_wg_przedmiotu).flat().length, liczba_przedmiotow: Object.keys(oceny_wg_przedmiotu).length, sa_nowe_oceny: true, semestr: 1 }],
      "sensor.frekwencja": ["4", { lista_wpisow, liczba_spoznien: 2, liczba_nieobecnosci: 4, liczba_nieusprawiedliwionych: 1, liczba_usprawiedliwionych: 3, liczba_zwolnien: 1, frekwencja_procent: 95.7, frekwencja_procent_rok: 95.7, lekcji_w_semestrze: 186, wpisy_wg_rodzaju: { ob: 176, nb: 1, u: 3, sp: 2, zw: 1, wy: 3 } }],
      "sensor.terminarz": [String(terminarz.length), { zdarzenia: terminarz, liczba_zdarzen: terminarz.length }],
      "sensor.plan_lekcji": [String(plan[0].lekcje.length), { kolejne_7_dni: plan }],
      "sensor.tematy_lekcji": ["0", { lekcje: tematy, lekcje_ostatniego_dnia: tematy, ostatni_dzien: ostData, nieobecnosci: tematy.filter((l) => l.obecnosc === "nb") }],
      "sensor.wiadomosci": ["1", { wiadomosci, liczba_nieprzeczytanych: 1, sa_nowe_wiadomosci: true }],
      "sensor.ogloszenia": ["2", { lista_ogloszen: [
        { tytul: "Dzień Edukacji Narodowej", nadawca: "Dyrekcja", data: ymd(dzienRoboczy(-1)), opis: "14 października zajęcia dydaktyczne nie odbywają się. Świetlica szkolna czynna w godzinach 7:00–16:00." },
        { tytul: "Konkurs matematyczny Kangur", nadawca: "Nowak Anna", data: ymd(dzienRoboczy(-6)), opis: "Zapisy do konkursu przyjmują nauczyciele matematyki do końca miesiąca." },
      ] }],
      "sensor.zachowanie": ["225", { punkty_startowe: 200, suma_okres_1: 225, suma_okres_2: null, ocena_przewidywana_okres_1: "bardzo dobre", ocena_przewidywana_okres_2: "", ocena_srodroczna: "", ocena_roczna: "", liczba_wpisow_pozytywnych: 3, liczba_wpisow_negatywnych: 1, ostatni_wpis: wpisyZach[0], wpisy: wpisyZach }],
      "sensor.uwagi_o_zachowaniu": ["3", { uwagi, liczba_pozytywnych: 2, liczba_negatywnych: 0, liczba_neutralnych: 1, ostatnia: uwagi[0], sa_nowe_uwagi: false }],
      "binary_sensor.obowiazki_szkolne_nauka": ["on", { sprawdziany_do_nauki: 1, wszystkie_sprawdziany_w_oknie: 1 }],
      "sensor.podsumowanie_ai_rodzic": ["Tydzień bardzo udany…", { "pełny_tekst": `**Świetny tydzień!** ${cap(uczen.shortName || "Jan")} zdobył szóstkę z matematyki i piątkę z angielskiego, a średnia wzrosła do ${srednia.toFixed(2)}.\n\n⚠️ Za 2 dni sprawdzian z matematyki (ułamki), warto zrobić powtórkę.\n\n📌 Jedna nieobecność z historii czeka na usprawiedliwienie.` }],
      "sensor.podsumowanie_ai_uczen": ["Brawo!", { "pełny_tekst": "Brawo! 🎉 Szóstka z matematyki to super wynik. Zostało 50 XP do kolejnego poziomu – sprawdzian z ułamków to dobra okazja!" }],
      "sensor.podsumowanie_wiadomosci_ai_rodzic": ["Zebranie…", { "pełny_tekst": "Wychowawczyni zaprasza na **zebranie w czwartek o 17:30** (sala 12). Sekretariat przypomina o wpłacie za ubezpieczenie NNW." }],
      "button.generuj_podsumowanie_ai": [stanAi, {}],
      "button.generuj_podsumowanie_wiadomosci_ai": [stanAi, {}],
      "button.odswiez_dane": [stanAi, {}],
      "todo.zadania_domowe_to_do": ["2", { pozycje: [["Zadania 3–7 str. 42 (matematyka)", false, ymd(r1)], ["Wypracowanie: Mój ulubiony bohater", false, ymd(r4)], ["Karta pracy – komórka", true, ""]] }],
      "todo.przygotowanie_do_lekcji_to_do": ["1", { pozycje: [["Nauka: matematyka (sprawdzian z ułamków)", false, ymd(r2)], ["Nauka: biologia (kartkówka – komórka)", false, ymd(r4)]] }],
      "calendar.plan_lekcji_kalendarz": ["off", {}],
      "calendar.terminarz_kalendarz": ["off", {}],
    };
  }

  // Stany HA ({entity_id: {state, attributes}}) dla ucznia z mapą encji klucz -> entity_id
  function stany(uczen) {
    const dane = daneUcznia(uczen), wynik = {};
    for (const [klucz, [state, attributes]] of Object.entries(dane)) {
      const id = (uczen.encje && uczen.encje[klucz]) || klucz;
      wynik[id] = { entity_id: id, state, attributes };
    }
    return wynik;
  }

  // ===== Elementy HA: ha-icon i ha-alert =====
  if (window.customElements && !customElements.get("ha-icon")) {
    customElements.define("ha-icon", class extends HTMLElement {
      static get observedAttributes() { return ["icon"]; }
      connectedCallback() { this.render(); }
      attributeChangedCallback() { this.render(); }
      render() {
        const ikona = (this.getAttribute("icon") || "").replace(/^mdi:/, "");
        this.innerHTML = ikona ? `<i class="mdi mdi-${esc(ikona)}" aria-hidden="true"></i>` : "";
      }
    });
  }
  if (window.customElements && !customElements.get("ha-alert")) {
    const IKONY = { info: "information-outline", warning: "alert-outline", error: "alert-circle-outline", success: "check-circle-outline" };
    customElements.define("ha-alert", class extends HTMLElement {
      connectedCallback() {
        if (this.dataset.gotowy) return;
        this.dataset.gotowy = "1";
        const typ = this.getAttribute("alert-type") || "info", tytul = this.getAttribute("title");
        const tresc = this.innerHTML;
        this.removeAttribute("title");
        this.className = `ha-alert ${typ}`;
        this.innerHTML = `<span class="ha-alert-ikona"><i class="mdi mdi-${IKONY[typ] || IKONY.info}"></i></span><span class="ha-alert-tresc">${tytul ? `<b class="ha-alert-tytul">${esc(tytul)}</b>` : ""}<span>${tresc}</span></span>`;
      }
    });
  }

  // ===== Karty =====
  const A = (S, id) => (S[id] && S[id].attributes) || {};
  const st = (S, id) => (S[id] ? S[id].state : "");
  const KOLORY_MUSHROOM = { green: "#4caf50", "light-green": "#8bc34a", amber: "#ffc107", orange: "#ff9800", red: "#f44336", purple: "#9c27b0", blue: "#2196f3", grey: "#9e9e9e" };
  const GC = { 1: "#e53935", 2: "#fb8c00", 3: "#f9a825", 4: "#7cb342", 5: "#43a047", 6: "#00897b" };
  const gkol = (v) => GC[String(v).charAt(0)] || "#9e9e9e";
  const akol = (a) => typeof a !== "number" ? "#9e9e9e" : a >= 4.5 ? "#43a047" : a >= 3.5 ? "#7cb342" : a >= 2.5 ? "#f9a825" : a >= 1.75 ? "#fb8c00" : "#e53935";
  const ocena = (v, nowa) => `<font color="${gkol(v)}"><b>${esc(v)}</b></font>${nowa ? "<sup>🆕</sup>" : ""}`;
  const sredniaHtml = (a) => {
    if (typeof a !== "number" || !(a > 0)) return `<font color="#9e9e9e">—</font>`;
    const n = Math.round(a);
    return `<font color="${akol(a)}"><b>${a.toFixed(2)}</b> ${"●".repeat(n)}${"○".repeat(6 - n)}</font>`;
  };

  function karta(html, klasa) { return `<div class="ha-card${klasa ? " " + klasa : ""}">${html}</div>`; }
  function md(html, klasa) { return karta(`<div class="ha-md">${html}</div>`, "ha-markdown" + (klasa ? " " + klasa : "")); }

  // Domyślne ikony encji integracji (jak w odznakach HA bez własnej ikony)
  const IKONY_ENCJI = [["srednia", "mdi:chart-line"], ["szczesliwy_numerek", "mdi:numeric"], ["oceny", "mdi:school"], ["terminarz", "mdi:calendar"], ["wiadomosci", "mdi:email"], ["frekwencja", "mdi:account-check"], ["plan_lekcji", "mdi:timetable"], ["uwagi", "mdi:alert-circle"], ["zachowanie", "mdi:account-star"]];
  const ikonaEncji = (id) => (IKONY_ENCJI.find(([k]) => String(id).includes(k)) || [null, "mdi:information-outline"])[1];

  function naglowek(k, S) {
    const odznaki = (k.badges || []).map((b) => {
      const kol = b.color === "green" ? "#4caf50" : "var(--demo-acc)";
      const ikona = b.show_icon === false ? "" : b.icon || ikonaEncji(b.entity);
      return `<span class="ha-badge">${ikona ? `<ha-icon icon="${esc(ikona)}" style="color:${kol}"></ha-icon>` : ""}${b.show_state === false ? "" : esc(st(S, b.entity))}</span>`;
    }).join("");
    return `<div class="ha-heading ${k.heading_style === "subtitle" ? "subtitle" : "title"}"><span class="ha-heading-tytul">${k.icon ? `<ha-icon icon="${esc(k.icon)}"></ha-icon>` : ""}${esc(k.heading)}</span>${odznaki ? `<span class="ha-badges">${odznaki}</span>` : ""}</div>`;
  }

  function buttonCard(k, S) {
    const kod = String(k.custom_fields.c).trim().replace(/^\[\[\[/, "").replace(/\]\]\]$/, "");
    // eslint-disable-next-line no-new-func
    const html = new Function("states", "hass", "entity", "variables", "user", kod)(S, { states: S }, S[k.entity], {}, {});
    return karta(html, "button-card");
  }

  const MAKIETY = {
    wizytowka(k, S, E) {
      const i = A(S, E["sensor.informacje_o_uczniu"]), num = st(S, E["sensor.szczesliwy_numerek"]);
      const szkola = String(i.szkola || "").split("\n");
      const emoji = (k.content.match(/## \{\{ '([^']+)' \}\}/) || [])[1] || "🧑‍🎓";
      const gradient = (k.card_mod && (k.card_mod.style.match(/linear-gradient\([^)]*\)/) || [])[0]) || "";
      return karta(`<div class="ha-md"><h2>${esc(emoji)} ${esc(st(S, E["sensor.informacje_o_uczniu"]))}</h2>` +
        `<p><b>${esc(i.klasa)}</b> · nr w dzienniku <b>${esc(i.numer_w_klasie)}</b> · wychowawca: <b>${esc(i.wychowawca)}</b><br>🏫 ${esc(szkola[0].replace(/,\s*$/, ""))}${szkola.length > 2 ? " · " + esc(szkola[2]) : ""}</p>` +
        `<p>🍀 Szczęśliwy numerek: <b>${esc(num)}</b>${String(num) === String(i.numer_w_klasie) ? " — 🎉 <b>to Twój numer, dziś nie będziesz pytany!</b>" : ""}</p></div>`,
      "ha-markdown wizytowka").replace('class="ha-card', `style="background:${gradient}" class="ha-card`);
    },
    alerty(k, S, E) {
      const dzis = ymd(dzis0()), jutro = ymd(plusDni(dzis0(), 1));
      const zd = A(S, E["sensor.terminarz"]).zdarzenia || [];
      let h = "";
      zd.filter((z) => z.data === dzis && z.rodzaj === "dzien_wolny").forEach((z) => { h += `<ha-alert alert-type="success" title="Dziś wolne 🏖️">${esc(z.przedmiot)}</ha-alert>`; });
      zd.filter((z) => [dzis, jutro].includes(z.data) && ["sprawdzian", "kartkowka"].includes(z.rodzaj)).forEach((z) => {
        h += `<ha-alert alert-type="error" title="${z.data === dzis ? "Dziś" : "Jutro"}: ${esc(z.tytul)} – ${esc(z.przedmiot)}">${esc(z.szczegoly.Opis || "")}</ha-alert>`;
      });
      if (st(S, E["binary_sensor.obowiazki_szkolne_nauka"]) === "on") {
        const dn = A(S, E["binary_sensor.obowiazki_szkolne_nauka"]).sprawdziany_do_nauki || 0;
        h += `<ha-alert alert-type="warning" title="Czas na naukę 📚">${dn > 0 ? "Sprawdziany do przygotowania: " + dn : "Zbliżają się sprawdziany – warto zacząć powtórki."}</ha-alert>`;
      }
      if (A(S, E["sensor.oceny"]).sa_nowe_oceny) h += `<ha-alert alert-type="info" title="Nowe oceny 🆕">Sprawdź sekcję „Oceny”.</ha-alert>`;
      const nieprz = A(S, E["sensor.wiadomosci"]).liczba_nieprzeczytanych || 0;
      if (nieprz > 0) h += `<ha-alert alert-type="info" title="Nieprzeczytane wiadomości ✉️">${nieprz} – zobacz sekcję „Wiadomości”.</ha-alert>`;
      const uw = A(S, E["sensor.uwagi_o_zachowaniu"]);
      if (uw.sa_nowe_uwagi) h += `<ha-alert alert-type="warning" title="Nowa uwaga">${esc((uw.ostatnia || {}).tresc)}</ha-alert>`;
      return md(h || `<ha-alert alert-type="success">Wszystko pod kontrolą – brak pilnych spraw na dziś i jutro ✅</ha-alert>`);
    },
    kafle(k, S, E) {
      const sr = parseFloat(st(S, E["sensor.srednia_ocen"])), fr = A(S, E["sensor.frekwencja"]), oc = A(S, E["sensor.oceny"]);
      const za = A(S, E["sensor.zachowanie"]), wi = A(S, E["sensor.wiadomosci"]);
      const testy = (A(S, E["sensor.terminarz"]).zdarzenia || []).filter((z) => ["sprawdzian", "kartkowka"].includes(z.rodzaj) && ddiff(z.data) >= 0);
      const w7 = testy.filter((z) => ddiff(z.data) <= 7), min = testy.length ? Math.min(...testy.map((z) => ddiff(z.data))) : 99;
      const kafel = (ikona, kol, prim, sec, odznaka) => `<div class="ha-card mushroom"><div class="mush-ikona" style="--k:${KOLORY_MUSHROOM[kol] || kol}"><ha-icon icon="${ikona}"></ha-icon>${odznaka ? `<span class="mush-odznaka"><ha-icon icon="${odznaka}"></ha-icon></span>` : ""}</div><div class="mush-prim">${esc(prim)}</div><div class="mush-sec">${esc(sec)}</div></div>`;
      const f = fr.frekwencja_procent || 0;
      return `<div class="ha-grid-3">` +
        kafel("mdi:chart-line", sr >= 4.5 ? "green" : sr >= 3.5 ? "light-green" : sr >= 2.5 ? "amber" : sr >= 1.75 ? "orange" : "red", st(S, E["sensor.srednia_ocen"]), `Średnia · sem. ${A(S, E["sensor.srednia_ocen"]).semestr}`) +
        kafel("mdi:account-check", f >= 90 ? "green" : f >= 80 ? "amber" : "red", `${f.toFixed(1)}%`, `Frekwencja · nb ${fr.liczba_nieobecnosci || 0} · sp ${fr.liczba_spoznien || 0}`) +
        kafel("mdi:numeric", "blue", String(oc.liczba_ocen || 0), `Ocen · ${oc.liczba_przedmiotow || 0} przedm.`, oc.sa_nowe_oceny ? "mdi:new-box" : "") +
        kafel("mdi:account-star", (za.liczba_wpisow_negatywnych || 0) > 0 ? "red" : "purple", st(S, E["sensor.zachowanie"]), `Zachowanie · +${za.liczba_wpisow_pozytywnych || 0} / −${za.liczba_wpisow_negatywnych || 0}`) +
        kafel("mdi:email", (wi.liczba_nieprzeczytanych || 0) > 0 ? "red" : "blue", String(wi.liczba_nieprzeczytanych || 0), "Nieprzeczytane wiad.") +
        kafel("mdi:file-document-edit", min <= 2 ? "red" : min <= 7 ? "orange" : "grey", String(w7.length), testy.length ? `${testy[0].przedmiot} · ${fmtd(testy[0].data)}` : "Testy w 7 dni") +
        `</div>`;
    },
    plan(k, S, E) {
      const dni = A(S, E["sensor.plan_lekcji"]).kolejne_7_dni || [], dzis = ymd(dzis0());
      let otwarty = false;
      return md(dni.map((d) => {
        const l = d.lekcje || [], otworz = !otwarty && l.length > 0;
        if (otworz) otwarty = true;
        const wiersze = l.map((x) => `<tr><td class="c">${x.numer}</td><td>${x.godzina_od}–${x.godzina_do}</td><td>${x.odwolana ? `❌ <s>${esc(x.przedmiot)}</s>` : x.zastepstwo ? `🔄 <font color="#1e88e5"><b>${esc(x.przedmiot)}</b></font>` : x.zdarzenie ? `📝 <font color="#e53935"><b>${esc(x.przedmiot)}</b></font> <i>(${esc(x.zdarzenie)})</i>` : `<b>${esc(x.przedmiot)}</b>`}</td><td>${esc(x.nauczyciel_i_sala)}</td></tr>`).join("");
        return `<details${otworz ? " open" : ""}><summary><b>${d.data === dzis ? "📍 " : ""}${esc(cap(d.dzien_tygodnia.toLowerCase()))}</b> ${fmtd(d.data)}${l.length ? ` · ${l.length} lekcji · ${l[0].godzina_od}–${l[l.length - 1].godzina_do}` : " · wolne"}</summary>` +
          (l.length ? `<table><thead><tr><th class="c">#</th><th>Godz.</th><th>Przedmiot</th><th>Sala / nauczyciel</th></tr></thead><tbody>${wiersze}</tbody></table>` : "<p><i>Brak lekcji</i></p>") + `</details>`;
      }).join(""));
    },
    tematy(k, S, E) {
      const t = A(S, E["sensor.tematy_lekcji"]), lek = t.lekcje_ostatniego_dnia || [];
      const ik = { ob: "✅", nb: "❌", u: "🟦", sp: "⏰", zw: "🏃", ns: "⚠️" };
      let h = lek.length ? `<p><b>${esc(lek[0].dzien_tygodnia)} ${esc(t.ostatni_dzien)}</b></p><table><thead><tr><th class="c">#</th><th>Przedmiot</th><th>Temat</th><th></th></tr></thead><tbody>` +
        lek.map((l) => `<tr><td class="c">${l.numer}</td><td><b>${esc(l.przedmiot)}</b>${l.zastepstwo ? ` 🔄 <i>${esc(l.zastepca)}</i>` : ""}</td><td>${esc(l.temat)}</td><td class="c">${ik[l.obecnosc] || esc(l.obecnosc)}</td></tr>`).join("") + `</tbody></table>` : "Brak zapisanych tematów.";
      const nb = t.nieobecnosci || [];
      if (nb.length) h += `<ha-alert alert-type="warning" title="Nieobecności na lekcjach">${nb.slice(0, 6).map((l) => `${esc(l.data)} · ${esc(l.przedmiot)} (${esc(l.obecnosc_opis)})`).join("<br>")}</ha-alert>`;
      return md(h);
    },
    nadchodzace(k, S, E) {
      const ikony = { sprawdzian: "🔴", kartkowka: "🟠", dzien_wolny: "🏖️", wydarzenie: "📌", nieobecnosc_nauczyciela: "👤" };
      const pozycje = (A(S, E["sensor.terminarz"]).zdarzenia || []).filter((z) => ddiff(z.data) >= 0).map((z) => {
        const d = ddiff(z.data), test = ["sprawdzian", "kartkowka"].includes(z.rodzaj);
        const kiedy = d === 0 ? "dziś" : d === 1 ? "jutro" : `za ${d} dni`, kol = test && d <= 2 ? "#e53935" : test && d <= 7 ? "#fb8c00" : "#9e9e9e";
        const opis = z.szczegoly.Opis;
        return `<p>${ikony[z.rodzaj] || "📎"} <b>${esc(test ? z.tytul : z.przedmiot)}</b>${test ? " · " + esc(z.przedmiot) : ""}<br><font color="${kol}"><b>${kiedy}</b></font> · ${DNI_KR[pd(z.data).getDay()]} ${fmtd(z.data)}${z.numer_lekcji !== "unknown" && z.numer_lekcji ? " · lekcja " + esc(z.numer_lekcji) : ""}${z.godzina !== "unknown" ? " · " + esc(z.godzina) : ""}${opis ? `<br><i>${esc(opis)}</i>` : ""}</p>`;
      });
      return md(pozycje.join("") || "Brak nadchodzących wydarzeń 🎈");
    },
    oceny(k, S, E) {
      const oc = A(S, E["sensor.oceny"]).oceny_wg_przedmiotu || {}, sr = A(S, E["sensor.srednia_ocen"]).srednie_wg_przedmiotow || {};
      const slabe = Object.keys(sr).sort().filter((p) => sr[p] > 0 && sr[p] < 2.5), mocne = Object.keys(sr).sort().filter((p) => sr[p] >= 4.5);
      return md((slabe.length ? `<ha-alert alert-type="warning" title="Wymaga uwagi">${esc(slabe.join(", "))}</ha-alert>` : "") +
        (mocne.length ? `<ha-alert alert-type="success" title="Najmocniejsze strony 🌟">${esc(mocne.join(", "))}</ha-alert>` : "") +
        `<table><thead><tr><th>Przedmiot</th><th>Oceny</th><th>Średnia</th></tr></thead><tbody>` +
        Object.keys(oc).sort().map((p) => `<tr><td>${esc(cap(p))}</td><td>${oc[p].map((o) => ocena(o.ocena, o.jest_nowa)).join(" ")}</td><td class="nw">${sredniaHtml(sr[p])}</td></tr>`).join("") + `</tbody></table>`);
    },
    oceny_najnowsze(k, S, E) {
      const oc = A(S, E["sensor.oceny"]).oceny_wg_przedmiotu || {};
      const all = Object.entries(oc).flatMap(([p, l]) => l.map((o) => Object.assign({ przedmiot: p }, o))).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
      return md(all.map((o) => `<details><summary>${ocena(o.ocena, o.jest_nowa)} &nbsp;<b>${esc(cap(o.przedmiot))}</b> · ${esc(o.kategoria)} · ${fmtd(o.data)}</summary><p>${o.komentarz ? "💬 " + esc(o.komentarz) + "<br>" : ""}👩‍🏫 ${esc(o.nauczyciel)}</p></details>`).join("") || "Brak ocen.");
    },
    wykres_sredniej(k, S, E) {
      const kol = (k.series && k.series[0] && k.series[0].color) || "var(--demo-acc)";
      const cel = parseFloat(st(S, E["sensor.srednia_ocen"])) || 4.5;
      const pkt = Array.from({ length: 30 }, (_, i) => Math.max(1, Math.min(6, cel - 0.35 * Math.exp(-i / 9) + 0.05 * Math.sin(i / 2.5))));
      const W = 400, H = 150, x = (i) => 30 + i * (W - 40) / 29, y = (v) => 10 + (6 - v) * (H - 30) / 5;
      const linia = pkt.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      const siatka = [1, 2, 3, 4, 5, 6].map((v) => `<line x1="30" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(128,128,128,.15)"/><text x="22" y="${y(v) + 3}" text-anchor="end" class="apex-os">${v.toFixed(1)}</text>`).join("");
      return karta(`<div class="apex-tytul">${esc(k.header && k.header.title)}</div><div class="apex-stan" style="color:${kol}">${cel.toFixed(2)} <small>Średnia</small></div>` +
        `<svg viewBox="0 0 ${W} ${H}" width="100%">${siatka}<polygon points="30,${y(1)} ${linia} ${x(29)},${y(1)}" fill="${kol}" fill-opacity=".18"/><polyline points="${linia}" fill="none" stroke="${kol}" stroke-width="3" stroke-linejoin="round"/></svg>`, "apex");
    },
    zachowanie(k, S, E) {
      const s = st(S, E["sensor.zachowanie"]), z = A(S, E["sensor.zachowanie"]), u = A(S, E["sensor.uwagi_o_zachowaniu"]);
      const oceny = [["Przewidywana (okres 1)", z.ocena_przewidywana_okres_1], ["Śródroczna", z.ocena_srodroczna], ["Przewidywana (okres 2)", z.ocena_przewidywana_okres_2], ["Roczna", z.ocena_roczna]].filter((x) => x[1]);
      const wpisy = (z.wpisy || []).slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
      const uw = (u.uwagi || []).slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6);
      return md(`<p><b>Punkty:</b> ${esc(s)}${z.punkty_startowe != null ? ` (start: ${z.punkty_startowe})` : ""}${z.suma_okres_1 != null ? ` · okres 1: <b>${z.suma_okres_1}</b> · okres 2: <b>${z.suma_okres_2 == null ? "None" : z.suma_okres_2}</b>` : ""}</p>` +
        `<ul>${oceny.map((o) => `<li>🏅 ${o[0]}: <b>${esc(o[1])}</b></li>`).join("")}${wpisy.map((w) => `<li>${w.typ === "pozytywny" ? "👍" : "👎"} <b>${w.punkty}</b> · ${esc(w.kategoria)} · ${esc(w.data)}${w.komentarz ? ` — <i>${esc(w.komentarz)}</i>` : ""}</li>`).join("")}</ul>` +
        `<p><b>Uwagi:</b> 👍 ${u.liczba_pozytywnych || 0} · 👎 ${u.liczba_negatywnych || 0} · ➖ ${u.liczba_neutralnych || 0}</p>` +
        uw.map((x) => `<details><summary>${x.rodzaj === "pozytywna" ? "👍" : x.rodzaj === "negatywna" ? "👎" : "➖"} <b>${esc(x.kategoria)}</b> · ${esc(x.data)}</summary><p>${esc(x.tresc)}<br><font color="#9e9e9e">${esc(x.nauczyciel)}</font></p></details>`).join(""));
    },
    ogloszenia(k, S, E) {
      const ogl = A(S, E["sensor.ogloszenia"]).lista_ogloszen || [];
      return md(ogl.slice(0, 6).map((o) => `<details><summary>📢 <b>${esc(o.tytul)}</b><br><font color="#9e9e9e">${esc(o.nadawca)} · ${esc(o.data)}</font></summary><p>${esc(o.opis)}</p></details>`).join("") || "Brak nowych ogłoszeń 📭");
    },
    wiadomosci(k, S, E) {
      const msgs = A(S, E["sensor.wiadomosci"]).wiadomosci || [];
      return md(msgs.map((m) => `<details><summary>${m.nieprzeczytana ? "🔴" : m.jest_nowa ? "🆕" : "✉️"} <b>${esc(m.temat)}</b>${m.ma_zalacznik ? " 📎" : ""}<br><font color="#9e9e9e">${esc(m.nadawca.replace(/\s*\([^)]*\)/, ""))} · ${fmtd(m.data)} ${m.data.slice(11, 16)}</font></summary><p>${esc(m.tresc)}</p></details>`).join("") || "Brak wiadomości 📭");
    },
    kalendarz(k, S, E) {
      const d0 = dzis0(), pierwszy = new Date(d0.getFullYear(), d0.getMonth(), 1);
      const start = plusDni(pierwszy, -((pierwszy.getDay() + 6) % 7));
      const zd = A(S, E["sensor.terminarz"]).zdarzenia || [];
      const mies = d0.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
      let komorki = "";
      for (let i = 0; i < 35; i++) {
        const d = plusDni(start, i), data = ymd(d), ev = zd.filter((z) => z.data === data);
        komorki += `<div class="kal-dzien${d.getMonth() !== d0.getMonth() ? " inny" : ""}${data === ymd(d0) ? " dzis" : ""}"><span>${d.getDate()}</span>${roboczy(d) ? `<i class="kal-ev plan">lekcje</i>` : ""}${ev.map((z) => `<i class="kal-ev">${esc(z.rodzaj === "sprawdzian" || z.rodzaj === "kartkowka" ? z.tytul + " " + z.przedmiot : z.przedmiot)}</i>`).join("")}</div>`;
      }
      return karta(`<div class="kal-naglowek">${esc(cap(mies))}</div><div class="kal-siatka">${["pon", "wt", "śr", "czw", "pt", "sob", "ndz"].map((x) => `<div class="kal-dn">${x}</div>`).join("")}${komorki}</div>`, "kalendarz");
    },
    ai_raporty(k, S, E) {
      const t = (klucz) => A(S, E[klucz])["pełny_tekst"] || st(S, E[klucz]);
      const kiedy = (klucz) => { const d = new Date(st(S, E[klucz])); return isNaN(d) ? "—" : `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
      const mdTekst = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n\n/g, "<br><br>");
      return md(`<details open><summary>👨‍👩‍👦 <b>Podsumowanie tygodnia – dla rodzica</b> <font color="#9e9e9e">(${kiedy("button.generuj_podsumowanie_ai")})</font></summary><p>${mdTekst(t("sensor.podsumowanie_ai_rodzic"))}</p></details>` +
        `<details><summary>🧒 <b>Wersja dla ucznia</b></summary><p>${mdTekst(t("sensor.podsumowanie_ai_uczen"))}</p></details>` +
        `<details><summary>✉️ <b>Podsumowanie wiadomości</b> <font color="#9e9e9e">(${kiedy("button.generuj_podsumowanie_wiadomosci_ai")})</font></summary><p>${mdTekst(t("sensor.podsumowanie_wiadomosci_ai_rodzic"))}</p></details>`);
    },
  };

  function todo(k, S) {
    const poz = A(S, k.entity).pozycje || [];
    return karta(`<div class="todo-tytul">${esc(k.title)}</div>` + poz.map(([tekst, gotowe, termin]) =>
      `<div class="todo-poz${gotowe ? " gotowe" : ""}"><i class="mdi ${gotowe ? "mdi-checkbox-marked" : "mdi-checkbox-blank-outline"}"></i><span>${esc(tekst)}${termin ? `<small>${DNI_KR[pd(termin).getDay()]} ${fmtd(termin)}</small>` : ""}</span></div>`).join(""), "todo");
  }

  function kafelek(k) {
    return karta(`<ha-icon icon="${esc(k.icon || "mdi:gesture-tap-button")}"></ha-icon><div class="tile-nazwa">${esc(k.name || "")}</div><div class="tile-stan">Naciśnij</div>`, "tile");
  }

  // Karta elementu: button-card prawdziwym kodem, pozostałe z makiet
  function renderujKarte(id, k, S, E) {
    try {
      if (k.type === "custom:button-card") return buttonCard(k, S);
      if (k.type === "heading") return naglowek(k, S);
      if (k.type === "todo-list") return todo(k, S);
      if (k.type === "tile") return kafelek(k);
      if (MAKIETY[id]) return MAKIETY[id](k, S, E);
      return karta(`<div class="ha-md"><i>${esc(k.type)}</i></div>`);
    } catch (blad) {
      console.error("Podgląd karty", id, blad);
      return karta(`<div class="ha-md"><ha-alert alert-type="error" title="Nie udało się narysować podglądu">${esc(blad.message)}</ha-alert></div>`);
    }
  }

  // Sekcje widoku (z generateDashboardPreview) -> HTML w stylu HA
  function renderujSekcje(sekcje, uczen) {
    const S = stany(uczen), E = uczen.encje || {};
    return sekcje.map((s) => {
      let h = s.tytul ? naglowek(s.tytul, S) : "";
      s.grupy.forEach((g) => {
        if (g.naglowek) h += naglowek(g.naglowek, S);
        const kafle = g.elementy.filter((e) => e.karta.type === "tile");
        g.elementy.filter((e) => e.karta.type !== "tile").forEach((e) => { h += renderujKarte(e.id, e.karta, S, E); });
        if (kafle.length) h += `<div class="ha-grid-3">${kafle.map((e) => renderujKarte(e.id, e.karta, S, E)).join("")}</div>`;
      });
      return `<div class="ha-sekcja${s.szeroka ? " szeroka" : ""}">${h}</div>`;
    }).join("");
  }

  window.LibrusDemo = { stany, renderujSekcje, renderujKarte };
})();
