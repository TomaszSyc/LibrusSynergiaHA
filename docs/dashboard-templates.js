// Wygenerowano przez scripts/build_dashboard_templates.py - nie edytuj recznie.
// Szablony elementow dashboardu Librus dla kreatora na stronie projektu.
window.LIBRUS_DASH_TEMPLATES = {
 "sekcje": [
  {
   "nazwa": "Uczeń",
   "sekcja": {
    "type": "grid",
    "column_span": 3
   },
   "tytul": null,
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "naglowek",
       "nazwa": "Nagłówek ucznia",
       "opis": "Imię ucznia z odznakami średniej i szczęśliwego numerka",
       "wymaga": [],
       "karta": {
        "type": "heading",
        "heading": "__IMIE__",
        "icon": "mdi:account-school",
        "heading_style": "title",
        "badges": [
         {
          "type": "entity",
          "entity": "__E[sensor.srednia_ocen]__",
          "icon": "mdi:chart-line",
          "show_state": true,
          "color": "primary"
         },
         {
          "type": "entity",
          "entity": "__E[sensor.szczesliwy_numerek]__",
          "icon": "mdi:clover",
          "show_state": true,
          "color": "green"
         }
        ]
       }
      },
      {
       "id": "wizytowka",
       "nazwa": "Wizytówka ucznia",
       "opis": "Klasa, numer w dzienniku, wychowawca, szkoła i szczęśliwy numerek",
       "wymaga": [
        "card-mod"
       ],
       "karta": {
        "type": "markdown",
        "content": "{% set nr = state_attr('__E[sensor.informacje_o_uczniu]__','numer_w_klasie') %}\n{% set num = states('__E[sensor.szczesliwy_numerek]__') %}\n{% set szkola = (state_attr('__E[sensor.informacje_o_uczniu]__','szkola') or '') .split('\\n') %}\n## {{ '__EMOJI__' }} {{ states('__E[sensor.informacje_o_uczniu]__') }}\n**{{ state_attr('__E[sensor.informacje_o_uczniu]__','klasa') or '—' }}** · nr w dzienniku **{{ nr if nr is not none else '—' }}** · wychowawca: **{{ state_attr('__E[sensor.informacje_o_uczniu]__','wychowawca') or '—' }}**\n🏫 {{ szkola[0] | regex_replace(',\\s*$', '') }}{% if szkola | length > 2 %} · {{ szkola[2] }}{% endif %}\n\n🍀 Szczęśliwy numerek: **{{ num }}**{% if nr is not none and num | string == nr | string %} — 🎉 **to Twój numer, dziś nie będziesz pytany!**{% endif %}",
        "text_only": false,
        "grid_options": {
         "columns": "full"
        },
        "card_mod": {
         "style": "ha-card { background: linear-gradient(135deg, __C1__ 0%, __C2__ 100%) !important; color: #fff !important; border: none !important; box-shadow: 0 6px 20px rgba(0,0,0,.18) !important; } ha-markdown { --primary-text-color: #fff; color: #fff; } ha-markdown h2 { margin: 0 0 6px 0; font-size: 1.7em; }"
        }
       }
      },
      {
       "id": "alerty",
       "nazwa": "Pilne na dziś i jutro",
       "opis": "Sprawdziany, dni wolne, nauka, nowe oceny, wiadomości i uwagi",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set dzis = now().strftime('%Y-%m-%d') %}\n{% set jutro = (now() + timedelta(days=1)).strftime('%Y-%m-%d') %}\n{% set zd = state_attr('__E[sensor.terminarz]__','zdarzenia') or [] %}\n{% set ns = namespace(n=0) %}\n{% for z in zd if z.data == dzis and z.rodzaj == 'dzien_wolny' %}{% set ns.n = ns.n + 1 %}\n<ha-alert alert-type=\"success\" title=\"Dziś wolne 🏖️\">{{ z.przedmiot }}</ha-alert>\n{% endfor %}\n{% for z in zd if z.data in [dzis, jutro] and z.rodzaj in ['sprawdzian','kartkowka'] %}{% set ns.n = ns.n + 1 %}\n<ha-alert alert-type=\"error\" title=\"{{ 'Dziś' if z.data == dzis else 'Jutro' }}: {{ z.tytul }} – {{ z.przedmiot }}\">{{ z.szczegoly.get('Opis','') if z.szczegoly.get('Opis','unknown') != 'unknown' else '' }}</ha-alert>\n{% endfor %}\n{% if is_state('__E[binary_sensor.obowiazki_szkolne_nauka]__','on') %}{% set ns.n = ns.n + 1 %}\n{% set dn = state_attr('__E[binary_sensor.obowiazki_szkolne_nauka]__','sprawdziany_do_nauki') | int(0) %}<ha-alert alert-type=\"warning\" title=\"Czas na naukę 📚\">{{ 'Sprawdziany do przygotowania: ' ~ dn if dn > 0 else 'Zbliżają się sprawdziany – warto zacząć powtórki.' }}</ha-alert>\n{% endif %}\n{% if state_attr('__E[sensor.oceny]__','sa_nowe_oceny') %}{% set ns.n = ns.n + 1 %}\n<ha-alert alert-type=\"info\" title=\"Nowe oceny 🆕\">Sprawdź sekcję „Oceny”.</ha-alert>\n{% endif %}\n{% set nieprz = state_attr('__E[sensor.wiadomosci]__','liczba_nieprzeczytanych') | int(0) %}\n{% if nieprz > 0 %}{% set ns.n = ns.n + 1 %}\n<ha-alert alert-type=\"info\" title=\"Nieprzeczytane wiadomości ✉️\">{{ nieprz }} – zobacz sekcję „Wiadomości”.</ha-alert>\n{% endif %}\n{% if state_attr('__E[sensor.uwagi_o_zachowaniu]__','sa_nowe_uwagi') %}{% set ns.n = ns.n + 1 %}\n<ha-alert alert-type=\"warning\" title=\"Nowa uwaga\">{{ (state_attr('__E[sensor.uwagi_o_zachowaniu]__','ostatnia') or {}).get('tresc','') }}</ha-alert>\n{% endif %}\n{% if ns.n == 0 %}\n<ha-alert alert-type=\"success\">Wszystko pod kontrolą – brak pilnych spraw na dziś i jutro ✅</ha-alert>\n{% endif %}",
        "text_only": false,
        "grid_options": {
         "columns": "full"
        }
       }
      },
      {
       "id": "kafle",
       "nazwa": "Kafle statystyk",
       "opis": "Średnia, frekwencja, oceny, zachowanie, wiadomości i testy w 7 dni",
       "wymaga": [
        "mushroom"
       ],
       "karta": {
        "type": "grid",
        "columns": 3,
        "square": false,
        "grid_options": {
         "columns": "full"
        },
        "cards": [
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.srednia_ocen]__",
          "icon": "mdi:chart-line",
          "primary": "{{ states('__E[sensor.srednia_ocen]__') }}",
          "secondary": "Średnia · sem. {{ state_attr('__E[sensor.srednia_ocen]__','semestr') }}",
          "icon_color": "{% set a = states('__E[sensor.srednia_ocen]__') | float(0) %}{{ 'green' if a >= 4.5 else 'light-green' if a >= 3.5 else 'amber' if a >= 2.5 else 'orange' if a >= 1.75 else 'red' }}",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          }
         },
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.frekwencja]__",
          "icon": "mdi:account-check",
          "primary": "{{ state_attr('__E[sensor.frekwencja]__','frekwencja_procent') | float(0) | round(1) }}%",
          "secondary": "Frekwencja · nb {{ state_attr('__E[sensor.frekwencja]__','liczba_nieobecnosci') | int(0) }} · sp {{ state_attr('__E[sensor.frekwencja]__','liczba_spoznien') | int(0) }}",
          "icon_color": "{% set f = state_attr('__E[sensor.frekwencja]__','frekwencja_procent') | float(0) %}{{ 'green' if f >= 90 else 'amber' if f >= 80 else 'red' }}",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          }
         },
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.oceny]__",
          "icon": "mdi:numeric",
          "primary": "{{ state_attr('__E[sensor.oceny]__','liczba_ocen') | int(0) }}",
          "secondary": "Ocen · {{ state_attr('__E[sensor.oceny]__','liczba_przedmiotow') | int(0) }} przedm.",
          "icon_color": "blue",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          },
          "badge_icon": "{{ 'mdi:new-box' if state_attr('__E[sensor.oceny]__','sa_nowe_oceny') else '' }}",
          "badge_color": "red"
         },
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.zachowanie]__",
          "icon": "mdi:account-star",
          "primary": "{% set s = states('__E[sensor.zachowanie]__') %}{{ s if s not in ['unknown','unavailable'] else '—' }}",
          "secondary": "Zachowanie · +{{ state_attr('__E[sensor.zachowanie]__','liczba_wpisow_pozytywnych') | int(0) }} / −{{ state_attr('__E[sensor.zachowanie]__','liczba_wpisow_negatywnych') | int(0) }}",
          "icon_color": "{{ 'red' if state_attr('__E[sensor.zachowanie]__','liczba_wpisow_negatywnych') | int(0) > 0 else 'purple' }}",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          }
         },
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.wiadomosci]__",
          "icon": "mdi:email",
          "primary": "{{ state_attr('__E[sensor.wiadomosci]__','liczba_nieprzeczytanych') | int(0) }}",
          "secondary": "Nieprzeczytane wiad.",
          "icon_color": "{{ 'red' if state_attr('__E[sensor.wiadomosci]__','liczba_nieprzeczytanych') | int(0) > 0 else 'blue' }}",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          }
         },
         {
          "type": "custom:mushroom-template-card",
          "entity": "__E[sensor.terminarz]__",
          "icon": "mdi:file-document-edit",
          "primary": "{% set t0 = strptime(now().strftime('%Y-%m-%d'), '%Y-%m-%d') %}{% set ns = namespace(n=0) %}{% for z in state_attr('__E[sensor.terminarz]__','zdarzenia') or [] if z.rodzaj in ['sprawdzian','kartkowka'] %}{% set d = (strptime(z.data, '%Y-%m-%d') - t0).days %}{% if 0 <= d <= 7 %}{% set ns.n = ns.n + 1 %}{% endif %}{% endfor %}{{ ns.n }}",
          "secondary": "{% set dzis = now().strftime('%Y-%m-%d') %}{% set nast = (state_attr('__E[sensor.terminarz]__','zdarzenia') or []) | selectattr('rodzaj','in',['sprawdzian','kartkowka']) | selectattr('data','>=',dzis) | list %}{% if nast %}{{ nast[0].przedmiot }} · {{ nast[0].data[8:10] }}.{{ nast[0].data[5:7] }}{% else %}Testy w 7 dni{% endif %}",
          "icon_color": "{% set t0 = strptime(now().strftime('%Y-%m-%d'), '%Y-%m-%d') %}{% set ns = namespace(m=99) %}{% for z in state_attr('__E[sensor.terminarz]__','zdarzenia') or [] if z.rodzaj in ['sprawdzian','kartkowka'] %}{% set d = (strptime(z.data, '%Y-%m-%d') - t0).days %}{% if 0 <= d < ns.m %}{% set ns.m = d %}{% endif %}{% endfor %}{{ 'red' if ns.m <= 2 else 'orange' if ns.m <= 7 else 'grey' }}",
          "layout": "vertical",
          "multiline_secondary": true,
          "tap_action": {
           "action": "more-info"
          }
         }
        ]
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Dzień szkolny i testy",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Dzień szkolny i testy",
    "icon": "mdi:school-outline",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "dzien",
       "nazwa": "Dzień szkolny",
       "opis": "Bieżąca lekcja, pasek postępu dnia i plan na dziś",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.plan_lekcji]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.plan_lekcji]__",
         "__E[sensor.terminarz]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_today() {\n  const days = A(E.PLAN).kolejne_7_dni || [];\n  const now = new Date(), td = ymd(now), nm = now.getHours() * 60 + now.getMinutes();\n  const wolneDzis = (A(E.TERM).zdarzenia || []).filter((z) => z.rodzaj === 'dzien_wolny' && z.data === td);\n  const day = days.find((d) => d.data === td && (d.lekcje || []).length);\n  const nextDay = days.find((d) => d.data > td && (d.lekcje || []).length);\n  let html = head('mdi:bell-ring-outline', 'Dzień szkolny', chip(DS[now.getDay()] + ' ' + fmtd(td), E.ACC));\n  const list = (d, live) => d.lekcje.map((x) => {\n    const s = tmin(x.godzina_od), e = tmin(x.godzina_do);\n    const cur = live && s != null && e != null && nm >= s && nm < e, past = live && e != null && nm >= e;\n    return `<div style=\"display:flex;gap:10px;align-items:center;padding:5px 8px;border-radius:10px;${cur ? `background:color-mix(in srgb, ${E.ACC} 14%, transparent);` : ''}${past ? 'opacity:.45;' : ''}\">` +\n      `<span style=\"width:22px;height:22px;border-radius:50%;background:${cur ? E.ACC : 'color-mix(in srgb, var(--primary-text-color) 9%, transparent)'};color:${cur ? '#fff' : 'inherit'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:none\">${esc(x.numer)}</span>` +\n      `<span style=\"width:86px;flex:none;font-variant-numeric:tabular-nums;color:var(--secondary-text-color);font-size:12px\">${esc(x.godzina_od)}–${esc(x.godzina_do)}</span>` +\n      `<span style=\"flex:1;min-width:0\">${lessonName(x)}<div style=\"color:var(--secondary-text-color);font-size:11px\">${esc((x.nauczyciel_i_sala || '').replace(/\\s+/g, ' '))}</div></span></div>`;\n  }).join('');\n  if (day) {\n    const L = day.lekcje.filter((x) => !x.odwolana);\n    const first = tmin((L[0] || day.lekcje[0]).godzina_od), last = tmin((L[L.length - 1] || day.lekcje[day.lekcje.length - 1]).godzina_do);\n    const cur = L.find((x) => tmin(x.godzina_od) <= nm && nm < tmin(x.godzina_do));\n    const nxt = L.find((x) => tmin(x.godzina_od) > nm);\n    let big, label, info;\n    if (cur) { label = 'Teraz'; big = cur.przedmiot; info = `do ${cur.godzina_do} · zostało ${tmin(cur.godzina_do) - nm} min`; }\n    else if (nxt) { const m = tmin(nxt.godzina_od) - nm; label = m <= 60 ? `Za ${m} min` : `Pierwsza lekcja ${nxt.godzina_od}`; big = nxt.przedmiot; info = (nxt.nauczyciel_i_sala || '').replace(/\\s+/g, ' '); }\n    else { label = 'Koniec lekcji'; big = 'Na dziś wolne 🎉'; info = nextDay ? `Następne lekcje: ${nextDay.dzien_tygodnia} ${fmtd(nextDay.data)}, ${nextDay.lekcje[0].godzina_od}` : ''; }\n    const prog = first != null && last != null && last > first ? Math.round(100 * Math.max(0, Math.min(1, (nm - first) / (last - first)))) : 0;\n    html += `<div style=\"border-radius:14px;padding:12px 14px;margin-bottom:10px;background:linear-gradient(135deg, ${E.C1}, ${E.C2});color:#fff\">` +\n      `<div style=\"font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.06em\">${esc(label)}</div><div style=\"font-size:20px;font-weight:700;margin:2px 0\">${esc(cap(big))}</div><div style=\"font-size:12px;opacity:.9\">${esc(info)}</div>` +\n      `<div style=\"margin-top:10px;background:rgba(255,255,255,.25);border-radius:6px;height:6px;overflow:hidden\"><div style=\"width:${prog}%;height:100%;background:#fff\"></div></div>` +\n      `<div style=\"display:flex;justify-content:space-between;font-size:11px;opacity:.85;margin-top:3px\"><span>${esc(day.lekcje[0].godzina_od)}</span><span>${L.length} ${pl(L.length, 'lekcja', 'lekcje', 'lekcji')} · ${prog}% dnia</span><span>${esc(day.lekcje[day.lekcje.length - 1].godzina_do)}</span></div></div>`;\n    html += list(day, true);\n  } else {\n    html += `<div style=\"border-radius:14px;padding:12px 14px;margin-bottom:10px;background:linear-gradient(135deg, ${E.C1}, ${E.C2});color:#fff\">` +\n      `<div style=\"font-size:12px;opacity:.85;text-transform:uppercase;letter-spacing:.06em\">Dziś</div><div style=\"font-size:20px;font-weight:700;margin:2px 0\">${wolneDzis.length ? '🏖️ ' + esc(wolneDzis[0].przedmiot) : 'Brak lekcji'}</div>` +\n      `<div style=\"font-size:12px;opacity:.9\">${nextDay ? `Następne lekcje: ${esc(nextDay.dzien_tygodnia)} ${fmtd(nextDay.data)} · ${nextDay.lekcje.length} ${pl(nextDay.lekcje.length, 'lekcja', 'lekcje', 'lekcji')} · ${esc(nextDay.lekcje[0].godzina_od)}–${esc(nextDay.lekcje[nextDay.lekcje.length - 1].godzina_do)}` : 'Brak lekcji w planie na najbliższe 7 dni'}</div></div>`;\n    if (nextDay) html += `<div style=\"font-weight:600;margin:4px 0 6px\">${esc(cap(nextDay.dzien_tygodnia))} ${fmtd(nextDay.data)}</div>` + list(nextDay, false);\n    else {\n      const wolne = (A(E.TERM).zdarzenia || []).filter((z) => z.rodzaj === 'dzien_wolny' && ddiff(z.data) > 0).slice(0, 4);\n      html += wolne.map((w) => `<div style=\"padding:3px 0\">🏖️ <b>${fmtd(w.data)}</b> ${sub(esc(w.przedmiot))}</div>`).join('');\n    }\n  }\n  return box(html);\n}\n\nreturn R_today();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        },
        "update_timer": "60s"
       }
      },
      {
       "id": "odliczanie",
       "nazwa": "Odliczanie do sprawdzianu",
       "opis": "Najbliższy test i plan powtórek",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.terminarz]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.terminarz]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_exam() {\n  const T = tests();\n  let html = head('mdi:timer-sand', 'Odliczanie do sprawdzianu', T.length ? chip(T.length + ' ' + pl(T.length, 'test', 'testy', 'testów'), E.ACC) : '');\n  if (!T.length) return box(html + empty('🎈', 'Brak zaplanowanych sprawdzianów i kartkówek'));\n  const z = T[0], d = ddiff(z.data), col = d <= 2 ? BAD : d <= 7 ? WARN : E.ACC;\n  const nl = z.numer_lekcji && z.numer_lekcji !== 'unknown' ? ` · lekcja ${esc(z.numer_lekcji)}` : '';\n  html += `<div style=\"display:flex;gap:14px;align-items:center;margin-bottom:12px\">${ring(1 - Math.min(d, 14) / 14, col, 92, 10, String(d), pl(d, 'dzień', 'dni', 'dni'))}` +\n    `<div style=\"min-width:0\">${chip(esc(z.tytul), z.rodzaj === 'sprawdzian' ? BAD : WARN)}<div style=\"font-size:18px;font-weight:700;margin:2px 0\">${esc(cap(z.przedmiot))}</div>` +\n    `<div style=\"font-size:12px;color:var(--secondary-text-color)\">${kiedy(d)} · ${DS[pd(z.data).getDay()]} ${fmtd(z.data)}${nl}</div>` +\n    (opisOf(z) ? `<div style=\"font-size:13px;margin-top:4px\">📖 ${esc(opisOf(z))}</div>` : '') + `</div></div>`;\n  const rest = T.slice(1).filter((x) => ddiff(x.data) <= 30);\n  if (rest.length) {\n    html += `<div style=\"font-weight:600;font-size:13px;margin:6px 0\">📋 Plan przygotowań</div>`;\n    html += rest.map((x) => {\n      const dd = ddiff(x.data), lead = x.rodzaj === 'sprawdzian' ? 4 : 1, start = new Date(pd(x.data).getTime() - lead * 86400000);\n      const c = dd <= 2 ? BAD : dd <= 7 ? WARN : MUTED, startTxt = start <= today0() ? '<b style=\"color:' + BAD + '\">powtarzaj już teraz</b>' : 'zacznij powtórki ' + DS[start.getDay()] + ' ' + fmtd(ymd(start));\n      return `<div style=\"display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--divider-color)\"><div style=\"width:46px;flex:none;text-align:center\"><div style=\"font-size:16px;font-weight:700;color:${c}\">${dd}</div><div style=\"font-size:10px;color:var(--secondary-text-color)\">${pl(dd, 'dzień', 'dni', 'dni')}</div></div>` +\n        `<div style=\"min-width:0\"><b>${esc(cap(x.przedmiot))}</b> ${chip(esc(x.tytul), x.rodzaj === 'sprawdzian' ? BAD : WARN)}<div style=\"font-size:12px;color:var(--secondary-text-color)\">${DS[pd(x.data).getDay()]} ${fmtd(x.data)} · ${startTxt}</div>` +\n        (opisOf(x) ? `<div style=\"font-size:12px\">${esc(opisOf(x).slice(0, 120))}</div>` : '') + `</div></div>`;\n    }).join('');\n  }\n  return box(html);\n}\n\nreturn R_exam();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        },
        "update_timer": "30min"
       }
      },
      {
       "id": "zmiany",
       "nazwa": "Zastępstwa i odwołane",
       "opis": "Zmiany w planie i nieobecności nauczycieli",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.plan_lekcji]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.plan_lekcji]__",
         "__E[sensor.terminarz]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_changes() {\n  const days = A(E.PLAN).kolejne_7_dni || [], rows = [];\n  for (const d of days) for (const x of (d.lekcje || [])) {\n    if (x.odwolana) rows.push({ d: d.data, ic: '❌', t: 'Odwołana', c: BAD, x });\n    else if (x.zastepstwo) rows.push({ d: d.data, ic: '🔄', t: 'Zastępstwo', c: '#1e88e5', x });\n  }\n  for (const z of (A(E.TERM).zdarzenia || [])) if (z.rodzaj === 'nieobecnosc_nauczyciela' && ddiff(z.data) >= 0) rows.push({ d: z.data, ic: '👤', t: 'Nieobecność nauczyciela', c: WARN, x: { przedmiot: z.przedmiot, numer: z.numer_lekcji } });\n  let html = head('mdi:swap-horizontal-bold', 'Zastępstwa i odwołane', rows.length ? chip(rows.length, WARN) : '');\n  if (!rows.length) return box(html + empty('✅', 'Brak zmian w planie na najbliższe dni'));\n  rows.sort((a, b) => a.d.localeCompare(b.d));\n  html += rows.map((r) => `<div style=\"display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--divider-color)\"><span style=\"font-size:18px\">${r.ic}</span><div style=\"flex:1;min-width:0\"><b>${esc(cap(r.x.przedmiot))}</b> ${chip(r.t, r.c)}<div style=\"font-size:12px;color:var(--secondary-text-color)\">${DS[pd(r.d).getDay()]} ${fmtd(r.d)}${r.x.numer && r.x.numer !== 'unknown' ? ' · lekcja ' + esc(r.x.numer) : ''}${r.x.godzina_od ? ' · ' + esc(r.x.godzina_od) : ''}</div></div></div>`).join('');\n  return box(html);\n}\n\nreturn R_changes();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Plan lekcji",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Plan lekcji",
    "icon": "mdi:timetable",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "plan",
       "nazwa": "Plan lekcji na 7 dni",
       "opis": "Rozwijane dni z zastępstwami, odwołaniami i zdarzeniami",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set dni = state_attr('__E[sensor.plan_lekcji]__','kolejne_7_dni') or [] %}\n{% set dzis = now().strftime('%Y-%m-%d') %}\n{% set wolne = (state_attr('__E[sensor.terminarz]__','zdarzenia') or []) | selectattr('rodzaj','eq','dzien_wolny') | selectattr('data','>=',dzis) | list %}\n{% set ns = namespace(otwarty=false) %}\n{% if not dni or (dni | map(attribute='lekcje') | map('length') | sum) == 0 %}\n<ha-alert alert-type=\"info\" title=\"Brak lekcji w najbliższych dniach\">Plan zostanie pokazany, gdy Librus udostępni lekcje.</ha-alert>\n{% for w in wolne[:5] %}\n- 🏖️ **{{ w.data[8:10] }}.{{ w.data[5:7] }}** ({{ w.tydzien }}) – {{ w.przedmiot }}\n{% endfor %}\n{% else %}\n{% for dzien in dni %}{% set l = dzien.lekcje or [] %}\n{% set otworz = (not ns.otwarty) and l | length > 0 %}{% if otworz %}{% set ns.otwarty = true %}{% endif %}\n<details{{ ' open' if otworz else '' }}><summary><b>{{ '📍 ' if dzien.data == dzis else '' }}{{ dzien.dzien_tygodnia | capitalize }}</b> {{ dzien.data[8:10] }}.{{ dzien.data[5:7] }}{% if l %} · {{ l | length }} lekcji · {{ l[0].godzina_od }}–{{ l[-1].godzina_do }}{% else %} · wolne{% endif %}</summary>\n\n{% if l %}\n| # | Godz. | Przedmiot | Sala / nauczyciel |\n|:-:|:--|:--|:--|\n{% for x in l %}| {{ x.numer }} | {{ x.godzina_od }}–{{ x.godzina_do }} | {% if x.odwolana %}❌ ~~{{ x.przedmiot }}~~{% elif x.zastepstwo %}🔄 <font color=\"#1e88e5\"><b>{{ x.przedmiot }}</b></font>{% elif x.get('zdarzenie') %}📝 <font color=\"#e53935\"><b>{{ x.przedmiot }}</b></font> <i>({{ x.zdarzenie }})</i>{% else %}<b>{{ x.przedmiot }}</b>{% endif %} | {{ x.nauczyciel_i_sala }} |\n{% endfor %}\n{% else %}\n_Brak lekcji_\n{% endif %}\n\n</details>\n{% endfor %}\n{% endif %}",
        "text_only": false
       }
      }
     ]
    },
    {
     "naglowek": {
      "type": "heading",
      "heading": "Ostatnie lekcje – tematy",
      "icon": "mdi:book-open-page-variant",
      "heading_style": "subtitle"
     },
     "elementy": [
      {
       "id": "tematy",
       "nazwa": "Tematy ostatnich lekcji",
       "opis": "Tematy z ostatniego dnia i nieobecności na lekcjach",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set lek = state_attr('__E[sensor.tematy_lekcji]__','lekcje_ostatniego_dnia') or [] %}\n{% set ik = {'ob':'✅','nb':'❌','u':'🟦','sp':'⏰','zw':'🏃','ns':'⚠️'} %}\n{% if not lek %}Brak zapisanych tematów.{% else %}\n**{{ lek[0].dzien_tygodnia }} {{ state_attr('__E[sensor.tematy_lekcji]__','ostatni_dzien') }}**\n\n| # | Przedmiot | Temat | |\n|:-:|:--|:--|:-:|\n{% for l in lek %}| {{ l.numer }} | **{{ l.przedmiot }}**{% if l.zastepstwo %} 🔄 _{{ l.zastepca }}_{% endif %} | {{ l.temat }} | {{ ik.get(l.obecnosc, l.obecnosc) }} |\n{% endfor %}\n{% endif %}\n{% set nb = state_attr('__E[sensor.tematy_lekcji]__','nieobecnosci') or [] %}\n{% if nb %}\n<ha-alert alert-type=\"warning\" title=\"Nieobecności na lekcjach\">{% for l in nb[:6] %}{{ l.data }} · {{ l.przedmiot }} ({{ l.obecnosc_opis }}){{ '<br>' if not loop.last else '' }}{% endfor %}</ha-alert>\n{% endif %}",
        "text_only": false
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Nadchodzące",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Nadchodzące",
    "icon": "mdi:calendar-alert",
    "heading_style": "title",
    "badges": [
     {
      "type": "entity",
      "entity": "__E[sensor.terminarz]__",
      "show_state": true,
      "show_icon": false
     }
    ]
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "nadchodzace",
       "nazwa": "Nadchodzące wydarzenia",
       "opis": "Sprawdziany, kartkówki i wydarzenia z terminarza",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set t0 = strptime(now().strftime('%Y-%m-%d'), '%Y-%m-%d') %}\n{% set ikony = {'sprawdzian':'🔴','kartkowka':'🟠','dzien_wolny':'🏖️','wydarzenie':'📌','nieobecnosc_nauczyciela':'👤','zadanie':'📘','odpowiedz':'🗣️'} %}\n{% set dni_tyg = ['pon','wt','śr','czw','pt','sob','ndz'] %}\n{% set ns = namespace(n=0) %}\n{% for z in state_attr('__E[sensor.terminarz]__','zdarzenia') or [] %}\n{% set d = (strptime(z.data, '%Y-%m-%d') - t0).days %}\n{% if d >= 0 %}{% set ns.n = ns.n + 1 %}\n{% set test = z.rodzaj in ['sprawdzian','kartkowka'] %}\n{% set kiedy = 'dziś' if d == 0 else 'jutro' if d == 1 else 'za ' ~ d ~ ' dni' %}\n{% set kol = '#e53935' if test and d <= 2 else '#fb8c00' if test and d <= 7 else '#9e9e9e' %}\n{% set opis = z.szczegoly.get('Opis','') if z.szczegoly is mapping else '' %}\n{{ ikony.get(z.rodzaj, '📎') }} **{{ z.tytul if test else z.przedmiot }}**{% if test %} · {{ z.przedmiot }}{% endif %}\n<font color=\"{{ kol }}\"><b>{{ kiedy }}</b></font> · {{ dni_tyg[strptime(z.data, '%Y-%m-%d').weekday()] }} {{ z.data[8:10] }}.{{ z.data[5:7] }}{% if z.numer_lekcji not in ['unknown', none, ''] %} · lekcja {{ z.numer_lekcji }}{% endif %}{% if z.godzina not in ['unknown', none, ''] %} · {{ z.godzina }}{% endif %}{% if opis and opis != 'unknown' %}\n<i>{{ opis | truncate(110) }}</i>{% endif %}\n\n{% endif %}\n{% endfor %}\n{% if ns.n == 0 %}Brak nadchodzących wydarzeń 🎈{% endif %}",
        "text_only": false
       }
      }
     ]
    },
    {
     "naglowek": {
      "type": "heading",
      "heading": "Do zrobienia",
      "icon": "mdi:checkbox-marked-circle-outline",
      "heading_style": "subtitle"
     },
     "elementy": [
      {
       "id": "todo_zadania",
       "nazwa": "Zadania domowe (to-do)",
       "opis": "Lista zadań domowych do odhaczania",
       "wymaga": [],
       "karta": {
        "type": "todo-list",
        "entity": "__E[todo.zadania_domowe_to_do]__",
        "title": "📘 Zadania domowe",
        "hide_completed": false
       }
      },
      {
       "id": "todo_nauka",
       "nazwa": "Przygotowanie do lekcji (to-do)",
       "opis": "Lista nauki przed sprawdzianami",
       "wymaga": [],
       "karta": {
        "type": "todo-list",
        "entity": "__E[todo.przygotowanie_do_lekcji_to_do]__",
        "title": "🎒 Przygotowanie do lekcji",
        "hide_completed": false
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Oceny",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Oceny",
    "icon": "mdi:school",
    "heading_style": "title",
    "badges": [
     {
      "type": "entity",
      "entity": "__E[sensor.srednia_ocen]__",
      "show_state": true,
      "show_icon": false
     }
    ]
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "oceny",
       "nazwa": "Oceny według przedmiotów",
       "opis": "Wszystkie oceny bieżącego semestru ze średnimi",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{%- macro g(v, nowa=false) -%}\n{%- set v = v | string -%}\n{%- set c = {'1':'#e53935','2':'#fb8c00','3':'#f9a825','4':'#7cb342','5':'#43a047','6':'#00897b'}.get(v[:1], '#9e9e9e') -%}\n<font color=\"{{ c }}\"><b>{{ v }}</b></font>{% if nowa %}<sup>🆕</sup>{% endif %}\n{%- endmacro -%}\n{%- macro avgc(a) -%}\n{%- if a is number -%}{{ '#43a047' if a >= 4.5 else '#7cb342' if a >= 3.5 else '#f9a825' if a >= 2.5 else '#fb8c00' if a >= 1.75 else '#e53935' }}{%- else -%}#9e9e9e{%- endif -%}\n{%- endmacro -%}\n{%- macro avg(a) -%}\n{%- if a is number and a > 0 -%}{% set n = (a | round(0)) | int %}<font color=\"{{ avgc(a) }}\"><b>{{ '%.2f' | format(a) }}</b> {{ '●' * n }}{{ '○' * (6 - n) }}</font>{%- else -%}<font color=\"#9e9e9e\">—</font>{%- endif -%}\n{%- endmacro -%}\n\n{% set oc = state_attr('__E[sensor.oceny]__','oceny_wg_przedmiotu') or {} %}\n{% set sr = state_attr('__E[sensor.srednia_ocen]__','srednie_wg_przedmiotow') or {} %}\n{% if not oc %}\n<ha-alert alert-type=\"info\">Brak ocen w tym semestrze.</ha-alert>\n{% else %}\n{% set slabe = sr | dictsort | selectattr('1','number') | selectattr('1','<',2.5) | selectattr('1','>',0) | map(attribute='0') | list %}\n{% set mocne = sr | dictsort | selectattr('1','number') | selectattr('1','>=',4.5) | map(attribute='0') | list %}\n{% if slabe %}<ha-alert alert-type=\"warning\" title=\"Wymaga uwagi\">{{ slabe | join(', ') }}</ha-alert>\n{% endif %}{% if mocne %}<ha-alert alert-type=\"success\" title=\"Najmocniejsze strony 🌟\">{{ mocne | join(', ') }}</ha-alert>\n{% endif %}\n\n| Przedmiot | Oceny | Średnia |\n|:--|:--|:--|\n{% for przed, lista in oc | dictsort %}| {{ przed | capitalize }} | {% for o in lista %}{{ g(o.ocena, o.jest_nowa) }} {% endfor %}| {{ avg(sr.get(przed)) }} |\n{% endfor %}\n{% endif %}",
        "text_only": false
       }
      }
     ]
    },
    {
     "naglowek": {
      "type": "heading",
      "heading": "Najnowsze oceny",
      "icon": "mdi:new-box",
      "heading_style": "subtitle"
     },
     "elementy": [
      {
       "id": "oceny_najnowsze",
       "nazwa": "Najnowsze oceny",
       "opis": "Ostatnio wystawione oceny",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{%- macro g(v, nowa=false) -%}\n{%- set v = v | string -%}\n{%- set c = {'1':'#e53935','2':'#fb8c00','3':'#f9a825','4':'#7cb342','5':'#43a047','6':'#00897b'}.get(v[:1], '#9e9e9e') -%}\n<font color=\"{{ c }}\"><b>{{ v }}</b></font>{% if nowa %}<sup>🆕</sup>{% endif %}\n{%- endmacro -%}\n{%- macro avgc(a) -%}\n{%- if a is number -%}{{ '#43a047' if a >= 4.5 else '#7cb342' if a >= 3.5 else '#f9a825' if a >= 2.5 else '#fb8c00' if a >= 1.75 else '#e53935' }}{%- else -%}#9e9e9e{%- endif -%}\n{%- endmacro -%}\n{%- macro avg(a) -%}\n{%- if a is number and a > 0 -%}{% set n = (a | round(0)) | int %}<font color=\"{{ avgc(a) }}\"><b>{{ '%.2f' | format(a) }}</b> {{ '●' * n }}{{ '○' * (6 - n) }}</font>{%- else -%}<font color=\"#9e9e9e\">—</font>{%- endif -%}\n{%- endmacro -%}\n\n{% set oc = state_attr('__E[sensor.oceny]__','oceny_wg_przedmiotu') or {} %}\n{% set ns = namespace(all=[]) %}\n{% for przed, lista in oc.items() %}{% for o in lista %}{% set ns.all = ns.all + [dict(o, przedmiot=przed)] %}{% endfor %}{% endfor %}\n{% if not ns.all %}Brak ocen.{% endif %}\n{% for o in (ns.all | sort(attribute='data', reverse=true))[:8] %}\n<details><summary>{{ g(o.ocena, o.jest_nowa) }} &nbsp;<b>{{ o.przedmiot | capitalize }}</b> · {{ o.kategoria }} · {{ o.data[8:10] }}.{{ o.data[5:7] }}</summary>\n\n{% if o.komentarz %}💬 {{ o.komentarz }}\n{% endif %}{% if o.get('punktowa') %}🎯 {{ o.get('procent') }}% (max {{ o.get('max_punktow') }} pkt)\n{% endif %}👩‍🏫 {{ o.nauczyciel }}\n\n</details>\n{% endfor %}",
        "text_only": false
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Analiza ocen",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Analiza ocen",
    "icon": "mdi:chart-box-outline",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "radar",
       "nazwa": "Profil przedmiotów",
       "opis": "Wykres radarowy średnich z przedmiotów",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.srednia_ocen]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.srednia_ocen]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_radar() {\n  const D = avgs().sort((a, b) => a.p.localeCompare(b.p));\n  const total = parseFloat(st(E.SR));\n  let html = head('mdi:radar', 'Profil przedmiotów', isNaN(total) ? '' : chip('średnia ' + total.toFixed(2), acol(total)));\n  if (D.length < 3) return box(html + empty('📊', 'Za mało przedmiotów ze średnią, by narysować radar'));\n  const W = 320, H = 270, cx = W / 2, cy = 138, R = 92, n = D.length;\n  const pt = (i, v) => { const ang = -Math.PI / 2 + 2 * Math.PI * i / n, rr = R * Math.max(0, (v - 1) / 5); return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)]; };\n  let svg = `<svg viewBox=\"0 0 ${W} ${H}\" width=\"100%\" style=\"max-width:420px;display:block;margin:0 auto\">`;\n  for (let lv = 2; lv <= 6; lv++) {\n    const ps = D.map((_, i) => pt(i, lv).map((q) => q.toFixed(1)).join(',')).join(' ');\n    svg += `<polygon points=\"${ps}\" fill=\"none\" style=\"stroke:color-mix(in srgb, var(--primary-text-color) ${lv === 6 ? 22 : 10}%, transparent)\" stroke-width=\"1\"/>`;\n    const lp = pt(0, lv); svg += `<text x=\"${(lp[0] + 4).toFixed(1)}\" y=\"${(lp[1] + 3).toFixed(1)}\" style=\"fill:var(--secondary-text-color);font-size:9px\">${lv}</text>`;\n  }\n  D.forEach((_, i) => { const p = pt(i, 6); svg += `<line x1=\"${cx}\" y1=\"${cy}\" x2=\"${p[0].toFixed(1)}\" y2=\"${p[1].toFixed(1)}\" style=\"stroke:color-mix(in srgb, var(--primary-text-color) 10%, transparent)\"/>`; });\n  const poly = D.map((d, i) => pt(i, d.a).map((q) => q.toFixed(1)).join(',')).join(' ');\n  svg += `<polygon points=\"${poly}\" fill=\"${E.ACC}\" fill-opacity=\"0.22\" stroke=\"${E.ACC}\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/>`;\n  D.forEach((d, i) => {\n    const p = pt(i, d.a); svg += `<circle cx=\"${p[0].toFixed(1)}\" cy=\"${p[1].toFixed(1)}\" r=\"4.5\" fill=\"${acol(d.a)}\" stroke=\"var(--card-background-color, #fff)\" stroke-width=\"1.5\"><title>${esc(d.p)}: ${d.a.toFixed(2)}</title></circle>`;\n    const ang = -Math.PI / 2 + 2 * Math.PI * i / n, lx = cx + (R + 16) * Math.cos(ang), ly = cy + (R + 16) * Math.sin(ang);\n    const anchor = Math.abs(Math.cos(ang)) < 0.25 ? 'middle' : Math.cos(ang) > 0 ? 'start' : 'end';\n    svg += `<text x=\"${lx.toFixed(1)}\" y=\"${(ly + 3).toFixed(1)}\" text-anchor=\"${anchor}\" style=\"fill:var(--primary-text-color);font-size:10.5px;font-weight:600\">${esc(short(d.p))}</text>`;\n    svg += `<text x=\"${lx.toFixed(1)}\" y=\"${(ly + 15).toFixed(1)}\" text-anchor=\"${anchor}\" style=\"fill:${acol(d.a)};font-size:10px;font-weight:700\">${d.a.toFixed(2)}</text>`;\n  });\n  svg += `</svg>`;\n  return box(html + svg);\n}\n\nreturn R_radar();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "rozklad",
       "nazwa": "Rozkład ocen",
       "opis": "Ile jakich ocen w semestrze",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.oceny]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.oceny]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_hist() {\n  const G = allGrades(), cnt = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; let other = 0;\n  for (const g of G) { const n = gnum(g.ocena); if (n == null) other++; else cnt[String(g.ocena).charAt(0)]++; }\n  const num = Object.values(cnt).reduce((a, b) => a + b, 0), max = Math.max(1, ...Object.values(cnt));\n  let html = head('mdi:chart-bar', 'Rozkład ocen', chip(G.length + ' ' + pl(G.length, 'ocena', 'oceny', 'ocen'), E.ACC));\n  if (!num) return box(html + empty('📭', 'Brak ocen liczbowych'));\n  html += `<div style=\"display:flex;align-items:flex-end;gap:8px;height:130px;padding:0 4px\">` + [1, 2, 3, 4, 5, 6].map((k) => {\n    const h = Math.round(100 * cnt[k] / max);\n    return `<div style=\"flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%\"><div style=\"font-size:12px;font-weight:700;color:${GC[k]};margin-bottom:3px\">${cnt[k] || ''}</div>` +\n      `<div style=\"width:100%;max-width:38px;height:${Math.max(cnt[k] ? 6 : 2, h)}%;background:${cnt[k] ? GC[k] : 'color-mix(in srgb, var(--primary-text-color) 9%, transparent)'};border-radius:8px 8px 3px 3px\"></div></div>`;\n  }).join('') + `</div><div style=\"display:flex;gap:8px;padding:4px 4px 0\">` + [1, 2, 3, 4, 5, 6].map((k) => `<div style=\"flex:1;text-align:center;font-weight:700\">${k}</div>`).join('') + `</div>`;\n  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0], dobre = cnt[4] + cnt[5] + cnt[6], slabe = cnt[1] + cnt[2];\n  html += `<div style=\"margin-top:10px\">${chip('najczęściej: ' + top + ' (×' + cnt[top] + ')', GC[top])}${chip('≥4: ' + Math.round(100 * dobre / num) + '%', GOOD)}${slabe ? chip('1–2: ' + Math.round(100 * slabe / num) + '%', BAD) : ''}${other ? chip('inne (+/−/np): ' + other, '#9e9e9e') : ''}</div>`;\n  return box(html);\n}\n\nreturn R_hist();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "kategorie",
       "nazwa": "Za co są oceny",
       "opis": "Oceny według kategorii (sprawdzian, kartkówka, aktywność…)",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.oceny]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.oceny]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_cat() {\n  const G = allGrades(), m = {};\n  for (const g of G) { const k = String(g.kategoria || 'inna').trim().toLowerCase(); (m[k] = m[k] || { n: 0, s: 0, c: 0 }).n++; const v = gnum(g.ocena); if (v != null) { m[k].s += v; m[k].c++; } }\n  const K = Object.keys(m).sort((a, b) => m[b].n - m[a].n).slice(0, 7), max = Math.max(1, ...K.map((k) => m[k].n));\n  let html = head('mdi:shape-outline', 'Za co są oceny', '');\n  if (!K.length) return box(html + empty('📭', 'Brak ocen'));\n  html += K.map((k) => { const a = m[k].c ? m[k].s / m[k].c : null; return `<div style=\"margin:7px 0\"><div style=\"display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px\"><span>${esc(cap(k))}</span><span><b>${m[k].n}</b>${a != null ? ' · <b style=\"color:' + acol(a) + '\">' + a.toFixed(2) + '</b>' : ''}</span></div>${bar(100 * m[k].n / max, a != null ? acol(a) : E.ACC, 7)}</div>`; }).join('');\n  return box(html);\n}\n\nreturn R_cat();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Cel i świadectwo",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Cel i świadectwo",
    "icon": "mdi:target",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "wykres_sredniej",
       "nazwa": "Wykres średniej",
       "opis": "Zmiana średniej w czasie",
       "wymaga": [
        "apexcharts-card"
       ],
       "karta": {
        "type": "custom:apexcharts-card",
        "graph_span": "30d",
        "span": {
         "end": "day"
        },
        "header": {
         "show": true,
         "title": "📈 Trend średniej (30 dni)",
         "show_states": true,
         "colorize_states": true
        },
        "now": {
         "show": false
        },
        "yaxis": [
         {
          "min": 1,
          "max": 6,
          "decimals": 1,
          "apex_config": {
           "tickAmount": 5
          }
         }
        ],
        "series": [
         {
          "entity": "__E[sensor.srednia_ocen]__",
          "name": "Średnia",
          "type": "area",
          "color": "__ACC__",
          "stroke_width": 3,
          "curve": "smooth",
          "opacity": 0.18,
          "statistics": {
           "type": "mean",
           "period": "day",
           "align": "middle"
          },
          "extend_to": "now",
          "float_precision": 2
         }
        ],
        "apex_config": {
         "chart": {
          "height": 210
         },
         "grid": {
          "borderColor": "rgba(128,128,128,0.15)"
         },
         "legend": {
          "show": false
         }
        },
        "grid_options": {
         "columns": "full"
        }
       }
      },
      {
       "id": "cel",
       "nazwa": "Cel: świadectwo z paskiem",
       "opis": "Ile brakuje do wymaganej średniej",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.srednia_ocen]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.srednia_ocen]__",
         "__E[sensor.oceny]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_goal() {\n  const goal = E.GOAL, G = allGrades().map((g) => gnum(g.ocena)).filter((v) => v != null);\n  const srS = parseFloat(st(E.SR)), cur = !isNaN(srS) ? srS : (G.length ? G.reduce((a, b) => a + b, 0) / G.length : 0);\n  const col = cur >= goal ? GOOD : cur >= goal - 0.5 ? WARN : acol(cur);\n  let html = head('mdi:flag-checkered', 'Cel: świadectwo z paskiem', chip('cel ' + goal.toFixed(2), E.ACC));\n  const sum = G.reduce((a, b) => a + b, 0), n = G.length;\n  const simple = n ? sum / n : 0;\n  const need = (k) => simple + (goal - cur) * (n + k) / k;\n  let msg;\n  if (cur >= goal) msg = `<b style=\"color:${GOOD}\">Cel osiągnięty! 🎉</b><br>Zapas: ${(cur - goal).toFixed(2)} pkt średniej.`;\n  else {\n    const opts = [3, 5, 10].map((k) => ({ k, v: need(k) })), ok = opts.find((o) => o.v <= 6);\n    msg = `Brakuje <b style=\"color:${col}\">${(goal - cur).toFixed(2)}</b> do celu.<br>` + (ok ? `Przy ${ok.k} kolejnych ocenach potrzeba średnio <b>${Math.max(1, ok.v).toFixed(2)}</b>.` : 'Na ten semestr cel jest już poza zasięgiem – liczy się każda dobra ocena.');\n  }\n  html += `<div style=\"display:flex;gap:14px;align-items:center\">${ring(cur / 6, col, 104, 11, cur ? cur.toFixed(2) : '—', 'z 6,00')}<div style=\"font-size:13px\">${msg}</div></div>`;\n  if (n) {\n    html += `<div style=\"font-weight:600;font-size:13px;margin:12px 0 6px\">🧮 Symulacja: jak zmieni się średnia po nowej ocenie?</div><div style=\"display:flex;gap:6px\">` + [1, 2, 3, 4, 5, 6].map((v) => {\n      const dlt = (v - simple) / (n + 1), na = cur + dlt;\n      return `<div style=\"flex:1;text-align:center;border-radius:10px;padding:6px 0;background:color-mix(in srgb, ${GC[v]} 13%, transparent)\"><div style=\"font-weight:800;color:${GC[v]}\">${v}</div><div style=\"font-size:11px\">${na.toFixed(2)}</div><div style=\"font-size:10px;color:${dlt >= 0 ? GOOD : BAD}\">${dlt >= 0 ? '+' : ''}${dlt.toFixed(2)}</div></div>`;\n    }).join('') + `</div>` + sub('Szacunek: zmiana liczona bez wag ocen, względem oficjalnej średniej z Librusa.');\n  }\n  return box(html);\n}\n\nreturn R_goal();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "swiadectwo",
       "nazwa": "Przewidywane świadectwo",
       "opis": "Prognoza ocen końcowych",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.srednia_ocen]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.srednia_ocen]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_report() {\n  const D = avgs().sort((a, b) => b.a - a.a);\n  const pred = (a) => a >= 5.5 ? [6, 'celujący'] : a >= 4.5 ? [5, 'bardzo dobry'] : a >= 3.5 ? [4, 'dobry'] : a >= 2.5 ? [3, 'dostateczny'] : a >= 1.6 ? [2, 'dopuszczający'] : [1, 'niedostateczny'];\n  let html = head('mdi:certificate-outline', 'Przewidywane świadectwo', chip('szacunkowo', '#9e9e9e'));\n  if (!D.length) return box(html + empty('📄', 'Brak średnich z przedmiotów'));\n  const best = D[0], worst = D[D.length - 1];\n  html += `<div style=\"display:flex;gap:8px;margin-bottom:12px\">` +\n    `<div style=\"flex:1;border-radius:12px;padding:10px;background:color-mix(in srgb, ${GOOD} 12%, transparent)\"><div style=\"font-size:11px;color:var(--secondary-text-color)\">🌟 Najmocniejszy</div><div style=\"font-weight:700\">${esc(cap(best.p))}</div><div style=\"color:${acol(best.a)};font-weight:700\">${best.a.toFixed(2)}</div></div>` +\n    `<div style=\"flex:1;border-radius:12px;padding:10px;background:color-mix(in srgb, ${BAD} 10%, transparent)\"><div style=\"font-size:11px;color:var(--secondary-text-color)\">🎯 Do poprawy</div><div style=\"font-weight:700\">${esc(cap(worst.p))}</div><div style=\"color:${acol(worst.a)};font-weight:700\">${worst.a.toFixed(2)}</div></div></div>`;\n  html += D.map((d) => { const p = pred(d.a); return `<div style=\"display:flex;align-items:center;gap:10px;padding:5px 0;border-top:1px solid var(--divider-color)\"><span style=\"flex:1;min-width:0\">${esc(cap(d.p))}</span><span style=\"font-size:12px;color:var(--secondary-text-color)\">${d.a.toFixed(2)}</span><span style=\"width:104px;text-align:right\">${chip(p[0] + ' · ' + p[1], GC[p[0]])}</span></div>`; }).join('');\n  const sw = D.reduce((a, d) => a + pred(d.a)[0], 0) / D.length, pasek = sw >= 4.75;\n  html += `<div style=\"margin-top:10px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb, ${pasek ? GOOD : E.ACC} 12%, transparent)\">Średnia ocen na świadectwie ≈ <b>${sw.toFixed(2)}</b><br>${pasek ? '🎗️ <b>Pasek w zasięgu!</b> (wymaga też co najmniej bardzo dobrego zachowania)' : `Do paska brakuje <b>${(4.75 - sw).toFixed(2)}</b>`}</div>`;\n  return box(html);\n}\n\nreturn R_report();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Frekwencja",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Frekwencja",
    "icon": "mdi:account-check-outline",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "frekwencja",
       "nazwa": "Frekwencja",
       "opis": "Procent obecności, nieobecności i lista do usprawiedliwienia",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.frekwencja]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.frekwencja]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_att() {\n  const a = A(E.FR), W = a.lista_wpisow || [], by = a.wpisy_wg_rodzaju || {};\n  const pct = typeof a.frekwencja_procent === 'number' ? a.frekwencja_procent : null;\n  const col = pct == null ? '#9e9e9e' : pct >= 90 ? GOOD : pct >= 80 ? WARN : BAD;\n  const statAbs = (by.nb || 0) + (by.u || 0) + (by.sp || 0) + (by.zw || 0);\n  const suspicious = W.length === 0 && statAbs > 0;\n  let html = head('mdi:account-check-outline', 'Frekwencja', pct != null ? chip('rok: ' + (a.frekwencja_procent_rok || pct).toFixed(1) + '%', col) : '');\n  if (suspicious) html += `<ha-alert alert-type=\"warning\" title=\"Dane niewiarygodne\">Statystyka zawiera nieobecności, a lista wpisów ucznia jest pusta – integracja prawdopodobnie pobrała statystykę innego konta.</ha-alert>`;\n  const it = (lab, v, c) => `<div style=\"display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:13px\"><span><span style=\"display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:6px\"></span>${lab}</span><b>${v}</b></div>`;\n  html += `<div style=\"display:flex;gap:16px;align-items:center;${suspicious ? 'opacity:.45;' : ''}\">${ring((pct || 0) / 100, col, 108, 11, pct != null ? pct.toFixed(1) + '%' : '—', 'semestr')}<div style=\"flex:1\">` +\n    it('Lekcji w semestrze', a.lekcji_w_semestrze || 0, E.ACC) + it('Nieobecności', a.liczba_nieobecnosci || 0, BAD) + it('· usprawiedliwione', a.liczba_usprawiedliwionych || 0, '#1e88e5') + it('· nieusprawiedliwione', a.liczba_nieusprawiedliwionych || 0, BAD) + it('Spóźnienia', a.liczba_spoznien || 0, WARN) + it('Zwolnienia', a.liczba_zwolnien || 0, '#8e24aa') + `</div></div>`;\n  const nb = W.filter((w) => w.symbol === 'nb').sort((x, y) => y.data.localeCompare(x.data));\n  html += `<div style=\"font-weight:600;font-size:13px;margin:12px 0 4px\">📝 Do usprawiedliwienia</div>` + (nb.length ? nb.slice(0, 8).map((w) => `<div style=\"padding:4px 0;border-top:1px solid var(--divider-color);font-size:13px\">❌ <b>${fmtd(w.data)}</b> (${DS[pd(w.data).getDay()]}) · lekcja ${esc(w.godzina)} · ${esc(w.przedmiot)}</div>`).join('') : `<div style=\"font-size:13px;color:${GOOD}\">✅ Wszystko usprawiedliwione</div>`);\n  return box(html);\n}\n\nreturn R_att();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "frekwencja_dni",
       "nazwa": "Nieobecności wg dnia tygodnia",
       "opis": "W które dni uczeń najczęściej opuszcza lekcje",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.frekwencja]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.frekwencja]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_attweek() {\n  const W = (A(E.FR).lista_wpisow || []).filter((w) => w.symbol !== 'ob');\n  const T = [['nb', 'nieusprawiedl.', BAD], ['u', 'usprawiedl.', '#1e88e5'], ['sp', 'spóźnienie', WARN], ['zw', 'zwolnienie', '#8e24aa']];\n  let html = head('mdi:calendar-week', 'Nieobecności wg dnia tygodnia', '');\n  if (!W.length) return box(html + empty('🙌', 'Brak nieobecności, spóźnień i zwolnień'));\n  const days = [1, 2, 3, 4, 5], m = {};\n  for (const d of days) m[d] = { tot: 0 };\n  for (const w of W) { const d = pd(w.data).getDay(); if (!m[d]) continue; const k = T.find((t) => t[0] === w.symbol) ? w.symbol : 'u'; m[d][k] = (m[d][k] || 0) + 1; m[d].tot++; }\n  const max = Math.max(1, ...days.map((d) => m[d].tot));\n  html += `<div style=\"display:flex;align-items:flex-end;gap:10px;height:120px\">` + days.map((d) => `<div style=\"flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%\"><div style=\"font-size:12px;font-weight:700;margin-bottom:3px\">${m[d].tot || ''}</div><div style=\"width:100%;max-width:40px;height:${Math.max(2, Math.round(100 * m[d].tot / max))}%;display:flex;flex-direction:column-reverse;border-radius:8px 8px 3px 3px;overflow:hidden;background:color-mix(in srgb, var(--primary-text-color) 9%, transparent)\">` +\n    T.map((t) => m[d][t[0]] ? `<div style=\"height:${100 * m[d][t[0]] / m[d].tot}%;background:${t[2]}\"></div>` : '').join('') + `</div></div>`).join('') + `</div>`;\n  html += `<div style=\"display:flex;gap:10px;padding-top:4px\">` + days.map((d) => `<div style=\"flex:1;text-align:center;font-weight:600;font-size:12px\">${DS[d]}</div>`).join('') + `</div>`;\n  html += `<div style=\"margin-top:8px\">` + T.map((t) => chip(t[1], t[2])).join('') + `</div>`;\n  const worst = days.slice().sort((x, y) => m[y].tot - m[x].tot)[0];\n  if (m[worst].tot) html += sub(`Najwięcej wpisów: <b>${['', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek'][worst]}</b> (${m[worst].tot})`);\n  return box(html);\n}\n\nreturn R_attweek();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "frekwencja_przedmioty",
       "nazwa": "Nieobecności wg przedmiotu",
       "opis": "Z których przedmiotów najwięcej nieobecności",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.frekwencja]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.frekwencja]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_0__function R_attsubj() {\n  const W = (A(E.FR).lista_wpisow || []).filter((w) => w.symbol !== 'ob'), m = {};\n  for (const w of W) { const k = w.przedmiot || '—'; (m[k] = m[k] || { n: 0, nb: 0, sp: 0, zw: 0, u: 0 }).n++; m[k][w.symbol] = (m[k][w.symbol] || 0) + 1; }\n  const K = Object.keys(m).sort((a, b) => m[b].n - m[a].n).slice(0, 8), max = Math.max(1, ...K.map((k) => m[k].n));\n  let html = head('mdi:book-account-outline', 'Nieobecności wg przedmiotu', '');\n  if (!K.length) return box(html + empty('🙌', 'Brak wpisów'));\n  html += K.map((k) => `<div style=\"margin:7px 0\"><div style=\"display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px\"><span>${esc(cap(k))}</span><span>${m[k].u ? chip('u ' + m[k].u, '#1e88e5') : ''}${m[k].zw ? chip('zw ' + m[k].zw, '#8e24aa') : ''}${m[k].sp ? chip('sp ' + m[k].sp, WARN) : ''}${m[k].nb ? chip('nb ' + m[k].nb, BAD) : ''}</span></div>${bar(100 * m[k].n / max, m[k].nb ? BAD : E.ACC, 7)}</div>`).join('');\n  return box(html);\n}\n\nreturn R_attsubj();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Grywalizacja",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Grywalizacja",
    "icon": "mdi:gamepad-variant-outline",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "poziom",
       "nazwa": "Poziom ucznia",
       "opis": "Grywalizacja: poziom i punkty doświadczenia",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.oceny]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.srednia_ocen]__",
         "__E[sensor.oceny]__",
         "__E[sensor.frekwencja]__",
         "__E[sensor.terminarz]__",
         "__E[sensor.plan_lekcji]__",
         "__E[sensor.zachowanie]__",
         "__E[sensor.uwagi_o_zachowaniu]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_1__function R_level() {\n  const g = gameData();\n  const TIT = ['Nowicjusz', 'Uczeń', 'Pilny uczeń', 'Bystrzak', 'Prymus', 'Mistrz wiedzy', 'Geniusz', 'Legenda szkoły'];\n  const tit = TIT[Math.min(g.lvl - 1, TIT.length - 1)], prog = 100 * (g.xp - g.lo) / (g.hi - g.lo);\n  let html = head('mdi:sword-cross', 'Poziom ucznia', chip(g.xp + ' XP', E.ACC));\n  html += `<div style=\"display:flex;gap:14px;align-items:center\"><div style=\"width:78px;height:78px;border-radius:50%;flex:none;background:linear-gradient(135deg, ${E.C1}, ${E.C2});color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 4px 14px color-mix(in srgb, ${E.C1} 45%, transparent)\"><div style=\"font-size:11px;opacity:.85\">LVL</div><div style=\"font-size:30px;font-weight:800;line-height:1\">${g.lvl}</div></div>` +\n    `<div style=\"flex:1;min-width:0\"><div style=\"font-size:18px;font-weight:700\">${tit}</div><div style=\"margin:6px 0 3px\">${bar(prog, E.ACC, 10)}</div>${sub(`${g.xp - g.lo} / ${g.hi - g.lo} XP · do poziomu ${g.lvl + 1} brakuje <b>${g.hi - g.xp} XP</b>`)}</div></div>`;\n  html += `<div style=\"display:flex;gap:8px;margin-top:12px\">` +\n    [['🔥', g.streak, 'seria ≥4 teraz'], ['🏅', g.best, 'najlepsza seria'], ['⭐', g.five, 'piątki z rzędu']].map((x) => `<div style=\"flex:1;text-align:center;border-radius:12px;padding:8px 4px;background:color-mix(in srgb, ${E.ACC} 10%, transparent)\"><div style=\"font-size:18px\">${x[0]}</div><div style=\"font-size:18px;font-weight:800\">${x[1]}</div><div style=\"font-size:10px;color:var(--secondary-text-color)\">${x[2]}</div></div>`).join('') + `</div>`;\n  const last = g.G.slice(-5).reverse();\n  if (last.length) html += `<div style=\"font-weight:600;font-size:13px;margin:12px 0 4px\">⚡ Ostatnio zdobyte</div>` + last.map((x) => { const v = String(x.ocena), b = XPG[v.charAt(0)]; const pts = b != null && gnum(v) != null ? b + (v.endsWith('+') ? 5 : v.endsWith('-') ? -5 : 0) : v === '+' ? 15 : 0; return `<div style=\"display:flex;justify-content:space-between;font-size:13px;padding:3px 0\"><span><b style=\"color:${gcol(v)}\">${esc(v)}</b> · ${esc(cap(x.przedmiot))}</span><span style=\"color:${pts ? GOOD : MUTED};font-weight:700\">+${pts} XP</span></div>`; }).join('');\n  html += sub('XP: 6=100 · 5=70 · 4=45 · 3=25 · 2=10 · bonus za frekwencję i pochwały.');\n  return box(html);\n}\n\nreturn R_level();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      },
      {
       "id": "odznaki",
       "nazwa": "Osiągnięcia",
       "opis": "Grywalizacja: zdobyte odznaki",
       "wymaga": [
        "button-card"
       ],
       "karta": {
        "type": "custom:button-card",
        "entity": "__E[sensor.oceny]__",
        "show_name": false,
        "show_icon": false,
        "show_state": false,
        "show_label": false,
        "tap_action": {
         "action": "none"
        },
        "hold_action": {
         "action": "none"
        },
        "double_tap_action": {
         "action": "none"
        },
        "triggers_update": [
         "__E[sensor.srednia_ocen]__",
         "__E[sensor.oceny]__",
         "__E[sensor.frekwencja]__",
         "__E[sensor.terminarz]__",
         "__E[sensor.plan_lekcji]__",
         "__E[sensor.zachowanie]__",
         "__E[sensor.uwagi_o_zachowaniu]__"
        ],
        "styles": {
         "card": [
          {
           "padding": "16px"
          },
          {
           "cursor": "default"
          },
          {
           "height": "100%"
          }
         ],
         "grid": [
          {
           "grid-template-areas": "\"c\""
          },
          {
           "grid-template-columns": "1fr"
          },
          {
           "grid-template-rows": "auto"
          }
         ],
         "custom_fields": {
          "c": [
           {
            "width": "100%"
           },
           {
            "align-self": "start"
           }
          ]
         }
        },
        "custom_fields": {
         "c": "__HELPER_1__function R_badges() {\n  const g = gameData(), vals = g.G.map((x) => String(x.ocena).trim());\n  const subj4 = g.avD.filter((d) => d.a >= 4).length, subj5 = g.avD.filter((d) => d.a >= 5).length;\n  const B = [\n    ['🌟', 'Szóstkowicz', 'Zdobądź ocenę celującą', vals.some((v) => v.charAt(0) === '6' && gnum(v) != null), ''],\n    ['🔥', 'Piątkowa seria', '3 oceny ≥5 z rzędu', g.five >= 3, `${Math.min(g.five, 3)}/3`],\n    ['🎯', 'Specjalista', 'Średnia ≥5,0 z przedmiotu', subj5 > 0, ''],\n    ['🧠', 'Wszechstronny', '5 przedmiotów ze średnią ≥4', subj4 >= 5, `${Math.min(subj4, 5)}/5`],\n    ['📚', 'Pracuś', '20 ocen w semestrze', g.G.length >= 20, `${Math.min(g.G.length, 20)}/20`],\n    ['🛡️', 'Bez jedynek', 'Żadnej oceny niedostatecznej', vals.length > 0 && !vals.some((v) => v.charAt(0) === '1' && gnum(v) != null), ''],\n    ['⏰', 'Punktualny', 'Zero spóźnień', g.sp === 0 && g.attOk, ''],\n    ['🙋', 'Zawsze obecny', 'Frekwencja ≥95%', g.pct >= 95 && g.attOk, `${g.pct.toFixed(0)}%`],\n    ['😇', 'Wzorowy', 'Brak negatywnych uwag', g.neg === 0, ''],\n    ['🎗️', 'Na pasek', 'Średnia ogólna ≥4,75', !isNaN(g.total) && g.total >= 4.75, isNaN(g.total) ? '' : g.total.toFixed(2)],\n  ];\n  const got = B.filter((b) => b[3]).length;\n  let html = head('mdi:trophy-outline', 'Osiągnięcia', chip(got + '/' + B.length, got ? GOOD : '#9e9e9e'));\n  html += `<div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px\">` + B.map((b) => `<div title=\"${esc(b[2])}\" style=\"border-radius:14px;padding:10px 6px;text-align:center;${b[3] ? `background:color-mix(in srgb, ${E.ACC} 13%, transparent);` : 'background:color-mix(in srgb, var(--primary-text-color) 5%, transparent);'}\"><div style=\"font-size:28px;${b[3] ? '' : 'filter:grayscale(1);opacity:.35'}\">${b[0]}</div>` +\n    `<div style=\"font-size:12px;font-weight:700;margin-top:2px;${b[3] ? '' : 'opacity:.55'}\">${b[1]}</div><div style=\"font-size:10px;color:var(--secondary-text-color);line-height:1.2;margin-top:2px\">${b[3] ? '✔ zdobyte' : '🔒 ' + esc(b[2]) + (b[4] ? ' · ' + b[4] : '')}</div></div>`).join('') + `</div>`;\n  return box(html);\n}\n\nreturn R_badges();\n]]]"
        },
        "grid_options": {
         "columns": "full",
         "rows": "auto"
        }
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Zachowanie i uwagi",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Zachowanie i uwagi",
    "icon": "mdi:star-face",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "zachowanie",
       "nazwa": "Zachowanie i uwagi",
       "opis": "Punkty, ocena z zachowania i ostatnie uwagi",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set s = states('__E[sensor.zachowanie]__') %}\n{% set pkt = state_attr('__E[sensor.zachowanie]__','punkty_startowe') %}\n**Punkty:** {{ s if s not in ['unknown','unavailable'] else '—' }}{% if pkt is not none %} (start: {{ pkt }}){% endif %}{% if state_attr('__E[sensor.zachowanie]__','suma_okres_1') is not none %} · okres 1: **{{ state_attr('__E[sensor.zachowanie]__','suma_okres_1') }}** · okres 2: **{{ state_attr('__E[sensor.zachowanie]__','suma_okres_2') }}**{% endif %}\n{% set oc = [('Przewidywana (okres 1)', state_attr('__E[sensor.zachowanie]__','ocena_przewidywana_okres_1')), ('Śródroczna', state_attr('__E[sensor.zachowanie]__','ocena_srodroczna')), ('Przewidywana (okres 2)', state_attr('__E[sensor.zachowanie]__','ocena_przewidywana_okres_2')), ('Roczna', state_attr('__E[sensor.zachowanie]__','ocena_roczna'))] | selectattr('1') | list %}\n{% for nazwa, w in oc %}- 🏅 {{ nazwa }}: **{{ w }}**\n{% endfor %}\n{% set wpisy = state_attr('__E[sensor.zachowanie]__','wpisy') or [] %}\n{% for w in (wpisy | sort(attribute='data', reverse=true))[:6] %}\n- {{ '👍' if w.typ == 'pozytywny' else '👎' }} **{{ w.punkty }}** · {{ w.kategoria }} · {{ w.data }}{% if w.komentarz %} — _{{ w.komentarz }}_{% endif %}\n{% endfor %}\n\n{% set uw = state_attr('__E[sensor.uwagi_o_zachowaniu]__','uwagi') or [] %}\n**Uwagi:** 👍 {{ state_attr('__E[sensor.uwagi_o_zachowaniu]__','liczba_pozytywnych') | int(0) }} · 👎 {{ state_attr('__E[sensor.uwagi_o_zachowaniu]__','liczba_negatywnych') | int(0) }} · ➖ {{ state_attr('__E[sensor.uwagi_o_zachowaniu]__','liczba_neutralnych') | int(0) }}\n{% if not uw and not wpisy %}\n<ha-alert alert-type=\"success\">Brak uwag i wpisów – tak trzymać! 👏</ha-alert>\n{% endif %}\n{% for u in (uw | sort(attribute='data', reverse=true))[:6] %}\n<details><summary>{{ '👍' if u.rodzaj == 'pozytywna' else '👎' if u.rodzaj == 'negatywna' else '➖' }} <b>{{ u.kategoria }}</b> · {{ u.data }}</summary>\n\n{{ u.tresc }}\n<font color=\"#9e9e9e\">{{ u.nauczyciel }}</font>\n\n</details>\n{% endfor %}",
        "text_only": false
       }
      }
     ]
    },
    {
     "naglowek": {
      "type": "heading",
      "heading": "Ogłoszenia szkolne",
      "icon": "mdi:bullhorn-outline",
      "heading_style": "subtitle"
     },
     "elementy": [
      {
       "id": "ogloszenia",
       "nazwa": "Ogłoszenia szkolne",
       "opis": "Najnowsze ogłoszenia z tablicy",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set ogl = state_attr('__E[sensor.ogloszenia]__','lista_ogloszen') or [] %}\n{% if not ogl %}Brak nowych ogłoszeń 📭{% endif %}\n{% for o in ogl[:6] %}\n<details><summary>📢 <b>{{ o.tytul }}</b><br><font color=\"#9e9e9e\">{{ o.nadawca }} · {{ o.data }}</font></summary>\n\n{{ (o.opis or '') | regex_replace('<[^>]*>', '') | truncate(1200) }}\n\n</details>\n{% endfor %}",
        "text_only": false
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Wiadomości",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Wiadomości",
    "icon": "mdi:email-outline",
    "heading_style": "title",
    "badges": [
     {
      "type": "entity",
      "entity": "__E[sensor.wiadomosci]__",
      "show_state": true,
      "show_icon": false
     }
    ]
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "wiadomosci",
       "nazwa": "Wiadomości",
       "opis": "Ostatnie wiadomości z Librusa",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{% set msgs = state_attr('__E[sensor.wiadomosci]__','wiadomosci') or [] %}\n{% set msgs = msgs | rejectattr('temat','eq','Brak') | list %}\n{% if not msgs %}Brak wiadomości 📭{% endif %}\n{% for m in msgs[:10] %}\n{% set tresc = (m.tresc or '') | regex_replace('(?i)<br\\\\s*/?>', '\\n') | regex_replace('<[^>]*>', '') | replace('&nbsp;', ' ') | trim %}\n<details><summary>{{ '🔴' if m.nieprzeczytana else '🆕' if m.jest_nowa else '✉️' }} <b>{{ m.temat | trim }}</b>{{ ' 📎' if m.ma_zalacznik else '' }}<br><font color=\"#9e9e9e\">{{ m.nadawca | regex_replace('\\\\s*\\\\([^)]*\\\\)', '') }} · {{ m.data[8:10] }}.{{ m.data[5:7] }} {{ m.data[11:16] }}</font></summary>\n\n{{ (tresc | truncate(1500)) | replace('\\n', '  \\n') if tresc else '_Brak pobranej treści_' }}\n\n</details>\n{% endfor %}",
        "text_only": false
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Kalendarz",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Kalendarz",
    "icon": "mdi:calendar-month",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "kalendarz",
       "nazwa": "Kalendarz",
       "opis": "Plan lekcji i terminarz w karcie kalendarza",
       "wymaga": [],
       "karta": {
        "type": "calendar",
        "initial_view": "dayGridMonth",
        "entities": [
         "__E[calendar.terminarz_kalendarz]__",
         "__E[calendar.plan_lekcji_kalendarz]__"
        ]
       }
      }
     ]
    }
   ]
  },
  {
   "nazwa": "Asystent AI",
   "sekcja": {
    "type": "grid"
   },
   "tytul": {
    "type": "heading",
    "heading": "Asystent AI",
    "icon": "mdi:robot-happy-outline",
    "heading_style": "title"
   },
   "grupy": [
    {
     "naglowek": null,
     "elementy": [
      {
       "id": "ai_raporty",
       "nazwa": "Raporty asystenta AI",
       "opis": "Raport tygodniowy i podsumowanie wiadomości",
       "wymaga": [],
       "karta": {
        "type": "markdown",
        "content": "{%- macro kiedy(e) -%}{% set t = states(e) %}{% if t not in ['unknown','unavailable'] %}{{ as_local(as_datetime(t)).strftime('%d.%m %H:%M') }}{% else %}—{% endif %}{%- endmacro -%}\n{% set air = state_attr('__E[sensor.podsumowanie_ai_rodzic]__','pełny_tekst') or states('__E[sensor.podsumowanie_ai_rodzic]__') %}\n{% set aiu = state_attr('__E[sensor.podsumowanie_ai_uczen]__','pełny_tekst') or states('__E[sensor.podsumowanie_ai_uczen]__') %}\n{% set aiw = state_attr('__E[sensor.podsumowanie_wiadomosci_ai_rodzic]__','pełny_tekst') or states('__E[sensor.podsumowanie_wiadomosci_ai_rodzic]__') %}\n<details open><summary>👨‍👩‍👦 <b>Podsumowanie tygodnia – dla rodzica</b> <font color=\"#9e9e9e\">({{ kiedy('__E[button.generuj_podsumowanie_ai]__') }})</font></summary>\n\n{{ air if air not in ['unknown','unavailable',''] else '_Brak podsumowania – użyj przycisku poniżej._' }}\n\n</details>\n\n<details><summary>🧒 <b>Wersja dla ucznia</b></summary>\n\n{{ aiu if aiu not in ['unknown','unavailable',''] else '_Brak_' }}\n\n</details>\n\n<details><summary>✉️ <b>Podsumowanie wiadomości</b> <font color=\"#9e9e9e\">({{ kiedy('__E[button.generuj_podsumowanie_wiadomosci_ai]__') }})</font></summary>\n\n{{ aiw if aiw not in ['unknown','unavailable',''] else '_Brak_' }}\n\n</details>",
        "text_only": false
       }
      },
      {
       "id": "przycisk_odswiez",
       "nazwa": "Przycisk: odśwież dane",
       "opis": "Ręczne pobranie danych z Librusa",
       "wymaga": [],
       "karta": {
        "type": "tile",
        "entity": "__E[button.odswiez_dane]__",
        "name": "Odśwież",
        "icon": "mdi:refresh",
        "vertical": true,
        "hide_state": false,
        "tap_action": {
         "action": "perform-action",
         "perform_action": "button.press",
         "target": {
          "entity_id": "__E[button.odswiez_dane]__"
         }
        },
        "icon_tap_action": {
         "action": "more-info"
        },
        "grid_options": {
         "columns": 4,
         "rows": 2
        }
       }
      },
      {
       "id": "przycisk_ai",
       "nazwa": "Przycisk: raport AI",
       "opis": "Wygenerowanie raportu tygodniowego",
       "wymaga": [],
       "karta": {
        "type": "tile",
        "entity": "__E[button.generuj_podsumowanie_ai]__",
        "name": "Podsum. AI",
        "icon": "mdi:robot-outline",
        "vertical": true,
        "hide_state": false,
        "tap_action": {
         "action": "perform-action",
         "perform_action": "button.press",
         "target": {
          "entity_id": "__E[button.generuj_podsumowanie_ai]__"
         },
         "confirmation": {
          "text": "Wygenerować nowe podsumowanie AI dla: __IMIE__?"
         }
        },
        "icon_tap_action": {
         "action": "more-info"
        },
        "grid_options": {
         "columns": 4,
         "rows": 2
        }
       }
      },
      {
       "id": "przycisk_ai_wiadomosci",
       "nazwa": "Przycisk: podsumowanie wiadomości AI",
       "opis": "Wygenerowanie podsumowania wiadomości",
       "wymaga": [],
       "karta": {
        "type": "tile",
        "entity": "__E[button.generuj_podsumowanie_wiadomosci_ai]__",
        "name": "Wiadomości AI",
        "icon": "mdi:email-fast-outline",
        "vertical": true,
        "hide_state": false,
        "tap_action": {
         "action": "perform-action",
         "perform_action": "button.press",
         "target": {
          "entity_id": "__E[button.generuj_podsumowanie_wiadomosci_ai]__"
         },
         "confirmation": {
          "text": "Wygenerować podsumowanie wiadomości AI dla: __IMIE__?"
         }
        },
        "icon_tap_action": {
         "action": "more-info"
        },
        "grid_options": {
         "columns": 4,
         "rows": 2
        }
       }
      }
     ]
    }
   ]
  }
 ],
 "helpery": [
  "[[[\nconst S = states; const E = {\"INFO\": \"__E[sensor.informacje_o_uczniu]__\", \"SR\": \"__E[sensor.srednia_ocen]__\", \"OC\": \"__E[sensor.oceny]__\", \"FR\": \"__E[sensor.frekwencja]__\", \"TERM\": \"__E[sensor.terminarz]__\", \"PLAN\": \"__E[sensor.plan_lekcji]__\", \"ZACH\": \"__E[sensor.zachowanie]__\", \"UW\": \"__E[sensor.uwagi_o_zachowaniu]__\", \"ACC\": \"__ACC__\", \"C1\": \"__C1__\", \"C2\": \"__C2__\", \"GOAL\": __GOAL__};\nconst A = (id) => (S[id] && S[id].attributes) || {};\nconst st = (id) => (S[id] ? S[id].state : undefined);\nconst esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\nconst GC = { 1: '#e53935', 2: '#fb8c00', 3: '#f9a825', 4: '#7cb342', 5: '#43a047', 6: '#00897b' };\nconst GOOD = '#43a047', WARN = '#fb8c00', BAD = '#e53935', MUTED = 'var(--secondary-text-color)';\nconst gcol = (v) => GC[String(v).charAt(0)] || '#9e9e9e';\nconst acol = (a) => (typeof a !== 'number' || !(a > 0)) ? '#9e9e9e' : a >= 4.5 ? '#43a047' : a >= 3.5 ? '#7cb342' : a >= 2.5 ? '#f9a825' : a >= 1.75 ? '#fb8c00' : '#e53935';\nconst gnum = (v) => { const m = String(v).trim().match(/^([1-6])([+-]?)$/); if (!m) return null; return +m[1] + (m[2] === '+' ? 0.5 : m[2] === '-' ? -0.25 : 0); };\nconst cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');\nconst pd = (s) => { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };\nconst today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };\nconst ddiff = (s) => Math.round((pd(s) - today0()) / 86400000);\nconst ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');\nconst DS = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];\nconst fmtd = (s) => String(s).slice(8, 10) + '.' + String(s).slice(5, 7);\nconst kiedy = (d) => d === 0 ? 'dziś' : d === 1 ? 'jutro' : d === 2 ? 'pojutrze' : 'za ' + d + ' dni';\nconst pl = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c;\nconst allGrades = () => { const o = A(E.OC).oceny_wg_przedmiotu || {}; const r = []; for (const p of Object.keys(o)) for (const g of (o[p] || [])) r.push(Object.assign({}, g, { przedmiot: p })); return r; };\nconst avgs = () => { const o = A(E.SR).srednie_wg_przedmiotow || {}; return Object.keys(o).filter((k) => typeof o[k] === 'number' && o[k] > 0).map((k) => ({ p: k, a: o[k] })); };\nconst SHORT = { 'język polski': 'J. polski', 'język angielski': 'J. ang.', 'język niemiecki': 'J. niem.', 'język francuski': 'J. franc.', 'wychowanie fizyczne': 'WF', 'edukacja zdrowotna': 'Ed. zdrow.', 'biznes i zarządzanie': 'Biznes', 'edukacja dla bezpieczeństwa': 'EDB', 'wiedza o społeczeństwie': 'WOS', 'zajęcia z wychowawcą': 'Godz. wych.' };\nconst short = (p) => SHORT[p] || (p.length > 11 ? cap(p.split(' ')[0]).slice(0, 10) + '.' : cap(p));\nconst chip = (txt, color) => `<span style=\"display:inline-block;padding:2px 9px;border-radius:12px;background:color-mix(in srgb, ${color} 16%, transparent);color:${color};font-weight:600;font-size:12px;margin:2px 4px 2px 0;white-space:nowrap\">${txt}</span>`;\nconst bar = (pct, color, h) => { h = h || 8; return `<div style=\"background:color-mix(in srgb, var(--primary-text-color) 9%, transparent);border-radius:${h}px;height:${h}px;overflow:hidden\"><div style=\"width:${Math.max(0, Math.min(100, pct))}%;height:100%;background:${color};border-radius:${h}px\"></div></div>`; };\nconst head = (icon, t, right) => `<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:12px\"><ha-icon icon=\"${icon}\" style=\"--mdc-icon-size:20px;color:${E.ACC}\"></ha-icon><span style=\"font-weight:600;font-size:15px;flex:1\">${t}</span>${right || ''}</div>`;\nconst sub = (t) => `<div style=\"color:var(--secondary-text-color);font-size:12px\">${t}</div>`;\nconst box = (inner) => `<div style=\"text-align:left;font-size:14px;line-height:1.45;color:var(--primary-text-color);white-space:normal\">${inner}</div>`;\nconst empty = (emoji, t) => `<div style=\"text-align:center;padding:14px 0;color:var(--secondary-text-color)\"><div style=\"font-size:30px\">${emoji}</div>${t}</div>`;\nconst ring = (pct, color, size, stroke, big, small) => {\n  const r = 50 - stroke / 2 - 1, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));\n  return `<svg viewBox=\"0 0 100 100\" width=\"${size}\" height=\"${size}\" style=\"flex:none\"><circle cx=\"50\" cy=\"50\" r=\"${r}\" fill=\"none\" style=\"stroke:color-mix(in srgb, var(--primary-text-color) 9%, transparent)\" stroke-width=\"${stroke}\"/>` +\n    `<circle cx=\"50\" cy=\"50\" r=\"${r}\" fill=\"none\" stroke=\"${color}\" stroke-width=\"${stroke}\" stroke-linecap=\"round\" stroke-dasharray=\"${(c * p).toFixed(1)} ${c.toFixed(1)}\" transform=\"rotate(-90 50 50)\"/>` +\n    `<text x=\"50\" y=\"${small ? 50 : 57}\" text-anchor=\"middle\" style=\"fill:var(--primary-text-color);font-size:${big.length > 4 ? 20 : 26}px;font-weight:700\">${big}</text>` +\n    (small ? `<text x=\"50\" y=\"68\" text-anchor=\"middle\" style=\"fill:var(--secondary-text-color);font-size:11px\">${small}</text>` : '') + `</svg>`;\n};\nconst tmin = (s) => { const m = /(\\d{1,2}):(\\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };\nconst lessonName = (x) => x.odwolana ? `<s style=\"opacity:.6\">${esc(x.przedmiot)}</s> ${chip('odwołana', BAD)}` : x.zastepstwo ? `<b style=\"color:#1e88e5\">${esc(x.przedmiot)}</b> ${chip('zastępstwo', '#1e88e5')}` : x.zdarzenie ? `<b style=\"color:${BAD}\">${esc(x.przedmiot)}</b> ${chip(esc(x.zdarzenie), BAD)}` : `<b>${esc(x.przedmiot)}</b>`;\nconst tests = () => (A(E.TERM).zdarzenia || []).filter((z) => (z.rodzaj === 'sprawdzian' || z.rodzaj === 'kartkowka') && ddiff(z.data) >= 0).sort((a, b) => (a.data + (a.numer_lekcji || '')).localeCompare(b.data + (b.numer_lekcji || '')));\nconst opisOf = (z) => { const o = z.szczegoly && z.szczegoly.Opis; return o && String(o).toLowerCase() !== 'unknown' ? String(o) : ''; };\n\n",
  "[[[\nconst S = states; const E = {\"INFO\": \"__E[sensor.informacje_o_uczniu]__\", \"SR\": \"__E[sensor.srednia_ocen]__\", \"OC\": \"__E[sensor.oceny]__\", \"FR\": \"__E[sensor.frekwencja]__\", \"TERM\": \"__E[sensor.terminarz]__\", \"PLAN\": \"__E[sensor.plan_lekcji]__\", \"ZACH\": \"__E[sensor.zachowanie]__\", \"UW\": \"__E[sensor.uwagi_o_zachowaniu]__\", \"ACC\": \"__ACC__\", \"C1\": \"__C1__\", \"C2\": \"__C2__\", \"GOAL\": __GOAL__};\nconst A = (id) => (S[id] && S[id].attributes) || {};\nconst st = (id) => (S[id] ? S[id].state : undefined);\nconst esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));\nconst GC = { 1: '#e53935', 2: '#fb8c00', 3: '#f9a825', 4: '#7cb342', 5: '#43a047', 6: '#00897b' };\nconst GOOD = '#43a047', WARN = '#fb8c00', BAD = '#e53935', MUTED = 'var(--secondary-text-color)';\nconst gcol = (v) => GC[String(v).charAt(0)] || '#9e9e9e';\nconst acol = (a) => (typeof a !== 'number' || !(a > 0)) ? '#9e9e9e' : a >= 4.5 ? '#43a047' : a >= 3.5 ? '#7cb342' : a >= 2.5 ? '#f9a825' : a >= 1.75 ? '#fb8c00' : '#e53935';\nconst gnum = (v) => { const m = String(v).trim().match(/^([1-6])([+-]?)$/); if (!m) return null; return +m[1] + (m[2] === '+' ? 0.5 : m[2] === '-' ? -0.25 : 0); };\nconst cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');\nconst pd = (s) => { const p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };\nconst today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };\nconst ddiff = (s) => Math.round((pd(s) - today0()) / 86400000);\nconst ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');\nconst DS = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];\nconst fmtd = (s) => String(s).slice(8, 10) + '.' + String(s).slice(5, 7);\nconst kiedy = (d) => d === 0 ? 'dziś' : d === 1 ? 'jutro' : d === 2 ? 'pojutrze' : 'za ' + d + ' dni';\nconst pl = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c;\nconst allGrades = () => { const o = A(E.OC).oceny_wg_przedmiotu || {}; const r = []; for (const p of Object.keys(o)) for (const g of (o[p] || [])) r.push(Object.assign({}, g, { przedmiot: p })); return r; };\nconst avgs = () => { const o = A(E.SR).srednie_wg_przedmiotow || {}; return Object.keys(o).filter((k) => typeof o[k] === 'number' && o[k] > 0).map((k) => ({ p: k, a: o[k] })); };\nconst SHORT = { 'język polski': 'J. polski', 'język angielski': 'J. ang.', 'język niemiecki': 'J. niem.', 'język francuski': 'J. franc.', 'wychowanie fizyczne': 'WF', 'edukacja zdrowotna': 'Ed. zdrow.', 'biznes i zarządzanie': 'Biznes', 'edukacja dla bezpieczeństwa': 'EDB', 'wiedza o społeczeństwie': 'WOS', 'zajęcia z wychowawcą': 'Godz. wych.' };\nconst short = (p) => SHORT[p] || (p.length > 11 ? cap(p.split(' ')[0]).slice(0, 10) + '.' : cap(p));\nconst chip = (txt, color) => `<span style=\"display:inline-block;padding:2px 9px;border-radius:12px;background:color-mix(in srgb, ${color} 16%, transparent);color:${color};font-weight:600;font-size:12px;margin:2px 4px 2px 0;white-space:nowrap\">${txt}</span>`;\nconst bar = (pct, color, h) => { h = h || 8; return `<div style=\"background:color-mix(in srgb, var(--primary-text-color) 9%, transparent);border-radius:${h}px;height:${h}px;overflow:hidden\"><div style=\"width:${Math.max(0, Math.min(100, pct))}%;height:100%;background:${color};border-radius:${h}px\"></div></div>`; };\nconst head = (icon, t, right) => `<div style=\"display:flex;align-items:center;gap:8px;margin-bottom:12px\"><ha-icon icon=\"${icon}\" style=\"--mdc-icon-size:20px;color:${E.ACC}\"></ha-icon><span style=\"font-weight:600;font-size:15px;flex:1\">${t}</span>${right || ''}</div>`;\nconst sub = (t) => `<div style=\"color:var(--secondary-text-color);font-size:12px\">${t}</div>`;\nconst box = (inner) => `<div style=\"text-align:left;font-size:14px;line-height:1.45;color:var(--primary-text-color);white-space:normal\">${inner}</div>`;\nconst empty = (emoji, t) => `<div style=\"text-align:center;padding:14px 0;color:var(--secondary-text-color)\"><div style=\"font-size:30px\">${emoji}</div>${t}</div>`;\nconst ring = (pct, color, size, stroke, big, small) => {\n  const r = 50 - stroke / 2 - 1, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));\n  return `<svg viewBox=\"0 0 100 100\" width=\"${size}\" height=\"${size}\" style=\"flex:none\"><circle cx=\"50\" cy=\"50\" r=\"${r}\" fill=\"none\" style=\"stroke:color-mix(in srgb, var(--primary-text-color) 9%, transparent)\" stroke-width=\"${stroke}\"/>` +\n    `<circle cx=\"50\" cy=\"50\" r=\"${r}\" fill=\"none\" stroke=\"${color}\" stroke-width=\"${stroke}\" stroke-linecap=\"round\" stroke-dasharray=\"${(c * p).toFixed(1)} ${c.toFixed(1)}\" transform=\"rotate(-90 50 50)\"/>` +\n    `<text x=\"50\" y=\"${small ? 50 : 57}\" text-anchor=\"middle\" style=\"fill:var(--primary-text-color);font-size:${big.length > 4 ? 20 : 26}px;font-weight:700\">${big}</text>` +\n    (small ? `<text x=\"50\" y=\"68\" text-anchor=\"middle\" style=\"fill:var(--secondary-text-color);font-size:11px\">${small}</text>` : '') + `</svg>`;\n};\nconst tmin = (s) => { const m = /(\\d{1,2}):(\\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };\nconst lessonName = (x) => x.odwolana ? `<s style=\"opacity:.6\">${esc(x.przedmiot)}</s> ${chip('odwołana', BAD)}` : x.zastepstwo ? `<b style=\"color:#1e88e5\">${esc(x.przedmiot)}</b> ${chip('zastępstwo', '#1e88e5')}` : x.zdarzenie ? `<b style=\"color:${BAD}\">${esc(x.przedmiot)}</b> ${chip(esc(x.zdarzenie), BAD)}` : `<b>${esc(x.przedmiot)}</b>`;\nconst tests = () => (A(E.TERM).zdarzenia || []).filter((z) => (z.rodzaj === 'sprawdzian' || z.rodzaj === 'kartkowka') && ddiff(z.data) >= 0).sort((a, b) => (a.data + (a.numer_lekcji || '')).localeCompare(b.data + (b.numer_lekcji || '')));\nconst opisOf = (z) => { const o = z.szczegoly && z.szczegoly.Opis; return o && String(o).toLowerCase() !== 'unknown' ? String(o) : ''; };\n\nconst XPG = { 6: 100, 5: 70, 4: 45, 3: 25, 2: 10, 1: 0 };\nconst gameData = () => {\n  const G = allGrades().sort((a, b) => String(a.data).localeCompare(String(b.data)));\n  const fr = A(E.FR), uw = A(E.UW), za = A(E.ZACH), avD = avgs();\n  let xp = 0;\n  for (const g of G) { const v = String(g.ocena).trim(), b = XPG[v.charAt(0)]; if (b != null && gnum(v) != null) xp += b + (v.endsWith('+') ? 5 : v.endsWith('-') ? -5 : 0); else if (v === '+') xp += 15; }\n  const pct = typeof fr.frekwencja_procent === 'number' ? fr.frekwencja_procent : 0;\n  const attBonus = pct >= 98 ? 150 : pct >= 95 ? 100 : pct >= 90 ? 50 : 0;\n  const pos = (uw.liczba_pozytywnych || 0) + (za.liczba_wpisow_pozytywnych || 0), neg = (uw.liczba_negatywnych || 0) + (za.liczba_wpisow_negatywnych || 0);\n  xp += attBonus + 30 * pos - 30 * neg; xp = Math.max(0, Math.round(xp));\n  let lvl = 1; while (75 * (lvl + 1) * lvl <= xp) lvl++;\n  const lo = 75 * lvl * (lvl - 1), hi = 75 * (lvl + 1) * lvl;\n  let streak = 0; for (let i = G.length - 1; i >= 0; i--) { const v = gnum(G[i].ocena); if (v == null) continue; if (v >= 4) streak++; else break; }\n  let best = 0, run = 0; for (const g of G) { const v = gnum(g.ocena); if (v == null) continue; run = v >= 4 ? run + 1 : 0; best = Math.max(best, run); }\n  let five = 0, r5 = 0; for (const g of G) { const v = gnum(g.ocena); if (v == null) continue; r5 = v >= 5 ? r5 + 1 : 0; five = Math.max(five, r5); }\n  const total = parseFloat(st(E.SR));\n  return { G, xp, lvl, lo, hi, streak, best, five, pct, pos, neg, attBonus, avD, total, sp: fr.liczba_spoznien || 0, attOk: (fr.lista_wpisow || []).length > 0 || !((fr.wpisy_wg_rodzaju || {}).u || (fr.wpisy_wg_rodzaju || {}).zw) };\n};\n\n"
 ]
};
