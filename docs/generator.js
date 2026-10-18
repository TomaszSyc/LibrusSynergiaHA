/**
 * Librus Synergia HA - Dashboard Generator
 * Generator panelu Lovelace, podglądu na żywo i automatyzacji dla Home Assistant.
 */

// Pomocnik do tworzenia prefiksu encji w stylu Home Assistant
function slugifyEntity(imieNazwisko) {
  if (!imieNazwisko || !imieNazwisko.trim()) return "librus_uczen";
  let t = imieNazwisko.trim().toLowerCase().replace(/ł/g, "l");
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let slug = t.replace(/[^a-z0-9]/g, "_");
  let parts = slug.split("_").filter(x => x.length > 0);
  return "librus_" + parts.join("_");
}

function getShortName(imieNazwisko) {
  if (!imieNazwisko || !imieNazwisko.trim()) return "Uczeń";
  return imieNazwisko.trim().split(/\s+/)[0];
}

function detectGenderIcon(krotkaNazwa) {
  if (!krotkaNazwa) return "mdi:face-man";
  const lower = krotkaNazwa.toLowerCase();
  const meskieWyjatki = ["kuba", "barnaba", "jarema", "kosma", "bonawentura"];
  if (lower.endsWith("a") && !meskieWyjatki.includes(lower)) {
    return "mdi:face-woman";
  }
  return "mdi:face-man";
}

// ===================================================================
// Kreator dashboardu: elementy z dashboard-templates.js
// (budowane przez scripts/build_dashboard_templates.py)
// ===================================================================

// Encje używane przez szablony. Klucz pochodzi z szablonu, a sufiksy to nazwy
// encji w Home Assistant (pierwszy jest domyślny, kolejne służą do
// automatycznego dopasowania z wklejonej listy encji).
const DASH_ENCJE = [
  { klucz: "sensor.informacje_o_uczniu", nazwa: "Informacje o uczniu" },
  { klucz: "sensor.szczesliwy_numerek", nazwa: "Szczęśliwy numerek" },
  { klucz: "sensor.srednia_ocen", nazwa: "Średnia ocen" },
  { klucz: "sensor.oceny", nazwa: "Oceny" },
  { klucz: "sensor.frekwencja", nazwa: "Frekwencja" },
  { klucz: "sensor.terminarz", nazwa: "Terminarz" },
  { klucz: "sensor.plan_lekcji", nazwa: "Plan lekcji" },
  { klucz: "sensor.tematy_lekcji", nazwa: "Tematy lekcji" },
  { klucz: "sensor.wiadomosci", nazwa: "Wiadomości" },
  { klucz: "sensor.ogloszenia", nazwa: "Ogłoszenia" },
  { klucz: "sensor.zachowanie", nazwa: "Zachowanie" },
  { klucz: "sensor.uwagi_o_zachowaniu", nazwa: "Uwagi", sufiksy: ["uwagi", "uwagi_o_zachowaniu"] },
  { klucz: "sensor.podsumowanie_ai_rodzic", nazwa: "Podsumowanie AI (rodzic)" },
  { klucz: "sensor.podsumowanie_ai_uczen", nazwa: "Podsumowanie AI (uczeń)" },
  { klucz: "sensor.podsumowanie_wiadomosci_ai_rodzic", nazwa: "Podsumowanie wiadomości AI (rodzic)" },
  { klucz: "binary_sensor.obowiazki_szkolne_nauka", nazwa: "Obowiązki szkolne (nauka)", sufiksy: ["obowiazki_szkolne_nauka", "nauka_odrobiona"] },
  { klucz: "todo.zadania_domowe_to_do", nazwa: "Lista: zadania domowe" },
  { klucz: "todo.przygotowanie_do_lekcji_to_do", nazwa: "Lista: przygotowanie do lekcji" },
  { klucz: "calendar.plan_lekcji_kalendarz", nazwa: "Kalendarz: plan lekcji" },
  { klucz: "calendar.terminarz_kalendarz", nazwa: "Kalendarz: terminarz" },
  { klucz: "button.odswiez_dane", nazwa: "Przycisk: odśwież dane" },
  { klucz: "button.generuj_podsumowanie_ai", nazwa: "Przycisk: raport AI" },
  { klucz: "button.generuj_podsumowanie_wiadomosci_ai", nazwa: "Przycisk: podsumowanie wiadomości AI" },
];

const DASH_PALETY = [
  { id: "indygo", nazwa: "Indygo", acc: "#3f51b5", c1: "#3949ab", c2: "#1e88e5" },
  { id: "morski", nazwa: "Morski", acc: "#00897b", c1: "#00897b", c2: "#43a047" },
  { id: "fiolet", nazwa: "Fiolet", acc: "#8e24aa", c1: "#8e24aa", c2: "#d81b60" },
  { id: "zachod", nazwa: "Zachód słońca", acc: "#ef6c00", c1: "#e65100", c2: "#ff8f00" },
  { id: "malina", nazwa: "Malina", acc: "#d81b60", c1: "#ad1457", c2: "#ec407a" },
  { id: "grafit", nazwa: "Grafit", acc: "#546e7a", c1: "#37474f", c2: "#607d8b" },
];

const DASH_EMOJI = ["🧑‍🎓", "👦", "👧", "🧒", "👨‍🎓", "👩‍🎓"];

const DASH_KARTY_HACS = {
  "button-card": { nazwa: "button-card", url: "https://github.com/custom-cards/button-card" },
  "mushroom": { nazwa: "Mushroom", url: "https://github.com/piitaya/lovelace-mushroom" },
  "apexcharts-card": { nazwa: "ApexCharts Card", url: "https://github.com/RomRider/apexcharts-card" },
  "card-mod": { nazwa: "card-mod", url: "https://github.com/thomasloven/lovelace-card-mod", opcjonalna: true },
};

function dashSzablony() {
  if (!window.LIBRUS_DASH_TEMPLATES) throw new Error("Brak szablonów dashboardu (dashboard-templates.js)");
  return window.LIBRUS_DASH_TEMPLATES;
}

// Sekcje z elementami do wyboru w kreatorze (bez treści kart)
function dashKatalog() {
  return dashSzablony().sekcje.map(s => ({
    nazwa: s.nazwa,
    elementy: s.grupy.flatMap(g => g.elementy.map(e => ({ id: e.id, nazwa: e.nazwa, opis: e.opis, wymaga: e.wymaga }))),
  }));
}

function dashDomyslnaEncja(klucz, fullName) {
  const def = DASH_ENCJE.find(e => e.klucz === klucz);
  const [domena, sufiksSzablonu] = klucz.split(".");
  const sufiks = def && def.sufiksy ? def.sufiksy[0] : sufiksSzablonu;
  return `${domena}.${slugifyEntity(fullName)}_${sufiks}`;
}

function dashDomyslneEncje(fullName) {
  const wynik = {};
  DASH_ENCJE.forEach(e => { wynik[e.klucz] = dashDomyslnaEncja(e.klucz, fullName); });
  return wynik;
}

// Dopasuj identyfikatory encji ucznia z wklejonej listy (np. z Narzędzia deweloperskie → Stany).
// Zwraca tylko znalezione klucze.
function dashDopasujEncje(tekst, fullName) {
  const lista = Array.from(new Set((tekst || "").toLowerCase().match(/\b[a-z_]+\.[a-z0-9_]+\b/g) || []));
  const slug = slugifyEntity(fullName);
  const wynik = {};
  DASH_ENCJE.forEach(e => {
    const [domena, sufiksSzablonu] = e.klucz.split(".");
    const sufiksy = e.sufiksy || [sufiksSzablonu];
    for (const sufiks of sufiksy) {
      // Dowolny prefiks przed "librus_<uczen>_" (np. po zmianie nazwy urządzenia w HA)
      const wzor = new RegExp(`^${domena}\\.(?:[a-z0-9_]+_)?${slug}_${sufiks}$`);
      const trafienie = lista.find(id => wzor.test(id));
      if (trafienie) { wynik[e.klucz] = trafienie; break; }
    }
  });
  return wynik;
}

// Podstaw dane ucznia w szablonie (obiekt karty lub sekcji)
function dashPodstaw(obj, uczen) {
  const T = dashSzablony();
  const esc = v => JSON.stringify(String(v)).slice(1, -1);
  const paleta = uczen.paleta || DASH_PALETY[0];
  const cel = Number(String(uczen.cel || "").replace(",", "."));
  let s = JSON.stringify(obj);
  s = s.replace(/__HELPER_(\d+)__/g, (_, i) => esc(T.helpery[Number(i)]));
  s = s.replace(/__E\[([a-z_]+\.[a-z0-9_]+)\]__/g, (_, klucz) =>
    esc((uczen.encje && uczen.encje[klucz]) || dashDomyslnaEncja(klucz, uczen.fullName)));
  s = s.replace(/__IMIE__/g, () => esc(uczen.shortName || getShortName(uczen.fullName)))
    .replace(/__EMOJI__/g, () => esc(uczen.emoji || DASH_EMOJI[0]))
    .replace(/__ACC__/g, paleta.acc)
    .replace(/__C1__/g, paleta.c1)
    .replace(/__C2__/g, paleta.c2)
    .replace(/__GOAL__/g, String(cel > 0 && cel <= 6 ? cel : 4.75));
  return JSON.parse(s);
}

// Sekcje widoku jednego ucznia z wybranymi elementami
function dashSekcjeUcznia(uczen, wybrane) {
  const sekcje = [];
  dashSzablony().sekcje.forEach(s => {
    const karty = [];
    s.grupy.forEach(g => {
      const elementy = g.elementy.filter(e => wybrane.has(e.id));
      if (!elementy.length) return;
      if (g.naglowek) karty.push(g.naglowek);
      elementy.forEach(e => karty.push(e.karta));
    });
    if (!karty.length) return;
    if (s.tytul) karty.unshift(s.tytul);
    sekcje.push(dashPodstaw(Object.assign({}, s.sekcja, { cards: karty }), uczen));
  });
  return sekcje;
}

// Cały widok typu "sections" dla wszystkich uczniów
function generateDashboardView(uczniowie, wybrane, opcje = {}) {
  const zbior = new Set(wybrane);
  return {
    type: "sections",
    max_columns: 3,
    title: opcje.tytul || "Szkoła",
    path: opcje.sciezka || "szkola-librus",
    icon: "mdi:school",
    dense_section_placement: false,
    sections: uczniowie.flatMap(u => dashSekcjeUcznia(u, zbior)),
  };
}

// Każdy wybrany element osobno (do wklejenia jako pojedyncza karta)
function generateDashboardElements(uczniowie, wybrane) {
  const zbior = new Set(wybrane);
  const wynik = [];
  uczniowie.forEach(u => {
    dashSzablony().sekcje.forEach(s => {
      s.grupy.forEach(g => g.elementy.forEach(e => {
        if (!zbior.has(e.id)) return;
        wynik.push({
          uczen: u.shortName || getShortName(u.fullName),
          sekcja: s.nazwa,
          id: e.id,
          nazwa: e.nazwa,
          wymaga: e.wymaga,
          karta: dashPodstaw(e.karta, u),
        });
      }));
    });
  });
  return wynik;
}

// Struktura do podglądu: sekcje ucznia z nagłówkami i wybranymi elementami (po podstawieniu)
function generateDashboardPreview(uczen, wybrane) {
  const zbior = new Set(wybrane);
  return dashSzablony().sekcje.map((s, si) => {
    const grupy = s.grupy
      .map(g => ({ naglowek: g.naglowek, elementy: g.elementy.filter(e => zbior.has(e.id)).map(e => ({ id: e.id, nazwa: e.nazwa, karta: e.karta })) }))
      .filter(g => g.elementy.length);
    return { nazwa: s.nazwa, szeroka: !!s.sekcja.column_span, tytul: s.tytul, grupy, si };
  }).filter(s => s.grupy.length).map(s => dashPodstaw(s, uczen));
}

// Karty HACS potrzebne dla wybranych elementów
function dashWymaganeKarty(wybrane) {
  const zbior = new Set(wybrane);
  const wymagane = new Set();
  dashKatalog().forEach(s => s.elementy.forEach(e => {
    if (zbior.has(e.id)) e.wymaga.forEach(w => wymagane.add(w));
  }));
  return Object.keys(DASH_KARTY_HACS).filter(k => wymagane.has(k)).map(k => Object.assign({ id: k }, DASH_KARTY_HACS[k]));
}

// Generator Automatyzacji Powiadomień YAML
function generateAutomationsYaml(targetEntity, selectedEvents, students, panelUrl) {
  const notifyTarget = targetEntity.trim() || "notify.mobile_app_twoj_telefon";
  const slug = students.length > 0 ? slugifyEntity(students[0].fullName) : "librus_uczen";
  const automations = [];

  if (selectedEvents.ocena) {
    automations.push(`- alias: "Librus: Powiadomienie o nowej ocenie"
  description: "Wysyła powiadomienie push, gdy pojawi się nowa ocena w Librusie"
  mode: queued
  trigger:
    - platform: event
      event_type: librus_apix_nowa_ocena
  action:
    - service: ${notifyTarget}
      data:
        title: "🎓 {{ trigger.event.data.uczen }} - nowa ocena {{ trigger.event.data.ocena }}"
        message: >-
          {{ trigger.event.data.przedmiot }}
          Ocena: {{ trigger.event.data.ocena }}
          Kategoria: {{ trigger.event.data.kategoria }}
          Nauczyciel: {{ trigger.event.data.nauczyciel }}
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.wiadomosc) {
    automations.push(`- alias: "Librus: Powiadomienie o nowej wiadomości"
  description: "Wysyła powiadomienie push o nadejściu nowej wiadomości w Librusie"
  mode: single
  trigger:
    - platform: event
      event_type: librus_apix_nowa_wiadomosc
  action:
    - service: ${notifyTarget}
      data:
        title: "📬 {{ trigger.event.data.uczen }}: nowa wiadomość"
        message: >-
          Od: {{ trigger.event.data.nadawca }}
          Temat: {{ trigger.event.data.temat }}
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.uwaga) {
    automations.push(`- alias: "Librus: Powiadomienie o nowej uwadze"
  description: "Wysyła powiadomienie push, gdy nauczyciel wpisze nową uwagę"
  mode: single
  trigger:
    - platform: event
      event_type: librus_apix_nowa_uwaga
  action:
    - service: ${notifyTarget}
      data:
        title: >-
          {{ {'pozytywna': '🟢', 'negatywna': '🔴'}.get(trigger.event.data.rodzaj, 'ℹ️') }}
          {{ trigger.event.data.uczen }} - uwaga {{ trigger.event.data.rodzaj }}
        message: "{{ trigger.event.data.tresc }} ({{ trigger.event.data.nauczyciel }})"
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.nieobecnosc) {
    automations.push(`- alias: "Librus: Powiadomienie o nieobecności lub spóźnieniu"
  description: "Powiadamia o zmianie frekwencji ucznia"
  mode: single
  trigger:
    - platform: event
      event_type: librus_apix_nowa_nieobecnosc
  action:
    - service: ${notifyTarget}
      data:
        title: "🚸 {{ trigger.event.data.uczen }}: {{ trigger.event.data.opis or trigger.event.data.rodzaj }}"
        message: >-
          {{ trigger.event.data.dzien_tygodnia }} {{ trigger.event.data.data }},
          lekcja {{ trigger.event.data.numer }}: {{ trigger.event.data.przedmiot }}
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.zadanie) {
    automations.push(`- alias: "Librus: Powiadomienie o nowym zadaniu domowym"
  description: "Powiadamia o nowo zadanym zadaniu domowym w Librusie"
  mode: single
  trigger:
    - platform: event
      event_type: librus_apix_nowe_zadanie
  action:
    - service: ${notifyTarget}
      data:
        title: "📚 {{ trigger.event.data.uczen }}: nowe zadanie"
        message: "{{ trigger.event.data.przedmiot }} ({{ trigger.event.data.kategoria }}), termin: {{ trigger.event.data.termin }}"
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.zdarzenie) {
    automations.push(`- alias: "Librus: Powiadomienie o nowym sprawdzianie w terminarzu"
  description: "Wysyła powiadomienie o dodanym sprawdzianie lub klasówce"
  mode: single
  trigger:
    - platform: event
      event_type: librus_apix_nowe_zdarzenie
  action:
    - service: ${notifyTarget}
      data:
        title: "📅 {{ trigger.event.data.uczen }}: {{ trigger.event.data.tytul }}"
        message: "{{ trigger.event.data.przedmiot }} na dzień {{ trigger.event.data.data }} {{ trigger.event.data.godzina }}"
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.aiWeekly) {
    automations.push(`- alias: "Librus: Piątkowy Raport AI na telefon"
  description: "Generuje tygodniowy raport AI w piątek o 17:00 i wysyła push z linkiem do panelu"
  mode: single
  trigger:
    - platform: time
      at: "17:00:00"
  condition:
    - condition: time
      weekday:
        - fri
  action:
    - service: button.press
      target:
        entity_id: button.${slug}_generuj_podsumowanie_ai
    - wait_for_trigger:
        - platform: state
          entity_id: sensor.${slug}_podsumowanie_ai_rodzic
      timeout: "00:02:00"
      continue_on_timeout: false
    - service: ${notifyTarget}
      data:
        title: "🤖 Librus AI - Raport Tygodniowy"
        message: "{{ states('sensor.${slug}_podsumowanie_ai_rodzic') }}"
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  if (selectedEvents.aiMessages) {
    automations.push(`- alias: "Librus: Streszczenie Nowych Wiadomości AI"
  description: "Analizuje nowo odebrane wiadomości przez AI i wysyła push ze skrótem"
  mode: single
  trigger:
    - platform: state
      entity_id: sensor.${slug}_wiadomosci
  condition:
    - condition: template
      value_template: "{{ trigger.to_state.state | int > trigger.from_state.state | int }}"
  action:
    - service: button.press
      target:
        entity_id: button.${slug}_generuj_podsumowanie_wiadomosci_ai
    - wait_for_trigger:
        - platform: state
          entity_id: sensor.${slug}_podsumowanie_wiadomosci_ai_rodzic
      timeout: "00:02:00"
      continue_on_timeout: false
    - service: ${notifyTarget}
      data:
        title: "📬 Librus AI - Podsumowanie Wiadomości"
        message: "{{ states('sensor.${slug}_podsumowanie_wiadomosci_ai_rodzic') }}"
        data:
          clickAction: "/${panelUrl}/"
          url: "/${panelUrl}/"`);
  }

  return automations.join("\n\n");
}

// Presety Promptów AI
const PROMPT_PRESETS = {
  weeklyParent: `Jesteś życzliwym, mądrym asystentem rodzica. Przeanalizuj wyniki szkolne ucznia o imieniu {imie} z ostatnich dni i przygotuj eleganckie podsumowanie tygodnia dla rodzica.
Dzisiejsza data: {dzisiejsza_data}.

Dane z dziennika:
- Otrzymane oceny: {oceny}
- Frekwencja w semestrze: {frekwencja_semestr}
- Nieobecności i spóźnienia: {nieobecnosci}
- Nadchodzące sprawdziany i kartkówki: {sprawdziany}
- Zadania domowe: {zadania}
- Uwagi od nauczycieli: {uwagi}

Zasady raportu:
1. Zacznij od serdecznego wstępu i ogólnej oceny minionego tygodnia.
2. Wyróżnij sukcesy i pochwal dobre oceny.
3. Jeśli pojawiły się słabsze oceny, uwagi lub zbliżają się trudne sprawdziany, wskaż je taktownie jako obszary do wspólnego wsparcia.
4. Zadbaj o przejrzyste formatowanie w punktach z ikonami emoji.`,

  weeklyStudent: `Cześć {imie}! Jesteś wspaniałym uczniem, a ja jestem Twoim osobistym asystentem nauki. Oto podsumowanie Twojego tygodnia w szkole (dzisiaj jest {dzisiejsza_data}):

Twoje wyniki:
- Twoje ostatnie oceny: {oceny}
- Twoja frekwencja w semestrze: {frekwencja_semestr}
- Zapowiedziane sprawdziany: {sprawdziany}
- Zadania domowe: {zadania}
- Uwagi ze szkoły: {uwagi}

Napisz do {imie} krótki, motywujący list:
1. Pogratuluj zaangażowania i pochwal za każdą dobrą ocenę!
2. Przypomnij w przyjazny sposób o zbliżających się sprawdzianach, żeby nauka poszła gładko.
3. Dodaj dawkę pozytywnej energii na nadchodzący weekend! Użyj radosnych emoji.`,

  messagesParent: `Przeanalizuj wiadomości ze szkoły ucznia {imie} na dzień {dzisiejsza_data}.
Skrzynka wiadomości:
{wiadomosci}

Przygotuj dla rodzica zwięzłe, przejrzyste podsumowanie:
1. Wyróżnij najważniejsze informacje wymagające uwagi rodzica (np. zebrania, terminy, zgody, opłaty).
2. Jeśli w wiadomościach są zadania lub terminy dla ucznia, wypunktuj je z datami.
3. Pomiń wiadomości archiwalne niezwiązane z bieżącym tygodniem.`,

  messagesStudent: `Przeanalizuj wiadomości ze szkoły dla ucznia {imie} na dzień {dzisiejsza_data}:
{wiadomosci}

Przygotuj dla {imie} prostą listę zadań i ważnych ogłoszeń w punktach:
- O czym musisz pamiętać?
- Jakie terminy się zbliżają?
Pisz prosto, bezpośrednio i zwięźle.`
};

// Konwerter obiektu JavaScript do czytelnego YAML-a
// Zwykły tekst bez cudzysłowów tylko gdy YAML na pewno odczyta go jako tekst
const YAML_ZWYKLY = /^[A-Za-z_À-ɏ][A-Za-z0-9_À-ɏ .\/()+-]*$/;
const YAML_ZAREZERWOWANE = /^(true|false|yes|no|on|off|null|y|n)$/i;

function yamlKlucz(k) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : JSON.stringify(k);
}

function yamlTekst(s, indent) {
  if (s.includes("\n")) {
    // Blok dosłowny: |- bez końcowego \n, | z jednym, |+ z kilkoma
    const koncowe = s.length - s.replace(/\n+$/, "").length;
    const chomp = koncowe === 0 ? "-" : koncowe === 1 ? "" : "+";
    const tresc = koncowe === 1 ? s.slice(0, -1) : s;
    const linie = tresc.split("\n");
    // Wskaźnik wcięcia, gdy pierwsza linia zaczyna się od spacji
    const wskaznik = /^\s/.test(linie[0]) ? "2" : "";
    const pad = "  ".repeat(indent);
    return `|${wskaznik}${chomp}\n` + linie.map(l => (l.length ? pad + l : "")).join("\n");
  }
  if (s === "" || !YAML_ZWYKLY.test(s) || YAML_ZAREZERWOWANE.test(s) || s.endsWith(" ")) {
    return JSON.stringify(s);
  }
  return s;
}

function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") return yamlTekst(obj, indent);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return "\n" + obj.map(item => {
      if (typeof item === "object" && item !== null && !Array.isArray(item) && Object.keys(item).length) {
        return `${pad}- ${toYaml(item, indent + 1).trimStart()}`;
      }
      return `${pad}- ${toYaml(item, indent + 1)}`;
    }).join("\n");
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys.map(key => {
      const val = obj[key];
      const k = yamlKlucz(key);
      if (Array.isArray(val)) {
        return val.length ? `${pad}${k}:${toYaml(val, indent + 1)}` : `${pad}${k}: []`;
      }
      if (typeof val === "object" && val !== null) {
        return Object.keys(val).length ? `${pad}${k}:\n${toYaml(val, indent + 1)}` : `${pad}${k}: {}`;
      }
      return `${pad}${k}: ${toYaml(val, indent + 1)}`;
    }).join("\n");
  }

  return String(obj);
}

// Eksport globalny do przeglądarki
window.LibrusGenerator = {
  slugifyEntity,
  getShortName,
  detectGenderIcon,
  DASH_ENCJE,
  DASH_PALETY,
  DASH_EMOJI,
  dashKatalog,
  dashDomyslneEncje,
  dashDopasujEncje,
  dashWymaganeKarty,
  generateDashboardView,
  generateDashboardElements,
  generateDashboardPreview,
  generateAutomationsYaml,
  PROMPT_PRESETS,
  toYaml
};
