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
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote

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


PLACES_FILE = os.path.join(DATA_DIR, "places.json")
PLACE_ICONS = ("shelf", "dryer", "box", "drawer", "cabinet", "bag")


MDI_FILE = os.environ.get("MDI_FILE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "mdi.json")
MDI = None


def load_mdi():
    # Material Design Icons, beim Bauen der App aus @mdi/svg erzeugt (Name → SVG-Pfad).
    global MDI
    if MDI is None:
        try:
            with open(MDI_FILE, encoding="utf-8") as f:
                MDI = json.load(f)
        except (OSError, ValueError):
            MDI = {}
    return MDI


def mdi_search(q):
    q = re.sub(r"^mdi:", "", (q or "").strip().lower())
    if not q:
        return []
    names = load_mdi().keys()
    starts = [n for n in names if n.startswith(q)]
    contains = [n for n in names if q in n and not n.startswith(q)]
    return ["mdi:" + n for n in (sorted(starts, key=len) + sorted(contains, key=len))[:40]]


def load_places():
    try:
        with open(PLACES_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_places(places):
    tmp = PLACES_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(places, f, ensure_ascii=False, indent=1)
    os.replace(tmp, PLACES_FILE)


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
# Jeder Benutzer gehört zu einer Gruppe; eine Gruppe hat einzelne Rechte (Reiter sehen, Rollen buchen …).
# Gruppen und Zuordnung verwaltet der Admin im Reiter Benutzer (groups.json). Die App-Konfiguration
# („benutzer“, „standard_recht“) gilt weiter als Vorgabe: Wer dort admin ist, bleibt immer Admin.
# users.json merkt sich, wer die App schon geöffnet hat, und die persönlichen Einstellungen.

USERS_FILE = os.path.join(DATA_DIR, "users.json")
USERS_LOCK = threading.Lock()
NONE, VIEW, ADMIN = 0, 1, 4


GROUPS_FILE = os.path.join(DATA_DIR, "groups.json")
GROUPS_LOCK = threading.Lock()

# Rechte in der Reihenfolge, wie sie im Reiter Benutzer stehen.
PERMS = [
    ("tab_stock", "Reiter Lager sehen"),
    ("tab_shop", "Reiter Einkaufsliste sehen"),
    ("tab_usage", "Reiter Verbrauch sehen"),
    ("tab_brands", "Reiter Hersteller sehen"),
    ("tab_places", "Reiter Lagerplätze sehen"),
    ("tab_design", "Eigenes Design einstellen"),
    ("shop_edit", "Einkaufsliste: eintragen, ändern, entfernen"),
    ("rolls_add", "Rollen hinzufügen (+1, Neues Material, Eingetroffen ins Lager)"),
    ("rolls_remove", "Rollen ausbuchen und löschen (−1, Löschen)"),
    ("rolls_edit", "Einzelne Rolle: Restgewicht und Lagerplatz"),
    ("sorts_edit", "Sorte bearbeiten (Name, Farbe, Preis …)"),
    ("printer", "Rollen in den Drucker einlegen, Chip-Abgleich"),
    ("usage_edit", "Verbrauch korrigieren"),
    ("brands_edit", "Hersteller bearbeiten, Logos"),
    ("places_edit", "Lagerplatz-Icons ändern"),
]
ALL_PERMS = [k for k, _ in PERMS]
_TABS = ["tab_stock", "tab_shop", "tab_usage", "tab_brands", "tab_places", "tab_design"]
# Ausgangslage, abgeleitet von den früheren Stufen. Rollen hinzufügen und entfernen darf anfangs nur Admin.
SEED_GROUPS = {
    "admin": {"name": "Admin", "perms": ALL_PERMS, "fixed": True},
    "bearbeiten": {"name": "Bearbeiten", "perms": _TABS + ["shop_edit", "printer", "rolls_edit", "sorts_edit", "usage_edit", "brands_edit", "places_edit"]},
    "erfassen": {"name": "Erfassen", "perms": _TABS + ["shop_edit", "printer", "rolls_edit"]},
    "ansehen": {"name": "Ansehen", "perms": _TABS + ["shop_edit"]},
    "kein": {"name": "Kein Zugriff", "perms": [], "fixed": True},
}


def load_groups():
    try:
        with open(GROUPS_FILE, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = {}
    if not data.get("groups"):
        data["groups"] = json.loads(json.dumps(SEED_GROUPS))
    # Admin und „Kein Zugriff“ sind fest, auch wenn die Datei von Hand geändert wurde.
    data["groups"]["admin"] = dict(SEED_GROUPS["admin"])
    data["groups"]["kein"] = dict(SEED_GROUPS["kein"])
    data.setdefault("members", {})
    return data


def save_groups(data):
    tmp = GROUPS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, GROUPS_FILE)


def default_group(groups):
    gid = groups.get("default") or load_options().get("standard_recht") or "ansehen"
    return gid if gid in groups["groups"] else "kein"


def resolve_group(uid, login, display, groups=None):
    """Gruppe eines Benutzers und woher sie kommt (config_admin, app, config, default)."""
    groups = groups or load_groups()
    configured = None
    for entry in load_options().get("benutzer") or []:
        name = squash(entry.get("name"))
        if name and name in (squash(login), squash(display)):
            configured = entry.get("recht")
            break
    if configured == "admin":
        return "admin", "config_admin"
    gid = groups["members"].get(uid) if uid else None
    if gid in groups["groups"]:
        return gid, "app"
    if configured in groups["groups"]:
        return configured, "config"
    return default_group(groups), "default"


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
        return {"id": None, "name": "lokal", "level": ADMIN, "group": "admin", "group_name": "Admin", "perms": ALL_PERMS}
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
    groups = load_groups()
    gid, source = resolve_group(uid, login, name, groups)
    perms = ALL_PERMS if gid == "admin" else [p for p in groups["groups"][gid].get("perms", []) if p in ALL_PERMS]
    level = ADMIN if gid == "admin" else (VIEW if perms else NONE)
    return {"id": uid, **user, "level": level, "group": gid, "group_name": groups["groups"][gid]["name"],
            "group_source": source, "perms": perms}


DESIGN_FONTS = ("system", "inter", "roboto", "open-sans", "source-sans-3", "atkinson", "lexend", "nunito", "comfortaa", "montserrat",
                "oswald", "merriweather", "roboto-slab", "jetbrains-mono")


def clean_design(d):
    """Schriftarten und Schriftgrössen (in Prozent) eines Benutzers prüfen; leeres Objekt heisst Standard."""
    if not isinstance(d, dict):
        return None
    out = {}
    for key in ("title_font", "text_font"):
        if key in d:
            if d[key] not in DESIGN_FONTS:
                return None
            out[key] = d[key]
    for key in ("title_size", "text_size", "desc_size"):
        if key in d:
            try:
                v = int(d[key])
            except (TypeError, ValueError):
                return None
            if not 70 <= v <= 160:
                return None
            out[key] = v
    return out


def required_perm(method, path, body=None):
    """Welches Recht eine Anfrage braucht: None = jeder, "any" = irgendein Recht, "admin" = nur Admin."""
    # Seite, Skripte und Icon darf jeder laden, damit „Kein Zugriff“ angezeigt werden kann.
    if path == "/api/me" or (method == "GET" and not path.startswith(("/api/", "/reconcile", "/brands", "/logo/", "/users", "/groups", "/printers", "/printer-image/", "/usage-edits", "/unbooked", "/places", "/place-image/", "/mdi", "/shop-meta"))):
        return None
    if path.startswith(("/users", "/groups")):
        return "admin"
    if method == "GET":
        return "any"
    if path.startswith(("/brands", "/logo/")):
        return "brands_edit"
    if path.startswith(("/places/", "/place-image/")):
        return "places_edit"
    if path.startswith(("/usage-edits", "/archive-sync")):
        return "usage_edit"
    if path.startswith("/reconcile"):
        return "printer"
    if path.startswith("/api/inventory/"):
        rel = path[len("/api/inventory/"):]
        if rel.startswith("shopping-list"):
            return "shop_edit"
        if rel.startswith("assignments"):
            return "printer"
        if method == "POST" and rel in ("spools", "spools/bulk"):
            return "rolls_add"
        if (method == "POST" and rel.endswith("/archive")) or (method == "DELETE" and re.fullmatch(r"spools/\d+", rel)):
            return "rolls_remove"
        if method == "POST" and rel == "spools/bulk-update":
            return "sorts_edit"
        if method == "PATCH" and re.fullmatch(r"spools/\d+", rel):
            # Restgewicht und Lagerplatz einer Rolle sind Alltag, alles andere ändert die Sorte.
            try:
                fields = set((json.loads(body or b"{}") or {}).keys())
            except ValueError:
                fields = {"?"}
            return "rolls_edit" if fields <= {"weight_used", "location_id", "storage_location"} else "sorts_edit"
    return "admin"


def allowed_for(user, perm):
    if perm is None:
        return True
    if user.get("group") == "admin":
        return True
    if perm == "admin":
        return False
    if perm == "any":
        return bool(user.get("perms"))
    return perm in user.get("perms", [])


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
        if "Cache-Control" not in (extra or {}):
            self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_body(self):
        # Zwischengespeichert: die Rechteprüfung liest den Inhalt mancher Anfragen schon vorher.
        if not hasattr(self, "_body"):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_UPLOAD:
                raise ValueError("too large")
            self._body = self.rfile.read(length) if length else b""
        return self._body

    def route(self):
        if not self.allowed():
            return
        path = self.path.split("?", 1)[0]
        query = self.path[len(path):]
        self.user = current_user(self.headers)
        try:
            body = self.read_body() if self.command == "PATCH" else None
            if not allowed_for(self.user, required_perm(self.command, path, body)):
                return self.send(403, {"detail": "Dafür fehlt dir die Berechtigung"})
            if path == "/api/me":
                if self.command == "POST":
                    return self.save_theme()
                u = self.user
                return self.send(200, {"name": u["name"], "level": u["level"], "group": u.get("group"), "group_name": u.get("group_name"),
                                       "perms": u.get("perms", []), "theme": u.get("theme"), "view": u.get("view"), "design": u.get("design")})
            if path == "/users" or path.startswith("/users/"):
                return self.users(path[len("/users/"):] if path.startswith("/users/") else None)
            if path == "/groups" or path.startswith("/groups/"):
                return self.groups(path[len("/groups/"):] if path.startswith("/groups/") else None)
            if path == "/shop-meta":
                return self.send(200, load_shop_meta())
            if path.startswith("/api/inventory/"):
                return self.proxy(path[len("/api/"):] + query)
            if path == "/api/status":
                return self.status()
            if path == "/reconcile":
                return self.reconcile()
            if path == "/usage-edits":
                return self.usage_edits()
            if path == "/unbooked":
                return self.unbooked()
            if path == "/archive-sync" and self.command == "POST":
                return self.send(200, sync_archive(json.loads(self.read_body() or b"{}")))
            if path.startswith("/mdi/") and path.endswith(".svg"):
                return self.mdi_svg(path[len("/mdi/"):-4])
            if path == "/mdi-search":
                return self.send(200, mdi_search(parse_qs(query.lstrip("?")).get("q", [""])[0]))
            if path == "/places":
                return self.send(200, load_places())
            if path.startswith("/places/"):
                return self.place_settings(path[len("/places/"):])
            if path.startswith("/place-image/"):
                return self.place_image(path[len("/place-image/"):])
            if path.startswith("/printer-image/"):
                return self.printer_image(path[len("/printer-image/"):])
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
            ".woff2": "font/woff2",
            ".txt": "text/plain; charset=utf-8",
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
        keep = None
        is_shop_add = self.command == "POST" and rel.split("?")[0] == "inventory/shopping-list"
        if is_shop_add and body:
            # Mengenänderung legt den Eintrag neu an; „_keep“ nennt den alten, damit der Ersteller bleibt.
            try:
                payload = json.loads(body)
                keep = payload.pop("_keep", None)
                body = json.dumps(payload).encode()
            except ValueError:
                pass
        status, data, ctype = self.call_bambuddy(
            self.command, rel, body or None, self.headers.get("Content-Type")
        )
        if is_shop_add and status in (200, 201):
            try:
                note_shop_entry(json.loads(data).get("id"), self.user, keep)
            except (ValueError, AttributeError):
                pass
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

    def unbooked(self):
        # Fehlt das Archiv oder das Recht dafür, gibt es einfach keine Liste statt eines Fehlers.
        try:
            return self.send(200, {"status": "ok", "prints": unbooked_prints()})
        except urllib.error.HTTPError as e:
            return self.send(200, {"status": "forbidden" if e.code in (401, 403) else "failed", "prints": []})
        except (urllib.error.URLError, OSError, ValueError):
            return self.send(200, {"status": "offline", "prints": []})

    def place_settings(self, pid):
        # Icon eines Lagerplatzes aus Bambuddy (Schlüssel ist dessen ID).
        if self.command != "PUT" or not pid.isdigit():
            return self.send(405, {"detail": "Methode nicht erlaubt"})
        icon = (json.loads(self.read_body() or b"{}") or {}).get("icon") or ""
        if icon.startswith("mdi:"):
            if icon[4:] not in load_mdi():
                return self.send(400, {"detail": f"Das Icon {icon} gibt es nicht"})
        elif icon and icon not in PLACE_ICONS:
            return self.send(400, {"detail": "Unbekanntes Icon"})
        places = load_places()
        entry = places.setdefault(pid, {})
        if icon:
            entry["icon"] = icon
        else:
            entry.pop("icon", None)
        save_places(places)
        return self.send(200, places)

    def place_image(self, pid):
        if not pid.isdigit():
            return self.send(404, {"detail": "Kein Bild"})
        key = "place-" + pid
        if self.command == "GET":
            info = read_logo(key)
            if not info or "body" not in info:
                return self.send(404, {"detail": "Kein Bild"})
            return self.send(200, info["body"], info["type"], {"Cache-Control": "max-age=3600"})
        places = load_places()
        if self.command in ("POST", "PUT"):
            ctype = (self.headers.get("Content-Type") or "").split(";")[0]
            # Kein SVG: das könnte Skripte enthalten und liefe im Kontext der App.
            if ctype not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
                return self.send(400, {"detail": "Bitte ein PNG-, JPG-, WebP- oder GIF-Bild hochladen"})
            write_logo(key, ctype, self.read_body(), "upload")
            places.setdefault(pid, {})["image"] = time.time()
        elif self.command == "DELETE":
            for p in logo_paths(key):
                if os.path.exists(p):
                    os.remove(p)
            places.setdefault(pid, {}).pop("image", None)
        else:
            return self.send(405, {"detail": "Methode nicht erlaubt"})
        save_places(places)
        return self.send(200, places)

    def mdi_svg(self, name):
        path = load_mdi().get(name)
        if not path:
            return self.send(404, {"detail": "Icon nicht gefunden"})
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="{path}"/></svg>'
        self.send(200, svg, "image/svg+xml", {"Cache-Control": "max-age=604800"})

    def printer_image(self, pid):
        # Druckerbild direkt von Bambuddy holen (nicht mitgeliefert), im Speicher zwischenspeichern.
        model = PRINTER_MODELS.get(pid)
        if model is None:
            try:
                for p in bambuddy("GET", "printers/") or []:
                    PRINTER_MODELS[str(p.get("id"))] = p.get("model") or ""
            except (urllib.error.URLError, OSError, ValueError):
                pass
            model = PRINTER_MODELS.get(pid, "")
        name = printer_image_name(model)
        if name not in PRINTER_IMAGES:
            base = (load_options().get("bambuddy_url") or DEFAULT_BAMBUDDY).rstrip("/")
            try:
                with urllib.request.urlopen(f"{base}/img/printers/{name}.png", timeout=10) as resp:
                    data = resp.read()
                if not data.startswith(b"\x89PNG"):
                    raise ValueError("kein Bild")
                PRINTER_IMAGES[name] = data
            except (urllib.error.URLError, OSError, ValueError):
                return self.send(404, {"detail": "Kein Druckerbild"})
        self.send(200, PRINTER_IMAGES[name], "image/png", {"Cache-Control": "max-age=86400"})

    def save_theme(self):
        # Hell/Dunkel und Kacheln/Liste je Home-Assistant-Benutzer merken, damit es auf allen Geräten gleich ist.
        data = json.loads(self.read_body() or b"{}") or {}
        allowed = {"theme": ("light", "dark"), "view": ("tiles", "list")}
        prefs = {k: data[k] for k in allowed if k in data}
        if any(v not in allowed[k] for k, v in prefs.items()):
            return self.send(400, {"detail": "Unbekannte Einstellung"})
        if "design" in data:
            if not allowed_for(self.user, "tab_design"):
                return self.send(403, {"detail": "Dafür fehlt dir die Berechtigung"})
            design = clean_design(data["design"])
            if design is None:
                return self.send(400, {"detail": "Ungültige Design-Einstellung"})
            prefs["design"] = design
        if not prefs:
            return self.send(400, {"detail": "Unbekannte Einstellung"})
        if self.user.get("id"):
            with USERS_LOCK:
                users = load_users()
                users.setdefault(self.user["id"], {}).update(prefs)
                save_users(users)
        return self.send(200, prefs)

    def users(self, uid):
        if self.command == "PUT" and uid:
            # Gruppe eines Benutzers ändern; leer = wieder nach Vorgabe aus der Konfiguration.
            gid = (json.loads(self.read_body() or b"{}") or {}).get("group")
            with GROUPS_LOCK:
                groups = load_groups()
                if gid and gid not in groups["groups"]:
                    return self.send(400, {"detail": "Unbekannte Gruppe"})
                if uid == self.user.get("id") and gid != "admin" and self.user.get("group_source") != "config_admin":
                    return self.send(400, {"detail": "Du kannst dich nicht selbst aus der Gruppe Admin nehmen"})
                if gid:
                    groups["members"][uid] = gid
                else:
                    groups["members"].pop(uid, None)
                save_groups(groups)
            return self.send(200, {"ok": True})
        if self.command != "GET":
            return self.send(405, {"detail": "Methode nicht erlaubt"})
        groups = load_groups()
        result = []
        seen = set()
        for uid, u in load_users().items():
            gid, source = resolve_group(uid, u.get("login"), u.get("name"), groups)
            result.append({"id": uid, "name": u.get("name"), "login": u.get("login"), "last_seen": u.get("last_seen"),
                           "group": gid, "source": source})
            seen.update({squash(u.get("login")), squash(u.get("name"))})
        # Eingetragene, die die App noch nie geöffnet haben, trotzdem zeigen.
        for entry in load_options().get("benutzer") or []:
            if squash(entry.get("name")) not in seen:
                gid = entry.get("recht") if entry.get("recht") in groups["groups"] else "kein"
                result.append({"id": None, "name": entry.get("name"), "login": entry.get("name"), "last_seen": None,
                               "group": gid, "source": "config_admin" if gid == "admin" else "config"})
        self.send(200, result)

    def groups(self, gid):
        with GROUPS_LOCK:
            data = load_groups()
            if self.command == "GET":
                return self.send(200, {"groups": [{"id": k, **v} for k, v in data["groups"].items()],
                                       "default": default_group(data), "perms": [{"key": k, "label": l} for k, l in PERMS]})
            req = json.loads(self.read_body() or b"{}") or {}
            if gid == "default" and self.command == "PUT":
                if req.get("group") not in data["groups"] or req.get("group") == "admin":
                    return self.send(400, {"detail": "Diese Gruppe geht nicht als Standard"})
                data["default"] = req["group"]
            elif self.command in ("POST", "PUT"):
                if gid in ("admin", "kein"):
                    return self.send(400, {"detail": "Diese Gruppe ist fest"})
                name = (req.get("name") or "").strip()[:40]
                if not name:
                    return self.send(400, {"detail": "Bitte einen Namen eingeben"})
                perms = [p for p in ALL_PERMS if p in (req.get("perms") or [])]
                if self.command == "POST":
                    gid = "g%d" % int(time.time() * 1000)
                elif gid not in data["groups"]:
                    return self.send(404, {"detail": "Gruppe nicht gefunden"})
                data["groups"][gid] = {"name": name, "perms": perms}
            elif self.command == "DELETE" and gid:
                if gid in ("admin", "kein") or gid not in data["groups"]:
                    return self.send(400, {"detail": "Diese Gruppe kann nicht gelöscht werden"})
                del data["groups"][gid]
                # Mitglieder fallen auf die Vorgabe zurück.
                data["members"] = {u: g for u, g in data["members"].items() if g != gid}
                if data.get("default") == gid:
                    data.pop("default")
            else:
                return self.send(405, {"detail": "Methode nicht erlaubt"})
            save_groups(data)
        self.send(200, {"ok": True, "id": gid})

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
        if key and self.command == "DELETE":
            return self.delete_brand(key)
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

    def delete_brand(self, key):
        # Nur ohne Rollen: sonst stünde der Hersteller über die Rollen sofort wieder in der Liste.
        try:
            spools = bambuddy("GET", "inventory/spools") or []
        except (urllib.error.URLError, OSError, ValueError):
            return self.send(502, {"detail": "Bambuddy nicht erreichbar, Hersteller nicht gelöscht"})
        rolls = sum(1 for sp in spools if not sp.get("archived_at") and brand_key(sp.get("brand")) == key)
        if rolls:
            return self.send(409, {"detail": f"Dem Hersteller sind noch {rolls} {'Rolle' if rolls == 1 else 'Rollen'} zugewiesen"})
        brands = load_brands()
        brands.pop(key, None)
        save_brands(brands)
        for p in logo_paths(key):
            if os.path.exists(p):
                os.remove(p)
        self.send(200, {"ok": True})

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


SHOP_META_FILE = os.path.join(DATA_DIR, "shop_meta.json")
SHOP_META_LOCK = threading.Lock()


def load_shop_meta():
    try:
        with open(SHOP_META_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def note_shop_entry(item_id, user, keep=None):
    """Merken, wer einen Eintrag auf die Einkaufsliste gesetzt hat und wann."""
    if item_id is None:
        return
    with SHOP_META_LOCK:
        meta = load_shop_meta()
        old = meta.pop(str(keep), None) if keep is not None else None
        meta[str(item_id)] = old or {"by": user.get("name") or "lokal", "at": time.strftime("%Y-%m-%dT%H:%M")}
        if old:
            meta[str(item_id)]["changed_by"] = user.get("name") or "lokal"
            meta[str(item_id)]["changed_at"] = time.strftime("%Y-%m-%dT%H:%M")
        # Nicht endlos wachsen lassen.
        if len(meta) > 500:
            meta = dict(sorted(meta.items(), key=lambda kv: kv[1].get("at", ""))[-500:])
        tmp = SHOP_META_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=1)
        os.replace(tmp, SHOP_META_FILE)


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
    data.setdefault("dismissed", [])
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
    if req.get("dismiss") is not None:
        # Druck aus Bambuddys Archiv, der bewusst nicht abgebucht wird (z. B. fremdes Filament).
        aid = int(req["dismiss"])
        if aid not in data["dismissed"]:
            data["dismissed"] = (data["dismissed"] + [aid])[-500:]
        save_usage_edits(data)
        return data
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


def parse_time(value):
    """Zeit aus Bambuddy als naive UTC-Zeit (Bambuddy liefert teils mit, teils ohne Zeitzone)."""
    try:
        t = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return t.astimezone(timezone.utc).replace(tzinfo=None) if t.tzinfo else t


def find_archive(job):
    """Archiveintrag zum Druck suchen: gleicher Drucker, fertig um dieselbe Zeit wie die Abbuchung."""
    when = parse_time(job.get("created_at"))
    if not when:
        return None
    query = f"date_from={(when.date() - timedelta(days=1)).isoformat()}&date_to={(when.date() + timedelta(days=1)).isoformat()}&limit=200"
    if job.get("printer_id") is not None:
        query += f"&printer_id={int(job['printer_id'])}"
    name = (job.get("print_name") or "").strip().lower()
    best = None
    for a in bambuddy("GET", f"archives/?{query}") or []:
        if job.get("printer_id") is not None and a.get("printer_id") not in (None, job["printer_id"]):
            continue
        done = parse_time(a.get("completed_at") or a.get("started_at") or a.get("created_at"))
        if not done:
            continue
        gap = abs((done - when).total_seconds())
        same_name = name and (a.get("print_name") or "").strip().lower() == name
        # Abbuchung und Archiv entstehen beim Druckende; mit gleichem Namen darf es etwas mehr Abstand sein.
        if gap > (3 * 3600 if same_name else 15 * 60):
            continue
        score = gap - (3600 if same_name else 0)
        if best is None or score < best[0]:
            best = (score, a)
    return best[1] if best else None


def unbooked_prints(days=30):
    """Drucke aus Bambuddys Archiv, zu denen keine Abbuchung existiert (z. B. Rolle nicht zugeordnet)."""
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
    archives = bambuddy("GET", f"archives/?date_from={since}&limit=200") or []
    data = load_usage_edits()
    booked = []
    for u in (bambuddy("GET", "inventory/usage?limit=1000") or []) + data["manual"]:
        t = parse_time(u.get("created_at"))
        if t:
            booked.append((u.get("printer_id"), (u.get("print_name") or "").strip().lower(), t))
    dismissed = set(data["dismissed"])
    out = []
    for a in archives:
        if a.get("id") in dismissed or a.get("status") not in ("completed", "failed", "stopped", "cancelled"):
            continue
        grams = a.get("filament_used_grams") or 0
        done = parse_time(a.get("completed_at"))
        if grams < 0.5 or not done:
            continue
        name = (a.get("print_name") or "").strip().lower()
        if any((pid in (None, a.get("printer_id")) and abs((t - done).total_seconds()) <= 15 * 60)
               or (name and n == name and abs((t - done).total_seconds()) <= 3 * 3600) for pid, n, t in booked):
            continue
        out.append({"id": a["id"], "print_name": a.get("print_name"), "printer_id": a.get("printer_id"),
                    "completed_at": a.get("completed_at"), "grams": round(grams, 1), "status": a.get("status"),
                    "filament_type": a.get("filament_type"), "filament_color": a.get("filament_color")})
    out.sort(key=lambda a: a["completed_at"] or "", reverse=True)
    return out


def sync_archive(req):
    """Korrigierte Menge eines Drucks in Bambuddys Archiv schreiben.

    Liefert immer eine Antwort mit Status statt eines Fehlers: Die Rolle ist zu diesem Zeitpunkt schon korrigiert,
    das Archiv ist nur eine Ergänzung.
    """
    job = req.get("job") or {}
    try:
        grams = round(float(req.get("grams")), 1)
    except (TypeError, ValueError):
        return {"status": "invalid", "message": "Ungültige Menge, Archiv nicht geändert"}
    try:
        archive = find_archive(job)
        if not archive:
            return {"status": "missing", "message": "Druck nicht mehr im Bambuddy-Archiv, dort nichts geändert"}
        payload = {"filament_used_grams": grams}
        if req.get("cost") is not None:
            payload["cost"] = round(float(req["cost"]), 2)
        bambuddy("PATCH", f"archives/{archive['id']}", payload)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"status": "missing", "message": "Druck nicht mehr im Bambuddy-Archiv, dort nichts geändert"}
        if e.code in (401, 403):
            return {"status": "forbidden", "message": "Der API-Schlüssel darf das Bambuddy-Archiv nicht ändern („Archive verwalten“ fehlt)"}
        return {"status": "failed", "message": f"Bambuddy-Archiv nicht aktualisiert (Fehler {e.code})"}
    except (urllib.error.URLError, OSError, ValueError):
        return {"status": "offline", "message": "Bambuddy nicht erreichbar, Archiv nicht aktualisiert"}
    return {"status": "ok", "archive_id": archive["id"], "message": "Auch im Bambuddy-Archiv korrigiert"}


PRINTER_MODELS = {}
PRINTER_IMAGES = {}


def printer_image_name(model):
    # Gleiche Zuordnung wie in Bambuddy (Modell → Bilddatei unter /img/printers/).
    m = re.sub(r"\s+", "", (model or "").lower())
    for keys, name in ((("x1e",), "x1e"), (("x1c", "x1carbon", "x1"), "x1c"), (("x2d",), "x2d"),
                       (("h2dpro", "h2d-pro"), "h2dpro"), (("h2d",), "h2d"), (("h2c",), "h2c"), (("h2s",), "h2d"),
                       (("p2s", "p1s"), "p1s"), (("p1p",), "p1p"), (("a2l",), "a2l"), (("a1mini",), "a1mini"), (("a1",), "a1")):
        if any(k in m for k in keys):
            return name
    return {"n6": "x2d", "n9": "a2l"}.get(m, "default")


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
        PRINTER_MODELS[str(p["id"])] = p.get("model") or ""
        entry = {"id": p["id"], "name": p.get("name") or f"Drucker {p['id']}", "model": p.get("model") or "", "connected": False, "slots": []}
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
