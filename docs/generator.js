/**
 * Librus Synergia HA - Dashboard Generator (v3.0)
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

// Szablony Jinja2 (zgodne z generuj_panel.py i nowościami v3.0)
const KOL = "{% set kol = {'6':'#2e7d32','5':'#43a047','4':'#7cb342','3':'#f9a825','2':'#ef6c00','1':'#c62828'} %}";

function planNextTpl(p) {
  return `{% set p = 'sensor.${p}_' %}
{% set dni = state_attr(p ~ 'plan_lekcji', 'kolejne_7_dni') or [] %}
{% set today = now().strftime('%Y-%m-%d') %}{% set hm = now().strftime('%H:%M') %}
{% set ns = namespace(d=none) %}
{% for d in dni if ns.d is none and d.lekcje | length > 0 %}{% if d.data > today or (d.data == today and hm < (d.lekcje | map(attribute='godzina_do') | select('match', '[0-9]') | list | last | default('00:00'))) %}{% set ns.d = d %}{% endif %}{% endfor %}
{% if ns.d is none %}Brak lekcji w najbliższych dniach 🎉{% else %}{% set d = ns.d %}
{% set jutro = (now() + timedelta(days=1)).strftime('%Y-%m-%d') %}
### {{ 'Dziś' if d.data == today else ('Jutro' if d.data == jutro else d.dzien_tygodnia) }} · {{ d.lekcje[0].godzina_od }}–{{ d.lekcje[-1].godzina_do }}
| | Godz. | Przedmiot | Sala |
|---|---|---|---|
{% for l in d.lekcje %}{% set teraz = d.data == today and l.godzina_od <= hm < l.godzina_do %}{% set ev = (l.get('zdarzenie') or '') | lower %}| {{ '▶' if teraz else (l.numer if l.numer is not none else 0) }} | {{ l.godzina_od }} | {% if l.get('odwolana') %}~~{{ l.przedmiot }}~~ ❌{% elif l.get('zastepstwo') %}**{{ l.przedmiot }}** 🔄{% else %}**{{ l.przedmiot }}**{% endif %}{% if l.get('dzd') %} <small>*dodatkowe*</small>{% endif %}{% if 'sprawdzian' in ev %} 🔴{% elif 'kartk' in ev %} 🟠{% elif ev %} 🔵{% endif %} | {{ (l.get('sala') or '') | replace('s. ','') }} |
{% endfor %}{% endif %}`;
}

function terminarzTpl(p, days, onlyTests = false) {
  const flt = onlyTests ? "{% if 'sprawdzian' in t or 'klasówka' in t or 'kartk' in t %}" : "{% if true %}";
  return `{% set zd = state_attr('sensor.${p}_terminarz','zdarzenia') or [] %}
{% set ns = namespace(n=0) %}
{% for z in zd | rejectattr('tytul','search','^(Nauczyciel:|Zastępstwo)') | sort(attribute='data') if z.get('rodzaj', '') not in ['nieobecnosc_nauczyciela','zastepstwo','przesuniecie','odwolanie'] %}{% set dd = (strptime(z.data,'%Y-%m-%d').date() - now().date()).days %}{% set t = z.tytul | lower %}{% if 0 <= dd <= ${days} %}${flt}{% set ns.n = ns.n + 1 %}{% set opis = z.szczegoly.Opis if z.szczegoly is mapping and z.szczegoly.Opis is defined and z.szczegoly.Opis != 'unknown' else '' %}
{{ {'sprawdzian':'🔴','kartkowka':'🟠','dzien_wolny':'🏖️','wydarzenie':'🔵'}.get(z.get('rodzaj', '')) or ('🔴' if 'sprawdzian' in t or 'klasówka' in t else ('🟠' if 'kartk' in t else ('🔵' if 'wydarzenie' in t else '📅'))) }} **{{ z.tydzien[:3] | lower }} {{ z.data[8:10] }}.{{ z.data[5:7] }}** <small>{{ 'dziś' if dd == 0 else ('jutro' if dd == 1 else 'za ' ~ dd ~ ' dni') }}</small> · **{{ z.przedmiot if z.przedmiot and z.przedmiot != 'unknown' else '' }}** {{ z.tytul }}{% if opis %}<br><small>{{ opis | replace('\\n', ' ') | truncate(120) }}</small>{% endif %}
{% endif %}{% endif %}{% endfor %}{% if ns.n == 0 %}Nic w ciągu ${days} dni ✅{% endif %}`;
}

function ostatnieOcenyTpl(p, n = 6) {
  return `{% set o = state_attr('sensor.${p}_oceny','oceny_wg_przedmiotu') or {} %}
{% set ns = namespace(l=[]) %}
{% for prz, lst in o.items() %}{% for g in lst %}{% set ns.l = ns.l + [{'p': prz, 'o': g.ocena, 'd': g.data, 'k': g.kategoria, 'n': g.jest_nowa, 'op': g.get('opis', '')}] %}{% endfor %}{% endfor %}
${KOL}
{% for g in (ns.l | sort(attribute='d', reverse=true))[:${n}] %}<font color="{{ kol.get(g.o[:1], '#9e9e9e') }}"><b>{{ g.o }}</b></font> **{{ g.p }}**{% if g.op %} – {{ g.op }}{% endif %} <small>{{ g.k }} · {{ g.d[8:10] }}.{{ g.d[5:7] }}</small>{{ ' 🆕' if g.n }}<br>
{% else %}Brak ocen w tym semestrze.{% endfor %}`;
}

function tabelaOcenTpl(p) {
  return `{% set o = state_attr('sensor.${p}_oceny','oceny_wg_przedmiotu') or {} %}{% set sr = state_attr('sensor.${p}_srednia_ocen','srednie_wg_przedmiotow') or {} %}
${KOL}
| Przedmiot | Oceny | Średnia |
|:---|:---|---:|
{% for prz in o.keys() | sort %}{% set s = sr.get(prz) %}| **{{ prz }}** | {% for g in o[prz] %}<font color="{{ kol.get(g.ocena[:1], '#9e9e9e') }}"><b>{{ g.ocena }}</b></font>{% if g.get('opis') %}<small> ({{ g.opis }})</small>{% endif %}{{ ' ' }}{% endfor %}| {% if s is number %}<font color="{{ '#43a047' if s >= 4.5 else ('#7cb342' if s >= 3.75 else ('#f9a825' if s >= 2.75 else '#c62828')) }}"><b>{{ '%.2f' | format(s) }}</b></font>{% else %}–{% endif %} |
{% endfor %}`;
}

function planTygodniaTpl(p) {
  return `{% set dni = state_attr('sensor.${p}_plan_lekcji', 'kolejne_7_dni') or [] %}
{% for d in dni if d.lekcje | length > 0 %}
#### {{ d.dzien_tygodnia }} {{ d.data[8:10] }}.{{ d.data[5:7] }} <small>· {{ d.lekcje[0].godzina_od }}–{{ d.lekcje[-1].godzina_do }}</small>
{% for l in d.lekcje %}{% set ev = (l.get('zdarzenie') or '') | lower %}\`{{ l.godzina_od }}\` {% if l.get('odwolana') %}~~{{ l.przedmiot }}~~ ❌{% elif l.get('zastepstwo') %}**{{ l.przedmiot }}** 🔄{% else %}{{ l.przedmiot }}{% endif %}{% if l.get('dzd') %} <small>*dodatkowe*</small>{% endif %}{% if 'sprawdzian' in ev %} 🔴{% elif 'kartk' in ev %} 🟠{% elif ev %} 🔵{% endif %} <small>{{ (l.get('sala') or '') | replace('s. ','') }}</small><br>
{% endfor %}
{% else %}Brak lekcji w najbliższym tygodniu.{% endfor %}`;
}

function tematyLekcjiTpl(p) {
  return `{% set lekcje = state_attr('sensor.${p}_tematy_lekcji', 'lekcje') or [] %}
{% for dzien, lista in lekcje | groupby('data') | reverse %}
#### {{ lista[0].dzien_tygodnia }} {{ dzien[8:10] }}.{{ dzien[5:7] }}
{% for l in lista %}\`{{ l.numer if l.numer is not none else '–' }}\` **{{ l.przedmiot }}**{% if l.zastepstwo %} 🔄 <small>{{ l.zastepca }}</small>{% endif %}{% if l.obecnosc in ['nb', 'u', 'sp', 'zw'] %} ❗**{{ l.obecnosc }}**{% endif %} – {{ l.temat | replace('\\n', ' ') }}<br>
{% endfor %}
{% else %}Brak zrealizowanych lekcji w ostatnich 7 dniach.{% endfor %}`;
}

function wiadomosciTpl(p) {
  return `{% set m = state_attr('sensor.${p}_wiadomosci','wiadomosci') or [] %}
{% for x in m if x.temat and x.temat != 'Brak' %}{{ '🔴' if x.nieprzeczytana else '⚪' }} **{{ x.temat | trim }}**{{ ' 📎' if x.ma_zalacznik }}<br><small>{{ x.nadawca.split(' (')[0] }} · {{ x.data[8:10] }}.{{ x.data[5:7] }} {{ x.data[11:16] }}</small>{% if x.tresc %}<details><summary>Treść</summary>{{ x.tresc }}</details>{% endif %}

{% else %}Brak wiadomości.{% endfor %}`;
}

function ogloszeniaTpl(p) {
  return `{% for a in state_attr('sensor.${p}_ogloszenia','lista_ogloszen') or [] %}<details><summary><b>{{ a.tytul }}</b> <small>· {{ a.data[8:10] }}.{{ a.data[5:7] }} · {{ a.nadawca }}</small></summary>

{{ a.opis }}
</details>
{% else %}Brak ogłoszeń.{% endfor %}`;
}

function uwagiTpl(p) {
  return `{% set u = state_attr('sensor.${p}_uwagi','lista_uwag') or [] %}{% set ik = {'Positive':'🟢','Negative':'🔴','Neutral':'⚪'} %}
{% for x in u %}{{ ik.get(x.typ, '⚪') }} **{{ x.data[8:10] }}.{{ x.data[5:7] }}** <small>{{ x.kategoria }}{{ ' · ' ~ x.nauczyciel if x.nauczyciel }}</small><br>{{ x.tresc }}

{% else %}Brak uwag ✅{% endfor %}`;
}

function aiWeeklyReportTpl(p) {
  return `{% set encja = 'sensor.${p}_podsumowanie_ai_rodzic' %}
{% set raport = state_attr(encja, 'pełny_tekst') %}
{% if raport %}
{{ raport }}
{% else %}
Asystent AI jeszcze nie przygotował raportu tygodniowego. Użyj przycisku poniżej, aby go wygenerować!
{% endif %}`;
}

function aiMessagesReportTpl(p) {
  return `{% set encja = 'sensor.${p}_podsumowanie_wiadomosci_ai_rodzic' %}
{% set raport = state_attr(encja, 'pełny_tekst') %}
{% if raport %}
{{ raport }}
{% else %}
Brak nowego podsumowania wiadomości. Kliknij przycisk poniżej, aby przeanalizować skrzynkę!
{% endif %}`;
}

// Generowanie widoku głównego dla ucznia
function buildKidOverviewCards(p, name, icon, panelUrl, options) {
  const s = `sensor.${p}_`;
  const detailAction = {
    action: "navigate",
    navigation_path: `/${panelUrl}/${p.replace(/_/g, "-")}`
  };

  const cards = [
    { type: "heading", heading: name, heading_style: "title", icon: icon },
    {
      type: "custom:mushroom-template-card",
      primary: `{{ states('${s}informacje_o_uczniu') }}`,
      secondary: `kl. {{ state_attr('${s}informacje_o_uczniu','klasa') }} · wych. {{ state_attr('${s}informacje_o_uczniu','wychowawca') }}`,
      icon: "mdi:account-school",
      icon_color: "blue",
      color: "blue",
      grid_options: { columns: 12 },
      tap_action: detailAction
    },
    {
      type: "custom:mushroom-template-card",
      primary: `{{ states('${s}srednia_ocen') }}`,
      secondary: "Średnia ocen",
      icon: "mdi:chart-line",
      icon_color: `{% set v = states('${s}srednia_ocen') | float(0) %}{{ 'green' if v >= 4.5 else ('light-green' if v >= 3.75 else ('amber' if v >= 2.75 else ('red' if v > 0 else 'grey'))) }}`,
      color: `{% set v = states('${s}srednia_ocen') | float(0) %}{{ 'green' if v >= 4.5 else ('light-green' if v >= 3.75 else ('amber' if v >= 2.75 else ('red' if v > 0 else 'grey'))) }}`,
      grid_options: { columns: 6 },
      tap_action: detailAction
    },
    {
      type: "custom:mushroom-template-card",
      primary: `{{ states('${s}szczesliwy_numerek') }}`,
      secondary: `{{ '🍀 To mój numer!' if states('${s}szczesliwy_numerek') | int(0) == state_attr('${s}informacje_o_uczniu','numer_w_klasie') | int(-1) else 'Szczęśliwy numerek (mój: ' ~ state_attr('${s}informacje_o_uczniu','numer_w_klasie') ~ ')' }}`,
      icon: "mdi:clover",
      icon_color: `{{ 'green' if states('${s}szczesliwy_numerek') | int(0) == state_attr('${s}informacje_o_uczniu','numer_w_klasie') | int(-1) else 'grey' }}`,
      grid_options: { columns: 6 },
      tap_action: { action: "none" }
    },
    {
      type: "custom:mushroom-template-card",
      primary: `{{ state_attr('${s}wiadomosci','liczba_nieprzeczytanych') | int(0) }}`,
      secondary: "Nieprzeczytane wiadomości",
      icon: "mdi:email",
      icon_color: `{{ 'red' if state_attr('${s}wiadomosci','liczba_nieprzeczytanych') | int(0) > 0 else 'grey' }}`,
      grid_options: { columns: 6 },
      tap_action: detailAction
    },
    {
      type: "custom:mushroom-template-card",
      primary: `{{ states('todo.${p}_zadania_domowe_to_do') }}`,
      secondary: "Zadania domowe",
      icon: "mdi:notebook-edit",
      icon_color: `{{ 'orange' if states('todo.${p}_zadania_domowe_to_do') | int(0) > 0 else 'grey' }}`,
      grid_options: { columns: 6 },
      tap_action: { action: "more-info", entity: `todo.${p}_zadania_domowe_to_do` }
    }
  ];

  if (options.enableStudyTodo) {
    cards.push({
      type: "custom:mushroom-template-card",
      primary: `{{ 'Sprawdziany odrobione 🎉' if is_state('binary_sensor.${p}_nauka_odrobiona', 'on') else 'Nauka do zaliczenia ⚠️' }}`,
      secondary: "Wyzwania do sprawdzianów",
      icon: "mdi:gamepad-variant",
      icon_color: `{{ 'green' if is_state('binary_sensor.${p}_nauka_odrobiona', 'on') else 'amber' }}`,
      grid_options: { columns: 12 },
      tap_action: { action: "more-info", entity: `todo.${p}_przygotowanie_do_lekcji_to_do` }
    });
  }

  if (options.enableUwagi) {
    cards.push({
      type: "custom:mushroom-template-card",
      primary: `{{ states('${s}uwagi') }}`,
      secondary: `Uwagi ze szkoły`,
      icon: "mdi:account-alert",
      icon_color: `{% set u = state_attr('${s}uwagi','lista_uwag') or [] %}{% set neg = u | selectattr('typ','eq','Negative') | list %}{{ 'red' if neg else ('green' if u | selectattr('typ','eq','Positive') | list else 'grey') }}`,
      grid_options: { columns: 6 },
      tap_action: detailAction
    });
  }

  cards.push({
    type: "custom:mushroom-template-card",
    primary: `{{ state_attr('${s}frekwencja','frekwencja_procent') | default('–', true) }}%`,
    secondary: `Frekwencja semestralna`,
    icon: "mdi:account-check",
    icon_color: `{% set v = state_attr('${s}frekwencja','frekwencja_procent') %}{{ 'grey' if v is none else ('green' if v >= 95 else ('amber' if v >= 85 else 'red')) }}`,
    grid_options: { columns: 6 },
    tap_action: detailAction
  });

  if (options.enableAi) {
    cards.push({
      type: "custom:mushroom-template-card",
      primary: `🤖 Raport AI Tygodnia`,
      secondary: `{{ states('sensor.${p}_podsumowanie_ai_rodzic') | truncate(60) }}`,
      icon: "mdi:robot",
      icon_color: "deep-purple",
      grid_options: { columns: 12 },
      tap_action: detailAction
    });
  }

  cards.push(
    { type: "heading", heading: "Plan lekcji", icon: "mdi:timetable", heading_style: "subtitle" },
    { type: "markdown", content: planNextTpl(p) },
    { type: "heading", heading: "Najbliższe 14 dni", icon: "mdi:calendar-alert", heading_style: "subtitle" },
    { type: "markdown", content: terminarzTpl(p, 14) },
    { type: "heading", heading: "Ostatnie oceny", icon: "mdi:star-circle", heading_style: "subtitle" },
    { type: "markdown", content: ostatnieOcenyTpl(p) },
    {
      type: "button",
      name: "Wszystkie szczegóły ucznia",
      icon: "mdi:arrow-right-circle",
      show_state: false,
      tap_action: detailAction,
      grid_options: { columns: 12, rows: 1 },
      icon_height: "24px"
    }
  );

  return { type: "grid", cards: cards };
}

// Generowanie podwidoku szczegółowego dla ucznia
function buildKidSubView(p, name, icon, panelUrl, options) {
  const s = `sensor.${p}_`;

  const sections = [
    {
      type: "grid",
      column_span: 3,
      cards: [
        { type: "heading", heading: "Kalendarz i Harmonogram", heading_style: "title", icon: "mdi:calendar" },
        {
          type: "calendar",
          initial_view: "dayGridMonth",
          grid_options: { columns: 36, rows: 8 },
          entities: [`calendar.${p}_terminarz_kalendarz`, `calendar.${p}_plan_lekcji_kalendarz`]
        }
      ]
    },
    {
      type: "grid",
      cards: [
        { type: "heading", heading: "Oceny i Wyniki", heading_style: "title", icon: "mdi:star-circle" },
        {
          type: "gauge",
          entity: `${s}srednia_ocen`,
          name: "Średnia",
          min: 1,
          max: 6,
          needle: true,
          severity: { red: 1, yellow: 2.75, green: 4.5 },
          grid_options: { columns: 6, rows: 3 }
        },
        {
          type: "tile",
          entity: `${s}frekwencja`,
          name: "Nieobecności",
          icon: "mdi:account-cancel",
          grid_options: { columns: 6, rows: 1 }
        },
        {
          type: "markdown",
          content: `Frekwencja: **{{ state_attr('${s}frekwencja','frekwencja_procent') | default('–', true) }}%**<br>Spóźnienia: **{{ state_attr('${s}frekwencja','liczba_spoznien') | int(0) }}** · nb: **{{ state_attr('${s}frekwencja','liczba_nieusprawiedliwionych') | int(0) }}** · u: **{{ state_attr('${s}frekwencja','liczba_usprawiedliwionych') | int(0) }}**`,
          grid_options: { columns: 6, rows: 2 }
        },
        { type: "markdown", content: tabelaOcenTpl(p) },
        {
          type: "history-graph",
          title: "Średnia w czasie",
          hours_to_show: 720,
          entities: [{ entity: `${s}srednia_ocen`, name: "Średnia" }]
        },
        { type: "heading", heading: "Zadania domowe", heading_style: "title", icon: "mdi:notebook-edit" },
        { type: "todo-list", entity: `todo.${p}_zadania_domowe_to_do`, hide_create: true },
        { type: "heading", heading: "Wiadomości", icon: "mdi:email", heading_style: "subtitle" },
        { type: "markdown", content: wiadomosciTpl(p) },
        { type: "heading", heading: "Ogłoszenia", icon: "mdi:bullhorn", heading_style: "subtitle" },
        { type: "markdown", content: ogloszeniaTpl(p) },
        {
          type: "tile",
          entity: `button.${p}_odswiez_dane`,
          name: "Odśwież dane z Librusa",
          icon: "mdi:refresh",
          tap_action: {
            action: "perform-action",
            perform_action: "button.press",
            target: { entity_id: `button.${p}_odswiez_dane` }
          }
        }
      ]
    }
  ];

  const col2Cards = [];
  if (options.enableAi) {
    col2Cards.push(
      { type: "heading", heading: "Raporty Sztucznej Inteligencji", heading_style: "title", icon: "mdi:robot" },
      {
        type: "custom:stack-in-card",
        cards: [
          { type: "custom:mushroom-title-card", title: "🤖 Raport Tygodniowy (AI)", subtitle: "Podsumowanie postępów dla rodzica" },
          { type: "markdown", content: aiWeeklyReportTpl(p) },
          {
            type: "button",
            entity: `button.${p}_generuj_podsumowanie_ai`,
            name: "Generuj nowy raport",
            icon: "mdi:robot-excited",
            tap_action: { action: "toggle" }
          }
        ]
      },
      {
        type: "custom:stack-in-card",
        cards: [
          { type: "custom:mushroom-title-card", title: "📬 Podsumowanie Wiadomości (AI)", subtitle: "Zestawienie komunikatów szkolnych" },
          { type: "markdown", content: aiMessagesReportTpl(p) },
          {
            type: "button",
            entity: `button.${p}_generuj_podsumowanie_wiadomosci_ai`,
            name: "Przeanalizuj wiadomości",
            icon: "mdi:message-processing",
            tap_action: { action: "toggle" }
          }
        ]
      }
    );
  }

  if (options.enableStudyTodo) {
    col2Cards.push(
      { type: "heading", heading: "Przygotowanie do lekcji (To-Do)", heading_style: "title", icon: "mdi:book-open-variant" },
      { type: "todo-list", entity: `todo.${p}_przygotowanie_do_lekcji_to_do`, hide_create: true }
    );
  }

  if (options.enableUwagi) {
    col2Cards.push(
      { type: "heading", heading: "Uwagi o zachowaniu", heading_style: "title", icon: "mdi:account-alert" },
      { type: "markdown", content: uwagiTpl(p) }
    );
  }

  col2Cards.push(
    { type: "heading", heading: "Tematy lekcji (7 dni)", heading_style: "title", icon: "mdi:book-open-page-variant" },
    { type: "markdown", content: tematyLekcjiTpl(p) }
  );

  sections.push({ type: "grid", cards: col2Cards });

  sections.push({
    type: "grid",
    cards: [
      { type: "heading", heading: "Sprawdziany i terminarz", heading_style: "title", icon: "mdi:calendar-alert" },
      { type: "markdown", content: terminarzTpl(p, 60) },
      { type: "heading", heading: "Plan na cały tydzień", heading_style: "title", icon: "mdi:timetable" },
      { type: "markdown", content: planTygodniaTpl(p) }
    ]
  });

  return {
    type: "sections",
    max_columns: 3,
    title: `Librus · ${name}`,
    path: p.replace(/_/g, "-"),
    icon: icon,
    subview: true,
    back_path: `/${panelUrl}/szkola`,
    sections: sections
  };
}

// Główna funkcja budująca obiekt Dashboardu
function generateDashboardConfig(students, panelUrl, options) {
  const studentData = students.map(s => {
    const fullName = s.fullName.trim();
    const shortName = s.shortName && s.shortName.trim() ? s.shortName.trim() : getShortName(fullName);
    const slug = slugifyEntity(fullName);
    const icon = s.icon || detectGenderIcon(shortName);
    return { fullName, shortName, slug, icon };
  });

  const overviewView = {
    type: "sections",
    max_columns: 3,
    title: "Szkoła",
    path: "szkola",
    icon: "mdi:school",
    header: {
      card: {
        type: "markdown",
        text_only: true,
        content: "# 🎒 Szkoła\n{% set d = ['poniedziałek','wtorek','środa','czwartek','piątek','sobota','niedziela'] %}{{ d[now().weekday()] | capitalize }}, {{ now().strftime('%d.%m.%Y') }}"
      }
    },
    sections: studentData.map(st => buildKidOverviewCards(st.slug, st.shortName, st.icon, panelUrl, options))
  };

  const subViews = studentData.map(st => buildKidSubView(st.slug, st.shortName, st.icon, panelUrl, options));

  return {
    title: "Szkoła",
    views: [overviewView, ...subViews]
  };
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
function toYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);

  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);

  if (typeof obj === "string") {
    if (obj.includes("\n")) {
      const lines = obj.split("\n");
      const blockPad = "  ".repeat(indent + 1);
      return "|\n" + lines.map(line => line.length > 0 ? blockPad + line : "").join("\n");
    }
    if (/[:#{}[\],&*?|<>=!%@`]/.test(obj) || obj.trim() !== obj) {
      return JSON.stringify(obj);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return "\n" + obj.map(item => {
      const itemPad = "  ".repeat(indent);
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const itemYaml = toYaml(item, indent + 1);
        const trimmed = itemYaml.trimStart();
        return `${itemPad}- ${trimmed}`;
      }
      return `${itemPad}- ${toYaml(item, indent + 1)}`;
    }).join("\n");
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    const lines = [];
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === "object" && val !== null) {
        if (Array.isArray(val)) {
          if (val.length === 0) {
            lines.push(`${pad}${key}: []`);
          } else {
            lines.push(`${pad}${key}:${toYaml(val, indent + 1)}`);
          }
        } else {
          lines.push(`${pad}${key}:\n${toYaml(val, indent + 1)}`);
        }
      } else {
        const valStr = toYaml(val, indent + 1);
        if (valStr.startsWith("|\n")) {
          lines.push(`${pad}${key}: ${valStr}`);
        } else {
          lines.push(`${pad}${key}: ${valStr}`);
        }
      }
    }
    return lines.join("\n");
  }

  return String(obj);
}

// Eksport globalny do przeglądarki
window.LibrusGenerator = {
  slugifyEntity,
  getShortName,
  detectGenderIcon,
  generateDashboardConfig,
  generateAutomationsYaml,
  PROMPT_PRESETS,
  toYaml
};
