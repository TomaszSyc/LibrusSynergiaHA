import logging
import json
import re
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .ai_prompts import (
    DEFAULT_PROMPT_WEEKLY_PARENT,
    DEFAULT_PROMPT_WEEKLY_STUDENT,
    DEFAULT_PROMPT_MESSAGES_PARENT,
    DEFAULT_PROMPT_MESSAGES_STUDENT,
)

_LOGGER = logging.getLogger(__name__)


def _parse_ai_json_response(result_text: str) -> dict:
    """Odporne wyodrębnienie i sparsowanie obiektu JSON z odpowiedzi modelu AI."""
    text = (result_text or "").strip()
    if not text:
        return {}

    # 1. Bezpośrednia próba parsowania
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except (json.JSONDecodeError, ValueError):
        pass

    # 2. Blok markdown ```json ... ``` lub ``` ... ```
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1).strip())
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, ValueError):
            pass

    # 3. Pierwszy i ostatni nawias klamrowy { ... } w tekście
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1).strip())
            if isinstance(data, dict):
                return data
        except (json.JSONDecodeError, ValueError):
            pass

    # 4. Fallback: jeśli model nie zwrócił poprawnego JSON
    _LOGGER.warning("AI nie zwróciło poprawnego JSONa. Używam surowego tekstu.")
    return {"rodzic": text, "uczen": text}


def _parse_date(date_str: str):
    """Pomocnicze parsowanie daty z różnych formatów stosowanych w Librusie."""
    if not date_str:
        return None
    from datetime import datetime
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y",
    ):
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _format_grades(coordinator_data: dict, days: int = 7) -> str:
    """Formatuj oceny zdobyte w ostatnich `days` dniach (domyślnie 7 dni)."""
    from datetime import date, timedelta
    today = date.today()
    cutoff = today - timedelta(days=days)
    oceny_wg_przedmiotu = coordinator_data.get("oceny_wg_przedmiotu") or {}
    wyniki = []

    for subject, grades in oceny_wg_przedmiotu.items():
        w_okresie = []
        for g in grades:
            d = _parse_date(g.get("data") or g.get("date"))
            if d and d >= cutoff:
                kat = f" ({g.get('kategoria')})" if g.get("kategoria") else ""
                data_str = f", {d.strftime('%Y-%m-%d')}"
                w_okresie.append(f"{g.get('ocena')}{kat}{data_str}")
        if w_okresie:
            wyniki.append(f"- {subject}: " + "; ".join(w_okresie))

    return "\n".join(wyniki) if wyniki else "Brak nowych ocen w wybranym okresie"


def _format_exams(coordinator_data: dict, days: int = 7) -> str:
    """Formatuj zapowiedziane sprawdziany i kartkówki z Terminarza na `days` dni w przód (domyślnie 7)."""
    from datetime import date, timedelta
    today = date.today()
    max_date = today + timedelta(days=days)
    terminarz = coordinator_data.get("terminarz") or []

    test_types = ("sprawdzian", "kartkowka", "klasowka", "praca klasowa", "test")
    wyniki = []

    for ev in terminarz:
        d = _parse_date(ev.get("data"))
        if not d or not (today <= d <= max_date):
            continue

        rodzaj = (ev.get("rodzaj") or "").lower()
        tytul = (ev.get("tytul") or "").lower()
        if any(t in rodzaj or t in tytul for t in test_types):
            przedmiot = ev.get("przedmiot") or "Zadanie"
            tytul_oryg = ev.get("tytul") or "Sprawdzian"
            dzien_tyg = ev.get("tydzien") or ""
            dzien_str = f" ({dzien_tyg})" if dzien_tyg else ""

            szczegoly = ev.get("szczegoly") or {}
            opis = szczegoly.get("Opis") or ""
            if opis and str(opis).lower() != "unknown":
                opis_str = f" - zakres: {str(opis).replace(chr(10), ' ')}"
            else:
                opis_str = ""

            godzina = f", godz. {ev.get('godzina')}" if ev.get("godzina") else ""
            wyniki.append(f"- {ev.get('data')}{dzien_str} {przedmiot}: {tytul_oryg}{godzina}{opis_str}")

    return "\n".join(wyniki) if wyniki else "Brak zapowiedzianych sprawdzianów w wybranym okresie"


def _format_homework(coordinator_data: dict, days: int = 7) -> str:
    """Formatuj zadania domowe z modułu zadań na `days` dni w przód (domyślnie 7)."""
    from datetime import date, timedelta
    today = date.today()
    max_date = today + timedelta(days=days)
    zadania = coordinator_data.get("zadania") or []
    wyniki = []

    for z in zadania:
        termin_str = z.get("termin") or ""
        d = _parse_date(termin_str)
        if d and not (today <= d <= max_date):
            continue
        przedmiot = z.get("przedmiot") or "Przedmiot"
        kat = z.get("kategoria") or "Zadanie"
        t_info = f" (termin: {termin_str})" if termin_str else ""
        wyniki.append(f"- {przedmiot}: {kat}{t_info}")

    return "\n".join(wyniki) if wyniki else "Brak zapowiedzianych zadań domowych w wybranym okresie"


def _format_notes(coordinator_data: dict, days: int = 7) -> str:
    """Formatuj uwagi wpisane w ostatnich `days` dniach (domyślnie 7)."""
    from datetime import date, timedelta
    today = date.today()
    cutoff = today - timedelta(days=days)
    uwagi = coordinator_data.get("uwagi") or []
    wyniki = []

    for u in uwagi:
        d = _parse_date(u.get("data"))
        if d and d < cutoff:
            continue
        rodzaj = u.get("rodzaj", "inna")
        tresc = u.get("tresc", "")
        kategoria = u.get("kategoria", "")
        nauczyciel = u.get("nauczyciel", "")
        prefix = f"[{rodzaj.upper()}]" if rodzaj else ""
        kat_str = f" {kategoria}:" if kategoria else ""
        nauczyciel_str = f" (nauczyciel: {nauczyciel})" if nauczyciel else ""
        data_str = f" [{u.get('data')}]" if u.get("data") else ""
        wyniki.append(f"- {prefix}{kat_str} {tresc}{nauczyciel_str}{data_str}".strip())

    return "\n".join(wyniki) if wyniki else "Brak uwag w wybranym okresie"


def _format_attendance_frequency(coordinator_data: dict, days: int = 7) -> str:
    """Wylicz procent frekwencji w ostatnich `days` dniach (domyślnie 7)."""
    from datetime import date, timedelta
    today = date.today()
    cutoff = today - timedelta(days=days)

    tematy = coordinator_data.get("tematy_lekcji") or []
    lekcje_w_okresie = []
    for l in tematy:
        d = _parse_date(l.get("data"))
        if d and d >= cutoff:
            lekcje_w_okresie.append(l)

    # 1. Sprawdzenie, czy zrealizowane lekcje zawierają odnotowaną obecność (ob, nb, sp, u, zw)
    z_symbolem = [l for l in lekcje_w_okresie if l.get("obecnosc")]
    if z_symbolem:
        obecne = [l for l in z_symbolem if (l.get("obecnosc") or "").lower() in ("ob", "wy", "obecność")]
        proc = round(100.0 * len(obecne) / len(z_symbolem), 1)
        return f"{proc}% ({len(obecne)}/{len(z_symbolem)} zrealizowanych lekcji)"

    # 2. Sprawdzenie wpisów nieobecności w module frekwencji dla tego okresu
    frekwencja = coordinator_data.get("frekwencja") or []
    nieobecnosci_w_okresie = []
    for f in frekwencja:
        d = _parse_date(f.get("data"))
        if d and d >= cutoff:
            sym = (f.get("symbol") or "").lower()
            if sym not in ("", "ob", "wy", "obecność"):
                nieobecnosci_w_okresie.append(f)

    # Jeśli mamy zrealizowane lekcje (ale bez kolumny obecności), odejmujemy opuszczone lekcje z modułu frekwencji
    if lekcje_w_okresie:
        total = len(lekcje_w_okresie)
        nb_count = len(nieobecnosci_w_okresie)
        ob_count = max(0, total - nb_count)
        proc = round(100.0 * ob_count / total, 1)
        return f"{proc}% ({ob_count}/{total} lekcji)"

    # 3. Jeśli brak odnotowanych nieobecności w okresie
    if not nieobecnosci_w_okresie:
        return "100.0% (brak opuszczonych lekcji w wybranym okresie)"

    return f"Odnotowano {len(nieobecnosci_w_okresie)} opuszczonych lekcji w wybranym okresie"


def _format_absences(coordinator_data: dict, days: int = 7) -> str:
    """Formatuj spóźnienia i nieobecności z ostatnich `days` dni (domyślnie 7)."""
    from datetime import date, timedelta
    today = date.today()
    cutoff = today - timedelta(days=days)

    wyniki = []
    seen = set()

    # 1. Wpisy z modułu frekwencji
    frekwencja = coordinator_data.get("frekwencja") or []
    for f in frekwencja:
        d = _parse_date(f.get("data"))
        if not d or d < cutoff:
            continue
        sym = (f.get("symbol") or "").lower()
        if sym in ("", "ob", "wy", "obecność"):
            continue

        typ = f.get("typ") or sym
        przedmiot = f.get("przedmiot") or ""
        godzina = f.get("godzina")
        godz_str = f", lekcja {godzina}" if godzina else ""
        przedmiot_str = f" ({przedmiot})" if przedmiot else ""
        data_str = d.strftime("%Y-%m-%d")

        key = (data_str, godzina, przedmiot, sym)
        if key not in seen:
            seen.add(key)
            wyniki.append(f"- {data_str}{godz_str}{przedmiot_str}: {typ}")

    # 2. Wpisy ze zrealizowanych lekcji (tematy_lekcji)
    tematy = coordinator_data.get("tematy_lekcji") or []
    for l in tematy:
        d = _parse_date(l.get("data"))
        if not d or d < cutoff:
            continue
        sym = (l.get("obecnosc") or "").lower()
        if sym in ("", "ob", "wy", "obecność"):
            continue

        opis = l.get("obecnosc_opis") or sym
        przedmiot = l.get("przedmiot") or ""
        numer = l.get("numer")
        nr_str = f", lekcja {numer}" if numer else ""
        przedmiot_str = f" ({przedmiot})" if przedmiot else ""
        data_str = d.strftime("%Y-%m-%d")

        key = (data_str, numer, przedmiot, sym)
        if key not in seen:
            seen.add(key)
            wyniki.append(f"- {data_str}{nr_str}{przedmiot_str}: {opis}")

    return "\n".join(wyniki) if wyniki else "Brak spóźnień i nieobecności w wybranym okresie"


def _substitute_prompt_tags(prompt: str, coordinator_data: dict, dzisiejsza_data: str, imie: str) -> str:
    """Podmień tagi dynamiczne w prompcie z obsługą parametrów dni {tag:X} (domyślnie 7 dni)."""
    # 1. Tagi parametryczne
    prompt = re.sub(
        r"\{oceny(?::(\d+))?\}",
        lambda m: _format_grades(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )
    prompt = re.sub(
        r"\{sprawdziany(?::(\d+))?\}",
        lambda m: _format_exams(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )
    prompt = re.sub(
        r"\{zadania(?::(\d+))?\}",
        lambda m: _format_homework(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )
    prompt = re.sub(
        r"\{uwagi(?::(\d+))?\}",
        lambda m: _format_notes(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )
    prompt = re.sub(
        r"\{frekwencja(?::(\d+))?\}",
        lambda m: _format_attendance_frequency(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )
    prompt = re.sub(
        r"\{nieobecnosci(?::(\d+))?\}",
        lambda m: _format_absences(coordinator_data, int(m.group(1)) if m.group(1) else 7),
        prompt,
    )

    # 2. Tagi stałe / semestralne
    frekwencja_stat = coordinator_data.get("frekwencja_stat") or {}
    procent_semestr = frekwencja_stat.get("procent_semestr")
    procent_semestr_str = f"{procent_semestr}%" if procent_semestr is not None else "Brak danych"

    prompt = (
        prompt.replace("{dzisiejsza_data}", dzisiejsza_data)
        .replace("{imie}", imie)
        .replace("{frekwencja_semestr}", procent_semestr_str)
    )

    return prompt


def _value_to_text(val) -> str:
    """Konwertuj dowolną wartość (string, dict, list) na czytelny tekst podsumowania."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, list):
        items = [_value_to_text(item) for item in val if _value_to_text(item)]
        return "\n".join(items).strip()
    if isinstance(val, dict):
        # Sprawdź czy słownik zawiera dedykowany klucz z tekstem
        for text_key in ("tekst", "tresc", "podsumowanie", "summary", "text", "opis", "odpowiedz", "message"):
            for k, v in val.items():
                if str(k).strip().lower() == text_key:
                    res = _value_to_text(v)
                    if res:
                        return res
        # W przeciwnym razie połącz wszystkie wartości w czytelny blok
        parts = []
        for k, v in val.items():
            t = _value_to_text(v)
            if t:
                parts.append(f"{k}: {t}" if not str(k).isdigit() else t)
        return "\n".join(parts).strip()
    return str(val).strip()


def _extract_ai_role_text(result_json: dict, role: str) -> str:
    """Wyodrębnij tekst dla roli (rodzic lub uczen) bez względu na format kluczy i strukturę JSON."""
    if not isinstance(result_json, dict):
        if isinstance(result_json, str) and result_json.strip():
            return result_json.strip()
        return f"Brak danych dla {role}"

    if not result_json:
        return f"Brak danych dla {role}"

    def _normalize_key(k: str) -> str:
        s = str(k).strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")
        return re.sub(r"_+", "_", s).strip("_")

    is_parent = role == "rodzic"
    keywords_rodzic = (
        "rodzic", "rodzice", "rodzicow", "rodziców", "parent", "parents",
        "dla_rodzica", "dla_rodzicow", "dla_rodziców", "opiekun", "opiekunowie",
        "opiekuna", "dla_opiekuna", "dorosly", "dorosły", "mama", "tata"
    )
    keywords_uczen = (
        "uczen", "uczeń", "ucznia", "uczniowie", "student", "students",
        "pupil", "pupils", "dziecko", "dziecka", "dla_ucznia", "dla_dziecka"
    )
    target_keywords = keywords_rodzic if is_parent else keywords_uczen
    role_num = "1" if is_parent else "2"

    def _matches_role(norm_key: str) -> bool:
        if norm_key in (role_num, f"krok_{role_num}", f"sekcja_{role_num}", f"czesc_{role_num}"):
            return True
        for kw in target_keywords:
            if kw in norm_key:
                return True
        return False

    # 1. Sprawdzenie bezpośrednich kluczy pasujących do danej roli
    for k, v in result_json.items():
        norm_k = _normalize_key(k)
        if _matches_role(norm_k):
            if isinstance(v, dict):
                sub = _extract_ai_role_text(v, role)
                if sub and not sub.startswith("Brak danych"):
                    return sub
            txt = _value_to_text(v)
            if txt:
                return txt

    # 2. Sprawdzenie czy JSON nie jest zagnieżdżony pod imieniem ucznia (np. {"Hubert": {"rodzic": ...}})
    for v in result_json.values():
        if isinstance(v, dict):
            nested = _extract_ai_role_text(v, role)
            if nested and not nested.startswith("Brak danych"):
                return nested

    # 3. Jeśli słownik ma dokładnie 2 elementy (np. ogólne sekcje ["sekcja_a", "sekcja_b"])
    if len(result_json) == 2:
        items = list(result_json.values())
        idx = 0 if is_parent else 1
        candidate = _value_to_text(items[idx])
        if candidate:
            return candidate

    # 4. Jeśli słownik zawiera ogólne podsumowanie ("podsumowanie", "summary", "tekst", "raport")
    for general_key in ("podsumowanie", "summary", "tekst", "text", "raport", "tresc", "odpowiedz", "wynik"):
        for k, v in result_json.items():
            if general_key in _normalize_key(k):
                candidate = _value_to_text(v)
                if candidate:
                    return candidate

    # 5. Jeśli słownik ma dokładnie 1 element
    if len(result_json) == 1:
        only_val = _value_to_text(list(result_json.values())[0])
        if only_val:
            return only_val

    # 6. Bezpośredni klucz fallback (dokładna nazwa roli)
    if role in result_json:
        txt = _value_to_text(result_json[role])
        if txt:
            return txt

    return f"Brak danych dla {role}"


async def async_generate_summary(hass: HomeAssistant, entry_id: str, coordinator_data: dict, agent_id: str, options: dict = None):
    """Generate Weekly AI Summary using Home Assistant conversation API."""
    options = options or {}
    if not coordinator_data:
        _LOGGER.error("Brak danych do wygenerowania podsumowania AI")
        return

    student = coordinator_data.get("student_info")
    imie = student.name if student else "Uczeń"

    from datetime import date
    dzisiejsza_data = date.today().strftime("%Y-%m-%d")

    prompt_parent_raw = options.get("ai_prompt_weekly_parent", DEFAULT_PROMPT_WEEKLY_PARENT)
    prompt_parent = _substitute_prompt_tags(prompt_parent_raw, coordinator_data, dzisiejsza_data, imie)

    prompt_student_raw = options.get("ai_prompt_weekly_student", DEFAULT_PROMPT_WEEKLY_STUDENT)
    prompt_student = _substitute_prompt_tags(prompt_student_raw, coordinator_data, dzisiejsza_data, imie)

    prompt = f"""
Wykonaj podsumowanie tygodnia.

INSTRUKCJA ZWROTU:
Zwróć odpowiedź w formacie JSON (bez znaczników markdown typu ```json), zawierającym DWA klucze: "rodzic" oraz "uczen".
Nawet jeśli uczeń nie posiada w danym okresie nowych ocen ani uwag, zawsze wygeneruj pełne podsumowanie dla rodzica w kluczu "rodzic" oraz dla ucznia w kluczu "uczen", skupiając się na frekwencji i nadchodzących sprawdzianach.

Wytyczne dla klucza "rodzic":
{prompt_parent}

Wytyczne dla klucza "uczen":
{prompt_student}

Format odpowiedzi:
{{
  "rodzic": "Twój tekst dla rodzica...",
  "uczen": "Twój tekst dla ucznia..."
}}
"""
    _LOGGER.debug("Wysyłanie zapytania do AI (%s)...", agent_id)
    try:
        service_data = {"text": prompt}
        if agent_id:
            service_data["agent_id"] = agent_id

        response = await hass.services.async_call(
            "conversation",
            "process",
            service_data,
            blocking=True,
            return_response=True,
        )

        result_text = ""
        if isinstance(response, dict):
            result_text = response.get("response", {}).get("speech", {}).get("plain", {}).get("speech", "")
        elif hasattr(response, "response"):
            result_text = response.response.speech.get("plain", {}).get("speech", "")

        if not result_text:
            _LOGGER.error("Pusta odpowiedź od modelu AI dla %s.", imie)
            return

        _LOGGER.debug("AI odpowiedź surowa dla %s: %s", imie, result_text)
        result_json = _parse_ai_json_response(result_text)
        _LOGGER.debug("AI sparsowany JSON dla %s: %s", imie, result_json)

        rodzic_text = _extract_ai_role_text(result_json, "rodzic")
        uczen_text = _extract_ai_role_text(result_json, "uczen")

        # Fallback: jeśli nadal brak danych, a surowy tekst modelu jest czytelny
        clean_raw = result_text.strip()
        if (not rodzic_text or rodzic_text.startswith("Brak danych")) and clean_raw and not clean_raw.startswith("{"):
            rodzic_text = clean_raw
        if (not uczen_text or uczen_text.startswith("Brak danych")) and clean_raw and not clean_raw.startswith("{"):
            uczen_text = clean_raw

        if rodzic_text.startswith("Brak danych"):
            _LOGGER.warning("Nie udało się dopasować podsumowania dla rodzica dla %s. Odpowiedź AI: %s", imie, result_text)
        if uczen_text.startswith("Brak danych"):
            _LOGGER.warning("Nie udało się dopasować podsumowania dla ucznia dla %s. Odpowiedź AI: %s", imie, result_text)

        _LOGGER.info("Pomyślnie wygenerowano podsumowanie AI dla %s", imie)

        # Rozgłoszenie wygenerowanych tekstów do sensorów
        async_dispatcher_send(
            hass,
            f"librus_ai_summary_{entry_id}",
            {"rodzic": rodzic_text, "uczen": uczen_text},
        )

    except Exception as ex:
        _LOGGER.error("Błąd podczas generowania podsumowania AI dla %s: %s", imie, ex)
        async_dispatcher_send(
            hass,
            f"librus_ai_summary_{entry_id}",
            {"rodzic": f"Błąd AI: {ex}", "uczen": f"Błąd AI: {ex}"},
        )

async def async_generate_messages_summary(hass: HomeAssistant, entry_id: str, coordinator_data: dict, agent_id: str, options: dict = None):
    """Generate Daily Messages AI Summary."""
    options = options or {}
    if not coordinator_data:
        _LOGGER.error("Brak danych do wygenerowania podsumowania wiadomości AI")
        return

    student = coordinator_data.get("student_info")
    imie = student.name if student else "Uczeń"
    
    wiadomosci = coordinator_data.get("wiadomosci", [])
    nieprzeczytane = []
    przeczytane = []
    
    client = hass.data.get("librus_apix", {}).get(entry_id)
    if client and hasattr(client, "_message_cache"):
        for m in wiadomosci:
            if not m.get("content") and m.get("href") in client._message_cache:
                m["content"] = client._message_cache[m.get("href")]

    for m in wiadomosci:
        date_str = m.get("date", "Brak daty")
        title = m.get("title", "")
        author = m.get("author", "")
        content = m.get("content") or "Brak pobranej treści"
        
        info = f"- [Data: {date_str}] Od: {author} | Temat: {title}\n  Treść:\n  {content}"
        
        if m.get("unread"):
            nieprzeczytane.append(info)
        else:
            przeczytane.append(info)
            
    stats = f"Statystyki skrzynki: łącznie {len(wiadomosci)} wiadomości (w tym {len(nieprzeczytane)} nieprzeczytanych, {len(przeczytane)} przeczytanych)."
    
    if not wiadomosci:
        _LOGGER.info("Brak wiadomości w skrzynce. Pomijam AI.")
        async_dispatcher_send(hass, f"librus_ai_messages_summary_{entry_id}", {"rodzic": "Brak wiadomości.", "uczen": "Brak wiadomości."})
        return
        
    dane_tekst = f"STATUS SKRZYNKI:\n{stats}\n\nNIEODCZYTANE:\n"
    dane_tekst += "\n---\n".join(nieprzeczytane) if nieprzeczytane else "Brak"
    dane_tekst += "\n\nODCZYTANE:\n"
    dane_tekst += "\n---\n".join(przeczytane) if przeczytane else "Brak"

    from datetime import date
    dzisiejsza_data = date.today().strftime("%Y-%m-%d")

    prompt_parent = options.get("ai_prompt_messages_parent", DEFAULT_PROMPT_MESSAGES_PARENT)
    prompt_parent = (
        prompt_parent.replace("{dzisiejsza_data}", dzisiejsza_data)
        .replace("{imie}", imie)
        .replace("{wiadomosci}", dane_tekst)
    )
        
    prompt_student = options.get("ai_prompt_messages_student", DEFAULT_PROMPT_MESSAGES_STUDENT)
    prompt_student = (
        prompt_student.replace("{dzisiejsza_data}", dzisiejsza_data)
        .replace("{imie}", imie)
        .replace("{wiadomosci}", dane_tekst)
    )

    # Złożony prompt do modelu
    prompt = f"""
Wykonaj podsumowanie wiadomości. 

INSTRUKCJA ZWROTU:
Zwróć odpowiedź w formacie JSON (bez znaczników markdown typu ```json), zawierającym DWA klucze: "rodzic" oraz "uczen".

Wytyczne dla klucza "rodzic":
{prompt_parent}

Wytyczne dla klucza "uczen":
{prompt_student}

Format odpowiedzi:
{{
  "rodzic": "Twój tekst dla rodzica...",
  "uczen": "Twój tekst dla ucznia..."
}}
"""

    _LOGGER.debug("Wysyłanie zapytania do AI (wiadomosci)...")
    try:
        service_data = {"text": prompt}
        if agent_id:
            service_data["agent_id"] = agent_id
            
        response = await hass.services.async_call("conversation", "process", service_data, blocking=True, return_response=True)
        
        result_text = ""
        if isinstance(response, dict):
            result_text = response.get("response", {}).get("speech", {}).get("plain", {}).get("speech", "")
        elif hasattr(response, "response"):
            result_text = response.response.speech.get("plain", {}).get("speech", "")
            
        if not result_text:
            _LOGGER.error("Pusta odpowiedź od modelu AI dla wiadomości (%s).", imie)
            return
            
        _LOGGER.debug("AI wiadomości odpowiedź surowa dla %s: %s", imie, result_text)
        result_json = _parse_ai_json_response(result_text)
        _LOGGER.debug("AI wiadomości sparsowany JSON dla %s: %s", imie, result_json)

        rodzic_text = _extract_ai_role_text(result_json, "rodzic")
        uczen_text = _extract_ai_role_text(result_json, "uczen")

        # Fallback: jeśli nadal brak danych, a surowy tekst modelu jest czytelny
        clean_raw = result_text.strip()
        if (not rodzic_text or rodzic_text.startswith("Brak danych")) and clean_raw and not clean_raw.startswith("{"):
            rodzic_text = clean_raw
        if (not uczen_text or uczen_text.startswith("Brak danych")) and clean_raw and not clean_raw.startswith("{"):
            uczen_text = clean_raw

        if rodzic_text.startswith("Brak danych"):
            _LOGGER.warning("Nie udało się dopasować podsumowania wiadomości dla rodzica dla %s. Odpowiedź AI: %s", imie, result_text)
        if uczen_text.startswith("Brak danych"):
            _LOGGER.warning("Nie udało się dopasować podsumowania wiadomości dla ucznia dla %s. Odpowiedź AI: %s", imie, result_text)

        async_dispatcher_send(
            hass, 
            f"librus_ai_messages_summary_{entry_id}", 
            {
                "rodzic": rodzic_text, 
                "uczen": uczen_text,
            }
        )
    except Exception as ex:
        _LOGGER.error("Błąd podczas generowania podsumowania wiadomości AI: %s", ex)
        async_dispatcher_send(
            hass, 
            f"librus_ai_messages_summary_{entry_id}", 
            {
                "rodzic": f"Wystąpił błąd AI: {ex}", 
                "uczen": f"Wystąpił błąd AI: {ex}"
            }
        )

