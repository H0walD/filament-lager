"""Filament-Lager: kleine Oberfläche für das Bambuddy-Inventar.

Liefert die Web-Oberfläche aus, reicht Inventar-Aufrufe mit dem API-Schlüssel
an Bambuddy weiter und verwaltet Hersteller (Webseite, hochgeladenes Logo).
"""

import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

OPTIONS_FILE = "/data/options.json"
DATA_DIR = "/data"
LOGO_DIR = os.path.join(DATA_DIR, "logos")
BRANDS_FILE = os.path.join(DATA_DIR, "brands.json")
WWW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www")
PORT = 8099
DEFAULT_BAMBUDDY = "http://homeassistant.local:8000"
INGRESS_PEER = "172.30.32.2"
MAX_UPLOAD = 2 * 1024 * 1024


def load_options():
    try:
        with open(OPTIONS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def brand_key(brand):
    return re.sub(r"[^a-z0-9:]", "", (brand or "").lower())


def load_brands():
    try:
        with open(BRANDS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_brands(brands):
    tmp = BRANDS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(brands, f, ensure_ascii=False, indent=1)
    os.replace(tmp, BRANDS_FILE)


def logo_paths(key):
    return os.path.join(LOGO_DIR, key + ".img"), os.path.join(LOGO_DIR, key + ".json")


def read_logo(key):
    img, meta = logo_paths(key)
    try:
        with open(meta, encoding="utf-8") as f:
            info = json.load(f)
    except (OSError, ValueError):
        return None
    if info.get("missing"):
        return info
    try:
        with open(img, "rb") as f:
            info["body"] = f.read()
    except OSError:
        return None
    return info


def write_logo(key, ctype, body, source):
    img, meta = logo_paths(key)
    with open(img, "wb") as f:
        f.write(body)
    with open(meta, "w", encoding="utf-8") as f:
        json.dump({"type": ctype, "source": source, "time": time.time()}, f)


def get_logo(brand):
    # Nur selbst hochgeladene Logos; es wird nichts aus dem Internet geholt.
    key = brand_key(brand)
    info = read_logo(key) if key else None
    return info if info and info.get("source") == "upload" and "body" in info else None


# ---------- Benutzer und Rechte ----------
#
# Home Assistant schickt über Ingress, wer die Seite öffnet (X-Remote-User-*).
# Stufen: 0 kein Zugriff, 1 ansehen, 2 erfassen, 3 bearbeiten, 4 Admin.
# Die Rechte stehen in der App-Konfiguration („benutzer“, „standard_recht“);
# users.json merkt sich nur, wer die App schon geöffnet hat.

USERS_FILE = os.path.join(DATA_DIR, "users.json")
USERS_LOCK = threading.Lock()
NONE, VIEW, ADD, EDIT, ADMIN = 0, 1, 2, 3, 4
LEVEL_NAMES = {"kein": NONE, "ansehen": VIEW, "erfassen": ADD, "bearbeiten": EDIT, "admin": ADMIN}


def configured_level(login, display):
    opts = load_options()
    for entry in opts.get("benutzer") or []:
        name = squash(entry.get("name"))
        if name and name in (squash(login), squash(display)):
            return LEVEL_NAMES.get(entry.get("recht"), NONE), True
    return LEVEL_NAMES.get(opts.get("standard_recht"), NONE), False


def load_users():
    try:
        with open(USERS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_users(users):
    tmp = USERS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=1)
    os.replace(tmp, USERS_FILE)


def current_user(headers):
    uid = headers.get("X-Remote-User-Id")
    if not uid:
        # Ohne Ingress-Kopfzeilen (z. B. direkter Test im Container) gibt es keine Benutzerverwaltung.
        return {"id": None, "name": "lokal", "level": ADMIN}
    name = headers.get("X-Remote-User-Display-Name") or headers.get("X-Remote-User-Name") or uid
    login = headers.get("X-Remote-User-Name") or ""
    now = time.strftime("%Y-%m-%dT%H:%M")
    with USERS_LOCK:
        users = load_users()
        user = users.setdefault(uid, {})
        # Nur speichern, wenn sich etwas geändert hat (die Seite fragt alle 15 s nach).
        if (user.get("name"), user.get("login"), user.get("last_seen")) != (name, login, now):
            user.update(name=name, login=login, last_seen=now)
            user.pop("level", None)
            save_users(users)
    level, listed = configured_level(login, name)
    return {"id": uid, **user, "level": level, "listed": listed}


def required_level(method, path):
    # Seite, Skripte und Icon darf jeder laden, damit „Kein Zugriff“ angezeigt werden kann.
    if path == "/api/me" or (method == "GET" and not path.startswith(("/api/", "/reconcile", "/brands", "/logo/", "/users", "/printers", "/usage-edits"))):
        return NONE
    if path.startswith("/users"):
        return ADMIN
    if path.startswith("/logo/") and method != "GET":
        return ADMIN
    if method == "GET":
        return VIEW
    if path.startswith("/api/inventory/"):
        rel = path[len("/api/inventory/"):]
        if method == "POST" and rel in ("spools", "spools/bulk"):
            return ADD
        if rel.startswith("shopping-list"):
            return ADD
        # Rolle in den Drucker einlegen oder herausnehmen gehört zum täglichen Erfassen.
        if rel.startswith("assignments") and method in ("POST", "DELETE"):
            return ADD
    return EDIT


class Handler(BaseHTTPRequestHandler):
    server_version = "FilamentLager/1.0"

    def log_message(self, fmt, *args):
        if os.environ.get("DEBUG"):
            super().log_message(fmt, *args)

    def allowed(self):
        if self.client_address[0] in (INGRESS_PEER, "127.0.0.1"):
            return True
        self.send_error(403)
        return False

    def send(self, status, body=b"", ctype="application/json", extra=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_UPLOAD:
            raise ValueError("too large")
        return self.rfile.read(length) if length else b""

    def route(self):
        if not self.allowed():
            return
        path = self.path.split("?", 1)[0]
        query = self.path[len(path):]
        self.user = current_user(self.headers)
        if self.user["level"] < required_level(self.command, path):
            return self.send(403, {"detail": "Dafür fehlt dir die Berechtigung", "level": self.user["level"]})
        try:
            if path == "/api/me":
                if self.command == "POST":
                    return self.save_theme()
                return self.send(200, {"name": self.user["name"], "level": self.user["level"], "theme": self.user.get("theme")})
            if path == "/users":
                return self.users()
            if path.startswith("/api/inventory/"):
                return self.proxy(path[len("/api/"):] + query)
            if path == "/api/status":
                return self.status()
            if path == "/reconcile":
                return self.reconcile()
            if path == "/usage-edits":
                return self.usage_edits()
            if path == "/printers":
                return self.send(200, printer_slots())
            if path == "/brands":
                # Mit Hinweis, ob ein Logo hochgeladen ist, damit die Seite nicht ins Leere fragt.
                brands = load_brands()
                for key, entry in brands.items():
                    entry["logo"] = get_logo(key) is not None
                return self.send(200, brands)
            if path.startswith("/brands/"):
                return self.brand_settings(unquote(path[len("/brands/"):]))
            if path.startswith("/logo/"):
                return self.logo(unquote(path[len("/logo/"):]))
            if self.command == "GET":
                return self.static(path)
            self.send(405, {"detail": "Methode nicht erlaubt"})
        except ValueError:
            self.send(413, {"detail": "Datei zu groß"})

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = route

    def static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        full = os.path.realpath(os.path.join(WWW_DIR, name))
        if not full.startswith(os.path.realpath(WWW_DIR)) or not os.path.isfile(full):
            return self.send(404, {"detail": "Nicht gefunden"})
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
        }.get(os.path.splitext(full)[1], "application/octet-stream")
        with open(full, "rb") as f:
            self.send(200, f.read(), ctype)

    def status(self):
        opts = load_options()
        if not opts.get("api_key"):
            return self.send(200, {"ok": False, "reason": "no_key"})
        status, body, _ = self.call_bambuddy("GET", "inventory/shopping-list", None, None)
        if status == 200:
            return self.send(200, {"ok": True})
        reason = "bad_key" if status in (401, 403) else "unreachable"
        return self.send(200, {"ok": False, "reason": reason, "status": status})

    def call_bambuddy(self, method, rel, body, ctype):
        opts = load_options()
        base = (opts.get("bambuddy_url") or DEFAULT_BAMBUDDY).rstrip("/")
        req = urllib.request.Request(f"{base}/api/v1/{rel}", data=body, method=method)
        req.add_header("X-API-Key", opts.get("api_key") or "")
        req.add_header("Accept", "application/json")
        if ctype:
            req.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.status, resp.read(), resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            return e.code, e.read(), e.headers.get("Content-Type", "application/json")
        except (urllib.error.URLError, OSError):
            return 502, json.dumps({"detail": "Bambuddy nicht erreichbar"}).encode(), "application/json"

    def proxy(self, rel):
        body = self.read_body() if self.command in ("POST", "PUT", "PATCH", "DELETE") else None
        status, data, ctype = self.call_bambuddy(
            self.command, rel, body or None, self.headers.get("Content-Type")
        )
        self.send(status, data, ctype)

    def usage_edits(self):
        if self.command == "GET":
            return self.send(200, load_usage_edits())
        if self.command != "POST":
            return self.send(405, {"detail": "Methode nicht erlaubt"})
        req = json.loads(self.read_body() or b"{}")
        try:
            with USAGE_LOCK:
                result = apply_usage_edit(req)
        except LookupError as e:
            return self.send(404, {"detail": str(e)})
        except (ValueError, TypeError) as e:
            return self.send(400, {"detail": str(e) or "Ungültige Angabe"})
        except (urllib.error.URLError, OSError):
            return self.send(502, {"detail": "Bambuddy nicht erreichbar"})
        return self.send(200, result)

    def save_theme(self):
        # Hell/Dunkel je Home-Assistant-Benutzer merken, damit es auf allen Geräten gleich ist.
        theme = (json.loads(self.read_body() or b"{}") or {}).get("theme")
        if theme not in ("light", "dark"):
            return self.send(400, {"detail": "Unbekanntes Design"})
        if self.user.get("id"):
            with USERS_LOCK:
                users = load_users()
                users.setdefault(self.user["id"], {})["theme"] = theme
                save_users(users)
        return self.send(200, {"theme": theme})

    def users(self):
        # Nur anzeigen: Rechte werden in der App-Konfiguration von Home Assistant vergeben.
        if self.command != "GET":
            return self.send(405, {"detail": "Rechte bitte in der App-Konfiguration ändern"})
        result = []
        seen = set()
        for uid, u in load_users().items():
            level, listed = configured_level(u.get("login"), u.get("name"))
            result.append({"id": uid, "name": u.get("name"), "login": u.get("login"), "last_seen": u.get("last_seen"),
                           "level": level, "listed": listed})
            seen.update({squash(u.get("login")), squash(u.get("name"))})
        # Eingetragene, die die App noch nie geöffnet haben, trotzdem zeigen.
        for entry in load_options().get("benutzer") or []:
            if squash(entry.get("name")) not in seen:
                result.append({"id": None, "name": entry.get("name"), "login": entry.get("name"), "last_seen": None,
                               "level": LEVEL_NAMES.get(entry.get("recht"), NONE), "listed": True})
        self.send(200, result)

    def reconcile(self):
        if self.command == "GET":
            return self.send(200, load_merges())
        if self.command != "POST":
            return self.send(405, {"detail": "Methode nicht erlaubt"})
        # Unklare Chip-Rolle von Hand zuordnen oder als echte neue Rolle behalten.
        req = json.loads(self.read_body() or b"{}")
        with RECONCILE_LOCK:
            self.resolve(req)

    def resolve(self, req):
        data = load_merges()
        chip_id = req.get("chip_id")
        if req.get("keep"):
            data.setdefault("ignored", []).append(chip_id)
        else:
            spools = {s["id"]: s for s in bambuddy("GET", "inventory/spools") or []}
            chip, target = spools.get(chip_id), spools.get(req.get("stock_id"))
            if not chip or not target:
                return self.send(404, {"detail": "Rolle nicht gefunden"})
            try:
                assignments = bambuddy("GET", "inventory/assignments") or []
            except urllib.error.HTTPError:
                assignments = []
            merge(chip, target, assignments)
            data.setdefault("merged", []).append({"chip_id": chip_id, "stock_id": target["id"], "name": describe(target),
                                                  "rgba": target.get("rgba"), "time": time.time()})
        data["unclear"] = [u for u in data.get("unclear", []) if u["chip_id"] != chip_id]
        save_merges(data)
        self.send(200, {"ok": True})

    def brand_settings(self, brand):
        key = brand_key(brand)
        if not key or self.command != "PUT":
            return self.send(400, {"detail": "Ungültig"})
        data = json.loads(self.read_body() or b"{}")
        brands = load_brands()
        entry = brands.get(key, {})
        entry["website"] = (data.get("website") or "").strip()
        entry["name"] = (data.get("name") or entry.get("name") or brand).strip()
        brands[key] = entry
        save_brands(brands)
        self.send(200, entry)

    def logo(self, brand):
        key = brand_key(brand)
        if not key:
            return self.send(404, {"detail": "Kein Logo"})
        if self.command == "GET":
            info = get_logo(brand)
            if not info:
                return self.send(404, {"detail": "Kein Logo"})
            return self.send(200, info["body"], info["type"], {"Cache-Control": "max-age=3600"})
        if self.command in ("POST", "PUT"):
            ctype = (self.headers.get("Content-Type") or "").split(";")[0]
            # Kein SVG: das könnte Skripte enthalten und liefe im Kontext der App.
            if ctype not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
                return self.send(400, {"detail": "Bitte ein PNG-, JPG-, WebP- oder GIF-Bild hochladen"})
            write_logo(key, ctype, self.read_body(), "upload")
            return self.send(200, {"ok": True})
        if self.command == "DELETE":
            for p in logo_paths(key):
                if os.path.exists(p):
                    os.remove(p)
            return self.send(200, {"ok": True})
        self.send(405, {"detail": "Methode nicht erlaubt"})


# ---------- Abgleich: Chip-Rollen vom Drucker mit Lager-Rollen zusammenführen ----------
#
# Legt Bambuddy eine Rolle über den RFID-Chip an, die schon von Hand im Lager
# steht, gäbe es sie doppelt. Der Abgleich hängt den Chip an die Lager-Rolle,
# übernimmt den Füllstand und archiviert die doppelte Chip-Rolle.

MERGES_FILE = os.path.join(DATA_DIR, "merges.json")
RECONCILE_SECONDS = 60
COLOR_TOLERANCE = 40
RECONCILE_LOCK = threading.Lock()


def squash(s):
    return re.sub(r"[^a-z0-9äöüß]", "", (s or "").lower())


def hex_distance(a, b):
    try:
        x = [int(a[i:i + 2], 16) for i in (0, 2, 4)]
        y = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    except (TypeError, ValueError):
        return 999
    return sum((p - q) ** 2 for p, q in zip(x, y)) ** 0.5


def has_tag(s):
    return bool(s.get("tag_uid") or s.get("tray_uuid"))


def subtype_match(a, b):
    a, b = squash(a), squash(b)
    return a == b or (a and b and (a in b or b in a))


def same_filament(chip, stock):
    ba, bb = squash(chip.get("brand")), squash(stock.get("brand"))
    if not ba or not bb or not (ba.startswith(bb) or bb.startswith(ba)):
        return False
    if squash(chip.get("material")) != squash(stock.get("material")):
        return False
    if not subtype_match(chip.get("subtype"), stock.get("subtype")):
        return False
    if squash(chip.get("color_name")) and squash(chip.get("color_name")) == squash(stock.get("color_name")):
        return True
    return hex_distance(chip.get("rgba"), stock.get("rgba")) <= COLOR_TOLERANCE


def load_merges():
    try:
        with open(MERGES_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"merged": [], "unclear": []}


def save_merges(data):
    data["merged"] = data.get("merged", [])[-50:]
    tmp = MERGES_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, MERGES_FILE)


def bambuddy(method, rel, payload=None):
    opts = load_options()
    base = (opts.get("bambuddy_url") or DEFAULT_BAMBUDDY).rstrip("/")
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{base}/api/v1/{rel}", data=body, method=method)
    req.add_header("X-API-Key", opts.get("api_key") or "")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else None


USAGE_EDITS_FILE = os.path.join(DATA_DIR, "usage_edits.json")
USAGE_LOCK = threading.Lock()


def load_usage_edits():
    try:
        with open(USAGE_EDITS_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = {}
    data.setdefault("edits", {})
    data.setdefault("manual", [])
    return data


def save_usage_edits(data):
    tmp = USAGE_EDITS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, USAGE_EDITS_FILE)


def adjust_spool(spool_id, diff):
    """Mehr oder weniger Verbrauch bei der Rolle verbuchen, damit der Lagerbestand stimmt."""
    if not diff:
        return
    spool = bambuddy("GET", f"inventory/spools/{spool_id}")
    used = max(0.0, round((spool.get("weight_used") or 0) + diff, 1))
    bambuddy("PATCH", f"inventory/spools/{spool_id}", {"weight_used": used})


def apply_usage_edit(req):
    """Abbuchung eines Drucks korrigieren.

    Bambuddy kann einzelne Abbuchungen nicht ändern. Die korrigierte Menge wird deshalb hier gespeichert
    und nur die Differenz bei der Rolle abgezogen oder gutgeschrieben.
    """
    data = load_usage_edits()
    grams = float(req.get("grams"))
    if grams < 0 or grams > 5000:
        raise ValueError("Bitte eine Menge zwischen 0 und 5000 g eingeben")
    grams = round(grams, 1)
    if req.get("usage_id") is not None:
        uid, spool_id = int(req["usage_id"]), int(req["spool_id"])
        history = bambuddy("GET", f"inventory/spools/{spool_id}/usage?limit=500") or []
        entry = next((u for u in history if u.get("id") == uid), None)
        if not entry:
            raise LookupError("Abbuchung nicht gefunden")
        before = data["edits"].get(str(uid), entry.get("weight_used") or 0)
        adjust_spool(spool_id, grams - before)
        if abs(grams - (entry.get("weight_used") or 0)) < 0.05:
            data["edits"].pop(str(uid), None)
        else:
            data["edits"][str(uid)] = grams
    elif req.get("manual_id"):
        entry = next((m for m in data["manual"] if m["id"] == req["manual_id"]), None)
        if not entry:
            raise LookupError("Abbuchung nicht gefunden")
        adjust_spool(entry["spool_id"], grams - entry["grams"])
        if grams == 0:
            data["manual"].remove(entry)
        else:
            entry["grams"] = grams
    else:
        # Rolle, die beim Druck dabei war, aber nicht abgebucht wurde (z. B. ohne Chip und ohne Zuordnung).
        spool_id = int(req["spool_id"])
        job = req.get("job") or {}
        if not grams:
            raise ValueError("Bitte eine Menge eingeben")
        adjust_spool(spool_id, grams)
        data["manual"].append({
            "id": "m%d" % int(time.time() * 1000), "spool_id": spool_id, "grams": grams,
            "print_name": job.get("print_name"), "printer_id": job.get("printer_id"),
            "created_at": job.get("created_at"), "status": job.get("status") or "completed",
        })
    save_usage_edits(data)
    return data


def no_chip(value):
    # Rollen ohne Chip melden lauter Nullen statt einer Kennung.
    return not value or not value.strip("0")


def slot_name(ams_id, tray_id, units):
    if ams_id == 255:
        return "Externe Spule" if units <= 1 else f"Externe Spule {tray_id + 1}"
    if ams_id >= 128:
        return f"AMS HT {ams_id - 127}"
    return f"AMS {chr(65 + ams_id)} · Slot {tray_id + 1}"


def slot_entry(printer, ams_id, tray_id, tray, name):
    present = tray.get("exists")
    if present is None:
        present = tray.get("state") in (10, 11) or bool(tray.get("tray_type"))
    return {
        "printer_id": printer["id"], "printer": printer.get("name") or f"Drucker {printer['id']}",
        "ams_id": ams_id, "tray_id": tray_id, "name": name,
        "present": bool(present), "chip": not (no_chip(tray.get("tag_uid")) and no_chip(tray.get("tray_uuid"))),
        "type": tray.get("tray_sub_brands") or tray.get("tray_type") or "", "rgba": tray.get("tray_color") or "",
    }


def printer_slots():
    """Alle AMS-Plätze und externen Halter der Drucker, mit Angabe, ob eine Rolle drinsteckt."""
    try:
        printers = bambuddy("GET", "printers/") or []
    except (urllib.error.URLError, OSError, ValueError):
        return {"printers": [], "currency": ""}
    try:
        currency = (bambuddy("GET", "settings/") or {}).get("currency") or ""
    except (urllib.error.URLError, OSError, ValueError):
        currency = ""
    result = []
    for p in printers:
        if not isinstance(p, dict) or "id" not in p:
            continue
        entry = {"id": p["id"], "name": p.get("name") or f"Drucker {p['id']}", "connected": False, "slots": []}
        try:
            st = bambuddy("GET", f"printers/{p['id']}/status") or {}
        except (urllib.error.URLError, OSError, ValueError):
            st = {}
        entry["connected"] = bool(st.get("connected"))
        for unit in st.get("ams") or []:
            uid = int(unit.get("id", 0))
            for tray in unit.get("tray") or []:
                tid = int(tray.get("id", 0))
                entry["slots"].append(slot_entry(p, uid, tid, tray, slot_name(uid, tid, 0)))
        ext = st.get("vt_tray") or []
        for tray in ext:
            tid = max(0, int(tray.get("id", 254)) - 254)
            entry["slots"].append(slot_entry(p, 255, tid, tray, slot_name(255, tid, len(ext))))
        if not ext:
            entry["slots"].append(slot_entry(p, 255, 0, {"exists": False}, slot_name(255, 0, 1)))
        result.append(entry)
    return {"printers": result, "currency": currency}


def describe(s):
    return " ".join(x for x in (s.get("brand"), s.get("material"), s.get("subtype"), s.get("color_name")) if x)


def merge(chip, stock, assignments):
    """Chip von der doppelten Rolle auf die Lager-Rolle umhängen."""
    tag = {"tag_uid": chip.get("tag_uid"), "tray_uuid": chip.get("tray_uuid")}
    slot = next((a for a in assignments if a.get("spool_id") == chip["id"]), None)
    bambuddy("POST", f"inventory/spools/{chip['id']}/archive")
    try:
        bambuddy("PATCH", f"inventory/spools/{stock['id']}/link-tag", tag)
    except urllib.error.HTTPError:
        bambuddy("POST", f"inventory/spools/{chip['id']}/restore")
        raise
    update = {"weight_used": chip.get("weight_used") or 0}
    if not stock.get("rgba") and chip.get("rgba"):
        update["rgba"] = chip["rgba"]
    bambuddy("PATCH", f"inventory/spools/{stock['id']}", update)
    if slot:
        bambuddy("POST", "inventory/assignments", {
            "spool_id": stock["id"], "printer_id": slot["printer_id"],
            "ams_id": slot["ams_id"], "tray_id": slot["tray_id"],
        })


def reconcile_once():
    if not load_options().get("api_key"):
        return
    spools = [s for s in (bambuddy("GET", "inventory/spools") or []) if not s.get("archived_at")]
    try:
        assignments = bambuddy("GET", "inventory/assignments") or []
    except urllib.error.HTTPError:
        assignments = []
    data = load_merges()
    done_chips = {m["chip_id"] for m in data.get("merged", [])}
    ignored = set(data.get("ignored", []))
    unclear = []
    # Lager-Rollen ohne Chip, die noch nie benutzt wurden, kommen als Partner infrage.
    stock = [s for s in spools if not has_tag(s) and (s.get("weight_used") or 0) < 1]
    for chip in spools:
        if not has_tag(chip) or chip["id"] in done_chips or chip["id"] in ignored:
            continue
        # Nur Chip-Rollen, die nach der Lager-Rolle entstanden sind, sonst ist die Lager-Rolle die neuere.
        partners = [s for s in stock if same_filament(chip, s) and s.get("created_at", "") < chip.get("created_at", "")]
        if not partners:
            continue
        sorts = {(squash(s.get("brand")), squash(s.get("material")), squash(s.get("subtype")), squash(s.get("color_name"))) for s in partners}
        if len(sorts) > 1:
            unclear.append({"chip_id": chip["id"], "chip": describe(chip), "rgba": chip.get("rgba"),
                            "options": [{"id": s["id"], "name": describe(s), "rgba": s.get("rgba")} for s in partners]})
            continue
        target = min(partners, key=lambda s: s["id"])
        try:
            merge(chip, target, assignments)
        except (urllib.error.URLError, OSError) as e:
            print(f"Abgleich fehlgeschlagen für Rolle {chip['id']}: {e}")
            continue
        stock.remove(target)
        data.setdefault("merged", []).append({"chip_id": chip["id"], "stock_id": target["id"], "name": describe(target),
                                              "rgba": target.get("rgba") or chip.get("rgba"), "time": time.time()})
        print(f"Chip-Rolle {chip['id']} mit Lager-Rolle {target['id']} zusammengeführt ({describe(target)})")
    data["unclear"] = unclear
    save_merges(data)


def reconcile_loop():
    while True:
        try:
            with RECONCILE_LOCK:
                reconcile_once()
        except Exception as e:  # der Abgleich darf den Server nie stoppen
            print(f"Abgleich-Fehler: {e}")
        time.sleep(RECONCILE_SECONDS)


def main():
    os.makedirs(LOGO_DIR, exist_ok=True)
    print(f"Filament-Lager läuft auf Port {PORT}")
    threading.Thread(target=reconcile_loop, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
