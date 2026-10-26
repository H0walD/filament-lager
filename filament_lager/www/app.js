"use strict";

// Alle Adressen sind relativ, damit die Seite hinter dem Home-Assistant-Ingress läuft.
const REFRESH_MS = 15000;
const LOW_GRAMS = 300;

const state = {
  spools: [],
  shop: [],
  groups: [],
  filter: { text: "", brand: [], material: [], color: [], place: [] },
  logoVersion: Date.now(),
  loaded: false,
};

const $ = (sel) => document.querySelector(sel);

// Rechte-Stufen wie im Server: 0 kein Zugriff, 1 ansehen, 2 erfassen, 3 bearbeiten, 4 Admin.
const VIEW = 1, ADD = 2, EDIT = 3, ADMIN = 4;
const LEVELS = ["Kein Zugriff", "Ansehen", "Erfassen", "Bearbeiten", "Admin"];
const can = (level) => (state.me?.level ?? 0) >= level;

// Einheitliche Linien-Icons statt Emojis, damit alles gleich aussieht.
const ICONS = {
  shelf: '<path d="M4 3v18M20 3v18M4 9h16M4 15h16"/><path d="M7 6h3v3H7zM13 12h4v3h-4zM8 18h3v3H8z"/>',
  dryer: '<rect x="3" y="6" width="18" height="15" rx="2.5"/><circle cx="12" cy="13.5" r="4"/><circle cx="12" cy="13.5" r="1.2"/><path d="M8 2.5c.7.7.7 1.4 0 2M12 2.5c.7.7.7 1.4 0 2M16 2.5c.7.7.7 1.4 0 2"/>',
  printer: '<rect x="3.5" y="2.5" width="17" height="19" rx="2.5"/><path d="M3.5 7h17M10 7h4v2.6h-4zM11.4 9.6h1.2L12 11z"/><path d="M9 15.5h6v2.5H9zM6.5 18h11"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.4c-.5-.9-1.4-1.4-2.6-1.4-1.6 0-2.5.9-2.5 1.9 0 2.4 5.1 1.3 5.1 4.1 0 1.1-1 2-2.6 2-1.2 0-2.2-.6-2.6-1.5M12 6.5V8M12 16v1.5"/>',
  spool: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3a9 9 0 0 1 9 9h-6a3 3 0 0 0-3-3z" fill="currentColor" stroke="none" opacity=".55"/>',
  cart: '<path d="M3 4h2.2l2.3 10.5h10.3l2.1-7.5H6.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  box: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
  drawer: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M3.5 15h17M10 6.5h4M10 12.2h4M10 17.8h4"/>',
  cabinet: '<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M12 2.5v19M9.5 11v2M14.5 11v2"/>',
  bag: '<path d="M6 7h12l1 13.5H5z"/><path d="M5.5 11h13M9 7V5.5a3 3 0 0 1 6 0V7"/>',
};
const ic = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// Lagerplatz-Icon: selbst gewähltes Icon oder hochgeladenes Bild, sonst das Regal als Standard.
const PLACE_ICONS = [["shelf", "Regal"], ["dryer", "Trockner"], ["box", "Kiste"], ["drawer", "Schublade"], ["cabinet", "Schrank"], ["bag", "Beutel"]];

// Eigenes Icon: eingebautes („dryer“) oder Material Design Icon wie in Home Assistant („mdi:fridge“).
function iconHtml(icon, cls = "") {
  const m = /^mdi:([a-z0-9-]+)$/.exec(icon || "");
  if (m) return `<span class="ic mdi ${cls}" style="-webkit-mask-image:url(mdi/${m[1]}.svg);mask-image:url(mdi/${m[1]}.svg)"></span>`;
  return ic(ICONS[icon] ? icon : "shelf", cls);
}

function placeIconById(id, cls = "") {
  const set = (state.places || {})[String(id)] || {};
  if (id && set.image) return `<img class="locimg ${cls}" src="place-image/${id}?v=${Math.round(set.image)}" alt="">`;
  return iconHtml(set.icon, cls);
}

function placeIcon(name) {
  const loc = (state.locationList || []).find((l) => l.name === name);
  return placeIconById(loc?.id);
}

// Bild des Druckers aus Bambuddy, bei Fehler das allgemeine Drucker-Icon.
function printerIcon(printerId) {
  if (printerId == null) return ic("printer");
  return `<span class="pwrap"><img class="pimg" src="printer-image/${printerId}" alt="" onerror="this.parentNode.classList.add('noimg')">${ic("printer", "pfb")}</span>`;
}

// Hell/Dunkel: pro Benutzer im Server gespeichert, damit es auf allen Geräten gleich aussieht.
function setTheme(theme, save) {
  theme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  $("#themeBtn").innerHTML = theme === "dark" ? ic("sun") + " Hell" : ic("moon") + " Dunkel";
  try { localStorage.setItem("theme", theme); } catch { /* egal */ }
  if (save) api("api/me", { method: "POST", body: JSON.stringify({ theme }) }).catch(() => {});
}

$("#themeBtn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
setTheme(document.documentElement.dataset.theme);

function applyRights() {
  document.body.classList.toggle("can-add", can(ADD));
  document.body.classList.toggle("can-edit", can(EDIT));
  document.body.classList.toggle("is-admin", can(ADMIN));
  const blocked = !can(VIEW);
  $("main").querySelectorAll("section").forEach((s) => s.classList.toggle("blocked", blocked));
  $("#noAccess").classList.toggle("hidden", !blocked);
  $(".tabs").classList.toggle("hidden", blocked);
  $("#meInfo").textContent = state.me?.name && state.me.name !== "lokal" ? `${state.me.name} · ${LEVELS[state.me.level]}` : "";
}
const norm = (s) => (s || "").toString().trim().toLowerCase();
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kg = (g) => (g >= 1000 ? (g / 1000).toFixed(g >= 10000 ? 0 : 1).replace(".", ",") + " kg" : Math.round(g) + " g");

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof Blob) ? { "Content-Type": "application/json", ...(opts.headers || {}) } : opts.headers,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = data && data.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : res.statusText;
    throw new Error(detail || "Fehler " + res.status);
  }
  return data;
}

function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), ms);
}

function banner(msg) {
  const b = $("#banner");
  if (!msg) return b.classList.add("hidden");
  b.innerHTML = msg;
  b.classList.remove("hidden");
}

// ---------- Daten ----------

function groupKey(s) {
  // Groß-/Kleinschreibung, Leerzeichen und Bindestriche zählen nicht, so landen gleiche Sorten in einer Kachel.
  return [squash(s.brand), squash(s.material), squash(s.subtype), squash(s.color_name)].join("|");
}

function remaining(s) {
  return Math.max(0, (s.label_weight || 0) - (s.weight_used || 0));
}

function rollValue(s) {
  return s.cost_per_kg ? remaining(s) / 1000 * s.cost_per_kg : 0;
}

function money(v) {
  const cur = state.currency || "";
  try {
    if (/^[A-Z]{3}$/.test(cur)) return new Intl.NumberFormat("de-CH", { style: "currency", currency: cur }).format(v);
  } catch { /* unbekannte Währung */ }
  return v.toFixed(2).replace(".", ",") + (cur ? " " + cur : "");
}

const hasChip = (s) => !!(s.tag_uid || s.tray_uuid);

// Name eines Platzes wie im Server: „AMS A · Slot 2“, „AMS HT 1“ oder „Externe Spule“.
function slotName(ams, tray) {
  if (ams === 255) return "Externe Spule" + (tray ? " " + (tray + 1) : "");
  if (ams >= 128) return "AMS HT " + (ams - 127);
  return `AMS ${String.fromCharCode(65 + ams)} · Slot ${tray + 1}`;
}

function slotLabel(a) {
  const printers = state.printers || [];
  const printer = printers.find((p) => p.id === a.printer_id);
  const name = (state.printers || []).length > 1 ? (printer?.name || a.printer_name || "") + " · " : "";
  const slot = printer?.slots.find((x) => x.ams_id === a.ams_id && x.tray_id === a.tray_id);
  return name + (a.ams_label && a.ams_id !== 255 ? `${a.ams_label} · Slot ${a.tray_id + 1}` : slot?.name || slotName(a.ams_id, a.tray_id));
}

function spoolPlace(s) {
  if (state.inPrinter?.has(s.id)) return "";
  return (s.location_id && state.locations?.get(s.location_id)) || s.storage_location || "";
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return isNaN(d) ? "" : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildGroups() {
  const map = new Map();
  for (const s of state.spools) {
    if (s.archived_at) continue;
    const key = groupKey(s);
    let g = map.get(key);
    if (!g) {
      g = { key, brand: s.brand || "Ohne Hersteller", material: s.material, subtype: s.subtype || "", color_name: s.color_name || "", rgba: s.rgba, template: s, spools: [], remaining: 0, capacity: 0 };
      map.set(key, g);
    }
    g.spools.push(s);
    g.remaining += remaining(s);
    g.capacity += s.label_weight || 0;
    if ((s.id || 0) > (g.template.id || 0)) g.template = s;
  }
  for (const g of map.values()) {
    // Farbe der Sorte: die zuletzt geänderte Rolle mit gültiger Farbe, nicht einfach die erste.
    const colored = g.spools.filter((s) => /^[0-9a-f]{6}/i.test(s.rgba || ""))
      .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "") || b.id - a.id);
    g.rgba = colored[0]?.rgba || null;
    g.mixedColors = new Set(colored.map((s) => s.rgba.slice(0, 6).toUpperCase())).size > 1;
    // Neue Rollen (+1, Eingetroffen) übernehmen die Farbe der Sorte, auch wenn die Vorlage keine hat.
    if (g.rgba && g.template.rgba !== g.rgba) g.template = { ...g.template, rgba: g.rgba };
    // Im Drucker = einem AMS-Platz zugeordnet, im Regal = alle übrigen Rollen.
    g.printer = g.spools.filter((s) => state.inPrinter?.has(s.id)).length;
    g.shelf = g.spools.length - g.printer;
    g.full = g.spools.filter((s) => (s.weight_used || 0) < 1).length;
    g.opened = g.spools.filter((s) => (s.weight_used || 0) >= 1 && remaining(s) > 0).length;
    g.places = [...new Set(g.spools.map(spoolPlace).filter(Boolean))];
    g.value = g.spools.reduce((n, s) => n + rollValue(s), 0);
    g.slotList = g.spools.filter((s) => state.slotOf?.has(s.id)).map((s) => ({ printer_id: state.slotOf.get(s.id).printer_id, label: slotLabel(state.slotOf.get(s.id)) }));
    g.slots = g.slotList.map((x) => x.label);
    g.lastUsed = g.spools.map((s) => s.last_used || state.lastUse?.get(s.id) || "").sort().pop() || "";
    const threshold = g.template.low_stock_threshold_pct;
    g.empty = g.remaining <= 0;
    g.low = !g.empty && (threshold ? g.remaining < (g.template.label_weight || 1000) * threshold / 100 : g.remaining < LOW_GRAMS);
  }
  state.groups = [...map.values()];
}

function stockFor(item) {
  // Lagerbestand passend zu einem Einkaufslisten-Eintrag (Hersteller, Material, Typ, Farbe).
  let rolls = 0, grams = 0, printer = 0, match = null;
  for (const g of state.groups) {
    if (norm(g.material) !== norm(item.material)) continue;
    if (item.brand && norm(g.brand) !== norm(item.brand)) continue;
    if (item.subtype && norm(g.subtype) !== norm(item.subtype)) continue;
    if (item.color_name && norm(g.color_name) !== norm(item.color_name)) continue;
    rolls += g.shelf;
    printer += g.printer;
    grams += g.remaining;
    match = match || g;
  }
  return { rolls, grams, printer, match };
}

function cartFor(g) {
  return state.shop.find((i) => i.status === "pending" && norm(i.material) === norm(g.material) && norm(i.brand) === norm(g.brand)
    && norm(i.subtype) === norm(g.subtype) && norm(i.color_name) === norm(g.color_name));
}

async function load(quiet) {
  // Rechte bei jedem Abruf auffrischen, damit Änderungen durch den Admin ohne Neuladen greifen.
  const me = await api("api/me").catch(() => state.me);
  if (me?.theme && me.theme !== document.documentElement.dataset.theme) setTheme(me.theme);
  if (me && me.level !== state.me?.level) {
    state.me = me;
    applyRights();
  }
  if (!can(VIEW)) return;
  try {
    const [spools, shop, rec, slots, brands, locations, , rawUsage, printers, edits] = await Promise.all([api("api/inventory/spools?include_archived=true"),
      api("api/inventory/shopping-list"), api("reconcile").catch(() => null), api("api/inventory/assignments").catch(() => []),
      api("brands").catch(() => ({})), api("api/inventory/locations").catch(() => []),
      api("places").then((p) => { state.places = p || {}; }).catch(() => {}),
      api("api/inventory/usage?limit=500").catch(() => []), api("printers").catch(() => null),
      api("usage-edits").catch(() => null)]);
    state.brands = brands;
    state.locations = new Map((Array.isArray(locations) ? locations : []).map((l) => [l.id, l.name]));
    state.locationList = Array.isArray(locations) ? locations : [];
    // Letzte Nutzung je Rolle aus dem Verbrauchsverlauf, falls Bambuddy last_used nicht setzt.
    state.allSpools = new Map((Array.isArray(spools) ? spools : []).map((s) => [s.id, s]));
    const usage = mergeUsage(Array.isArray(rawUsage) ? rawUsage : [], edits || { edits: {}, manual: [] });
    state.usageList = usage;
    state.lastUse = new Map();
    state.usage = new Map();
    for (const u of usage) {
      if (!state.lastUse.has(u.spool_id) || state.lastUse.get(u.spool_id) < u.created_at) state.lastUse.set(u.spool_id, u.created_at);
      if (!state.usage.has(u.spool_id)) state.usage.set(u.spool_id, []);
      state.usage.get(u.spool_id).push(u);
    }
    for (const list of state.usage.values()) list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    state.assignments = Array.isArray(slots) ? slots : [];
    state.slotOf = new Map(state.assignments.map((a) => [a.spool_id, a]));
    state.inPrinter = new Set(state.assignments.map((a) => a.spool_id));
    // Druckerliste nur ersetzen, wenn sie geladen werden konnte, sonst bleibt die letzte bekannte.
    if (printers && Array.isArray(printers.printers)) {
      state.printers = printers.printers;
      state.currency = printers.currency || state.currency || "";
    }
    // Ausgebuchte Rollen nur für den Verbrauchsverlauf behalten.
    state.spools = (Array.isArray(spools) ? spools : []).filter((s) => !s.archived_at);
    state.shop = Array.isArray(shop) ? shop : [];
    state.reconcile = rec || { merged: [], unclear: [] };
    state.loaded = true;
    buildGroups();
    banner(null);
    render();
    $("#updated").textContent = "Stand " + new Date().toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch (e) {
    if (!quiet || !state.loaded) await explainError();
  }
}

async function explainError() {
  try {
    const s = await api("api/status");
    if (s.reason === "no_key") return banner("<b>Noch kein API-Schlüssel eingetragen.</b> Lege in Bambuddy unter Einstellungen → API-Schlüssel einen Schlüssel an und trage ihn in Home Assistant bei dieser App unter <i>Konfiguration</i> ein.");
    if (s.reason === "bad_key") return banner("<b>Bambuddy lehnt den API-Schlüssel ab.</b> Prüfe den Schlüssel und ob er das Recht <i>Inventar verwalten</i> hat.");
    if (s.reason === "unreachable") return banner("<b>Bambuddy ist gerade nicht erreichbar.</b> Läuft die Bambuddy-App?");
  } catch { /* fällt auf die allgemeine Meldung zurück */ }
  banner("<b>Daten konnten nicht geladen werden.</b> Ich versuche es gleich wieder.");
}

// ---------- Darstellung ----------

function logoHtml(brand, cls = "") {
  // Nur hochgeladene Logos; ohne Logo bleibt nur der Name.
  if (!(state.brands || {})[brandKey(brand)]?.logo) return "";
  return `<span class="logo ${cls}"><img src="logo/${encodeURIComponent(brand)}?v=${state.logoVersion}" alt="" onerror="this.parentNode.remove()"></span>`;
}

function websiteOf(brand) {
  const w = (state.brands || {})[brandKey(brand)]?.website || "";
  return w ? (/^https?:\/\//i.test(w) ? w : "https://" + w) : "";
}

function websiteLink(brand) {
  const url = websiteOf(brand);
  if (!url) return "";
  const label = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `<a class="siteLink" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Webseite öffnen">${ic("link")} ${esc(label)}</a>`;
}

function color(g) {
  const hex = (g.rgba || "").slice(0, 6);
  return /^[0-9a-f]{6}$/i.test(hex) ? "#" + hex : "#999999";
}

// Farbfamilie aus dem Hex-Code, damit „Black“ und „Schwarz“ im selben Filter landen.
function colorFamily(rgba) {
  if (!/^[0-9a-f]{6}/i.test(rgba || "")) return "Ohne Farbe";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgba.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.15) return "Schwarz";
  if (s < 0.15) return l > 0.85 ? "Weiß" : "Grau";
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (l > 0.85 && s < 0.5) return "Weiß";
  if (h < 15 || h >= 345) return l < 0.35 ? "Braun" : "Rot";
  if (h < 45) return l < 0.45 || s < 0.45 ? "Braun" : "Orange";
  if (h < 70) return l < 0.35 ? "Braun" : "Gelb";
  if (h < 165) return "Grün";
  if (h < 255) return "Blau";
  if (h < 290) return "Lila";
  return "Pink";
}

const PLACE_PRINTER = "__printer", PLACE_NONE = "__none";

const FILTER_KEYS = ["brand", "material", "color", "place"];

function placeMatches(g, p) {
  if (p === PLACE_PRINTER) return g.printer > 0;
  if (p === PLACE_NONE) return g.shelf > 0 && !g.places.length;
  return g.places.includes(p);
}

function matchesFilter(g) {
  // Innerhalb eines Filters reicht ein Treffer (oder), zwischen den Filtern muss alles passen (und).
  const f = state.filter;
  if (f.brand.length && !f.brand.some((v) => norm(v) === norm(g.brand))) return false;
  if (f.material.length && !f.material.some((v) => norm(v) === norm(g.material))) return false;
  if (f.color.length && !f.color.includes(colorFamily(g.rgba))) return false;
  if (f.place.length && !f.place.some((p) => placeMatches(g, p))) return false;
  if (!f.text) return true;
  const hay = norm([g.brand, g.material, g.subtype, g.color_name].join(" "));
  return norm(f.text).split(/\s+/).every((w) => hay.includes(w));
}

function renderChipBox() {
  // Chip-Rollen vom Drucker: automatisch zusammengeführte (letzte 24 h) und unklare zum Zuordnen.
  const rec = state.reconcile || {};
  const dot = (rgba) => `<span class="swatch" style="background:${/^[0-9a-f]{6}/i.test(rgba || "") ? "#" + rgba.slice(0, 6) : "#999"}"></span>`;
  const recent = (rec.merged || []).filter((m) => Date.now() / 1000 - m.time < 86400).reverse();
  const unclear = rec.unclear || [];
  if (!recent.length && !unclear.length) return $("#chipBox").classList.add("hidden");
  $("#chipBox").innerHTML = `<h3>Vom Drucker erkannt</h3>` +
    unclear.map((u) => `<div class="chipRow unclear">${dot(u.rgba)}<span>Chip-Rolle <b>${esc(u.chip)}</b> passt zu mehreren Sorten:</span>
      <select data-chip="${u.chip_id}">${u.options.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>
      <button class="primary need-edit" data-act="resolve" data-chip="${u.chip_id}">Zuordnen</button>
      <button class="need-edit" data-act="keep" data-chip="${u.chip_id}">Ist eine neue Rolle</button></div>`).join("") +
    recent.map((m) => `<div class="chipRow">${dot(m.rgba)}<span>Chip erkannt und deiner Lager-Rolle <b>${esc(m.name)}</b> zugeordnet, nichts doppelt.</span></div>`).join("");
  $("#chipBox").classList.remove("hidden");
}

function render() {
  renderChipBox();
  renderSlotBox();
  if ($("#rollDialog").open && rollGroupKey) renderRolls();
  renderChips();
  renderStock();
  renderShop();
  renderBrands();
  renderPlaces();
  renderLists();
  renderUsage();
}

// Gleicher Schlüssel wie im Server (brand_key), damit Webseite und Logo zusammenpassen.
const brandKey = (s) => (s || "").toLowerCase().replace(/[^a-z0-9:]/g, "");

function allBrands() {
  // Hersteller aus den Rollen plus selbst angelegte (auch ohne Rollen).
  const map = new Map();
  for (const s of state.spools) if (s.brand) map.set(brandKey(s.brand), { name: s.brand, rolls: 0, website: "" });
  for (const [key, b] of Object.entries(state.brands || {})) {
    const entry = map.get(key) || { name: b.name || key, rolls: 0 };
    entry.website = b.website || "";
    map.set(key, entry);
  }
  for (const g of state.groups) {
    const e = map.get(brandKey(g.brand));
    if (e) e.rolls += g.spools.length;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function renderBrands() {
  const list = allBrands();
  $("#brandCount").textContent = list.length || "";
  $("#brandGrid").innerHTML = list.length ? list.map((b) => `
    <div class="brandCard">
      ${logoHtml(b.name, "big")}
      <span class="brandCardName">${esc(b.name)}</span>
      <span class="muted">${b.rolls} ${b.rolls === 1 ? "Rolle" : "Rollen"}</span>
      ${websiteLink(b.name) || `<span class="muted">keine Webseite</span>`}
      <button class="need-edit" data-act="brand" data-brand="${esc(b.name)}">Bearbeiten</button>
    </div>`).join("") : `<div class="emptyState">Noch keine Hersteller.</div>`;
}

const FILTER_UI = { brand: ["#fBrand", "Alle Hersteller"], material: ["#fMaterial", "Alle Materialien"], color: ["#fColor", "Alle Farben"], place: ["#fPlace", "Alle Lagerorte"] };
let openMenu = null;

function filterOptions(key) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "de")).map((v) => [v, v]);
  if (key === "brand") return uniq(state.groups.map((g) => g.brand));
  if (key === "material") return uniq(state.groups.map((g) => g.material));
  if (key === "color") return uniq(state.groups.map((g) => colorFamily(g.rgba)));
  return [...uniq(state.groups.flatMap((g) => g.places)), [PLACE_PRINTER, "Im Drucker"], [PLACE_NONE, "Ohne Lagerplatz"]];
}

function saveFilter() {
  try { localStorage.setItem("filter", JSON.stringify(state.filter)); } catch { /* egal */ }
}

function renderChips() {
  // Mehrfachauswahl je Filter; gewählte Werte, die es nicht mehr gibt, fallen weg.
  for (const key of FILTER_KEYS) {
    const [id, all] = FILTER_UI[key];
    const box = $(id);
    const options = filterOptions(key);
    state.filter[key] = state.filter[key].filter((v) => options.some(([o]) => o === v));
    const chosen = state.filter[key];
    const labelOf = (v) => options.find(([o]) => o === v)?.[1] || v;
    const text = !chosen.length ? all : chosen.length === 1 ? labelOf(chosen[0]) : `${chosen.length} ausgewählt`;
    box.classList.toggle("active", chosen.length > 0);
    box.innerHTML = `<button type="button" class="msBtn" data-ms="${key}">${esc(text)}</button>
      <div class="msMenu${openMenu === key ? "" : " hidden"}">
        ${options.map(([v, label]) => `<label><input type="checkbox" data-msval="${key}" value="${esc(v)}"${chosen.includes(v) ? " checked" : ""}>${esc(label)}</label>`).join("")}
        ${chosen.length ? `<button type="button" class="msClear" data-msclear="${key}">Auswahl löschen</button>` : ""}
      </div>`;
  }
  $("#fReset").classList.toggle("hidden", !FILTER_KEYS.some((k) => state.filter[k].length));
}

$(".filters").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-ms]");
  if (btn) {
    openMenu = openMenu === btn.dataset.ms ? null : btn.dataset.ms;
    return renderChips();
  }
  const clear = ev.target.closest("[data-msclear]");
  if (clear) {
    state.filter[clear.dataset.msclear] = [];
    saveFilter();
    renderChips();
    renderStock();
  }
});

$(".filters").addEventListener("change", (ev) => {
  const cb = ev.target.closest("input[data-msval]");
  if (!cb) return;
  const key = cb.dataset.msval;
  const set = new Set(state.filter[key]);
  cb.checked ? set.add(cb.value) : set.delete(cb.value);
  state.filter[key] = [...set];
  saveFilter();
  renderChips();
  renderStock();
});

// Klick außerhalb schließt das offene Auswahlmenü.
document.addEventListener("click", (ev) => {
  // Nach dem Neuzeichnen hängt das angeklickte Element nicht mehr im Dokument, dann nichts schließen.
  if (openMenu && ev.target.isConnected && !ev.target.closest(".ms")) {
    openMenu = null;
    renderChips();
  }
});

$("#fReset").addEventListener("click", () => {
  for (const k of FILTER_KEYS) state.filter[k] = [];
  openMenu = null;
  saveFilter();
  renderChips();
  renderStock();
});

function renderStock() {
  const groups = state.groups.filter(matchesFilter);
  const rolls = state.groups.reduce((n, g) => n + g.shelf, 0);
  const printer = state.groups.reduce((n, g) => n + g.printer, 0);
  const grams = state.groups.reduce((n, g) => n + g.remaining, 0);
  const low = state.groups.filter((g) => g.low || g.empty).length;
  $("#stockCount").textContent = rolls;
  $("#summary").innerHTML = `
    <div class="stat"><b>${rolls}</b><span class="muted">Rollen im Lager</span></div>
    <div class="stat"><b>${printer}</b><span class="muted">im Drucker</span></div>
    <div class="stat"><b>${state.groups.reduce((n, g) => n + g.opened, 0)}</b><span class="muted">angebrochen</span></div>
    <div class="stat"><b>${kg(grams)}</b><span class="muted">Filament übrig</span></div>
    <div class="stat"><b>${state.groups.length}</b><span class="muted">Sorten</span></div>
    ${state.groups.some((g) => g.value) ? `<div class="stat"><b>${money(state.groups.reduce((n, g) => n + g.value, 0))}</b><span class="muted">Lagerwert</span></div>` : ""}
    <div class="stat ${low ? "low" : ""}"><b>${low}</b><span class="muted">knapp</span></div>`;

  if (!groups.length) {
    $("#brands").innerHTML = `<div class="emptyState">${state.loaded ? (state.groups.length ? "Nichts gefunden." : "Noch kein Material im Lager. Leg mit „+ Neues Material“ los.") : "Lade …"}</div>`;
    return;
  }
  const byBrand = new Map();
  for (const g of groups) {
    if (!byBrand.has(g.brand)) byBrand.set(g.brand, []);
    byBrand.get(g.brand).push(g);
  }
  const brands = [...byBrand.keys()].sort((a, b) => a.localeCompare(b, "de"));
  $("#brands").innerHTML = brands.map((brand) => {
    const list = byBrand.get(brand).sort((a, b) => (a.material + a.subtype + a.color_name).localeCompare(b.material + b.subtype + b.color_name, "de"));
    const count = list.reduce((n, g) => n + g.spools.length, 0);
    return `<div class="brand">
      <div class="brandHead">${logoHtml(brand)}<h2>${esc(brand)}</h2><span class="muted">${count} ${count === 1 ? "Rolle" : "Rollen"}</span>
        ${websiteLink(brand)}
        <button class="icon need-edit" data-act="brand" data-brand="${esc(brand)}" title="Hersteller bearbeiten">${ic("edit")}</button></div>
      <div class="grid">${list.map(tileHtml).join("")}</div></div>`;
  }).join("");
}

function tileHtml(g) {
  const pct = g.capacity ? Math.round((g.remaining / g.capacity) * 100) : 0;
  const cls = g.empty ? "empty" : g.low ? "low" : "";
  const badge = g.empty ? `<span class="badge empty">leer</span>` : g.low ? `<span class="badge low">knapp</span>` : "";
  const cart = cartFor(g);
  return `<div class="tile ${cls}">
    <div class="tileTop" data-edit="${esc(g.key)}" title="Antippen zum Bearbeiten"><span class="swatch" style="background:${color(g)}"></span>
      <div class="grow"><div class="tileName">${esc(g.color_name || "Ohne Farbname")} <span class="editHint need-edit">${ic("edit")}</span></div>
      <div class="tileSub">${esc([g.material, g.subtype].filter(Boolean).join(" "))}${missingFields(g).length ? ` <span class="missing">· fehlt: ${missingFields(g).join(", ")}</span>` : ""}</div></div></div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <div class="tileInfo"><span><b>${g.shelf}</b> im Lager${g.printer ? ` · <b>${g.printer}</b> im Drucker` : ""} ${badge}</span><span>${kg(g.remaining)}</span></div>
    <div class="tileMeta">
      ${g.opened ? `<span>${ic("spool")} ${g.opened} angebrochen</span>` : ""}
      ${g.places.length ? g.places.map((pl) => `<span>${placeIcon(pl)} ${esc(pl)}</span>`).join("") : g.shelf ? `<span class="muted">${ic("pin")} kein Lagerplatz</span>` : ""}
      ${g.slotList.map((x) => `<span>${printerIcon(x.printer_id)} ${esc(x.label)}</span>`).join("")}
      ${g.value ? `<span>${ic("coin")} ${money(g.value)} Wert</span>` : ""}
      <span>${ic("clock")} ${g.lastUsed ? "zuletzt " + fmtDate(g.lastUsed) : "noch nie verwendet"}</span>
    </div>
    <div class="tileActions">
      <button class="minus need-edit" data-act="minus" data-key="${esc(g.key)}" title="Eine Rolle ausbuchen"${g.shelf ? "" : " disabled"}>−</button>
      <button class="need-add" data-act="plus" data-key="${esc(g.key)}" title="Eine volle Rolle dazubuchen">+1</button>
      <button class="need-add" data-act="cart" data-key="${esc(g.key)}" title="Auf die Einkaufsliste">${cart ? `${ic("cart")} <span class="badge cart">${cart.quantity_spools}</span>` : ic("cart")}</button>
      <button class="need-add" data-act="load" data-key="${esc(g.key)}" title="Rolle in den Drucker einlegen"${g.shelf ? "" : " disabled"}>${ic("printer")}</button>
      <button data-act="rolls" data-key="${esc(g.key)}" title="Rollen einzeln ansehen, Restgewicht und Verbrauch">${ic("list")}</button>
    </div></div>`;
}

function missingFields(g) {
  const t = g.template;
  return [!t.brand && "Hersteller", !t.subtype && "Typ", !t.color_name && "Farbname", !g.rgba && "Farbe"].filter(Boolean);
}

function renderShop() {
  const items = [...state.shop].sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || (a.added_at || "").localeCompare(b.added_at || ""));
  const open = items.filter((i) => i.status !== "received");
  $("#shopCount").textContent = open.length || "";
  if (!items.length) {
    $("#shopList").innerHTML = `<div class="emptyState">Die Einkaufsliste ist leer. Tippe im Lager bei einer Sorte auf den Warenkorb.</div>`;
    return;
  }
  $("#shopList").innerHTML = items.map((i) => {
    const st = stockFor(i);
    const sw = st.match ? `<span class="swatch" style="width:32px;height:32px;background:${color(st.match)}"></span>` : "";
    const statusLabel = { pending: "zu kaufen", purchased: "bestellt", received: "eingetroffen" }[i.status] || i.status;
    const done = i.status === "received";
    let actions = "";
    if (i.status === "pending") actions = `<button class="need-add" data-act="ordered" data-id="${i.id}">Bestellt</button><button class="primary need-add" data-act="receive" data-id="${i.id}">Eingetroffen</button>`;
    else if (i.status === "purchased") actions = `<button class="primary need-add" data-act="receive" data-id="${i.id}">Eingetroffen → ins Lager</button>`;
    return `<div class="shopItem ${done ? "done" : ""}">
      ${sw}${i.brand ? logoHtml(i.brand, "small") : ""}
      <div class="shopMain"><b>${esc(i.color_name || "")}</b> ${esc([i.material, i.subtype].filter(Boolean).join(" "))}
        <div class="muted">${esc(i.brand || "")}${i.note ? " · " + esc(i.note) : ""}</div></div>
      <div class="shopStock">Im Lager: <b>${st.rolls}</b> ${st.rolls === 1 ? "Rolle" : "Rollen"}<div class="muted">${st.printer ? st.printer + " im Drucker · " : ""}${kg(st.grams)} übrig</div></div>
      <div class="qty">${done ? "" : `<button class="icon need-add" data-act="qty-" data-id="${i.id}">−</button>`}<span>${i.quantity_spools}×</span>${done ? "" : `<button class="icon need-add" data-act="qty+" data-id="${i.id}">+</button>`}</div>
      <span class="status ${esc(i.status)}">${esc(statusLabel)}</span>
      ${actions}
      <button class="icon need-add" data-act="remove" data-id="${i.id}" title="Entfernen">${ic("close")}</button>
    </div>`;
  }).join("");
}

function statusOrder(s) {
  return { pending: 0, purchased: 1, received: 2 }[s] ?? 3;
}

function renderLists() {
  const fill = (id, values) => {
    $(id).innerHTML = [...new Set(values.filter(Boolean))].sort().map((v) => `<option value="${esc(v)}">`).join("");
  };
  fill("#brandList", allBrands().map((b) => b.name));
  fill("#materialList", ["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC", ...state.spools.map((s) => s.material)]);
  fill("#subtypeList", ["Basic", "Matte", "Silk", "Glow", "CF", "HF", "Translucent", ...state.spools.map((s) => s.subtype)]);
}

// ---------- Aktionen ----------

const COPY_FIELDS = ["material", "subtype", "color_name", "rgba", "extra_colors", "effect_type", "brand", "label_weight", "core_weight",
  "core_weight_catalog_id", "slicer_filament", "slicer_filament_name", "nozzle_temp_min", "nozzle_temp_max", "cost_per_kg",
  "category", "low_stock_threshold_pct", "material_number", "storage_location", "location_id"];

function spoolFrom(template) {
  const spool = {};
  for (const f of COPY_FIELDS) if (template[f] !== undefined && template[f] !== null) spool[f] = template[f];
  spool.weight_used = 0;
  return spool;
}

async function addSpools(spool, quantity) {
  if (quantity > 1) await api("api/inventory/spools/bulk", { method: "POST", body: JSON.stringify({ spool, quantity }) });
  else await api("api/inventory/spools", { method: "POST", body: JSON.stringify(spool) });
}

function askConfirm(title, html, yesLabel = "Bestätigen", danger = false) {
  // Eigenes Bestätigungsfenster; liefert true bei „Bestätigen“.
  const dlg = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmBody").innerHTML = html;
  const yes = $("#confirmYes");
  yes.textContent = yesLabel;
  yes.className = danger ? "danger" : "primary";
  return new Promise((resolve) => {
    // Direkt auf die Knöpfe reagieren statt auf „close“, das kommt in manchen Browsern verzögert.
    const done = (answer) => {
      dlg.removeEventListener("click", onClick);
      dlg.removeEventListener("cancel", onCancel);
      resolve(answer);
    };
    const onClick = (ev) => {
      const b = ev.target.closest("button");
      if (b) done(b.value === "yes");
    };
    const onCancel = () => done(false);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("cancel", onCancel);
    dlg.showModal();
  });
}

function sortLine(f, qty) {
  const sw = /^[0-9a-f]{6}/i.test(f.rgba || "") ? `<span class="swatch" style="background:#${f.rgba.slice(0, 6)}"></span>` : "";
  return `<div class="confirmLine">${sw}<span><b>${qty}×</b> ${esc(f.brand || "")} ${esc([f.material, f.subtype].filter(Boolean).join(" "))} <b>${esc(f.color_name || "")}</b></span></div>`;
}

async function confirmBooking(f, qty, extra = "") {
  return askConfirm("Einbuchen bestätigen", sortLine(f, qty) + `<p class="confirmNote">${qty === 1 ? "Eine volle Rolle wird" : qty + " volle Rollen werden"} ins Lager gebucht.${extra}</p>`, "Einbuchen");
}

async function plusOne(g) {
  if (!(await confirmBooking(g.template, 1))) return;
  await addSpools(spoolFrom(g.template), 1);
  toast(`+1 Rolle ${g.color_name} ${g.material}`);
}

function removableSpool(g) {
  // Nur Rollen im Regal: zuerst unbenutzte ohne Chip, dann angebrochene ohne Chip, dann mit Chip.
  const shelf = g.spools.filter((s) => !state.inPrinter?.has(s.id));
  const score = (s) => (s.tag_uid || s.tray_uuid ? 2 : 0) + ((s.weight_used || 0) >= 1 ? 1 : 0);
  return shelf.sort((a, b) => score(a) - score(b) || b.id - a.id)[0];
}

async function minusOne(g) {
  const spool = removableSpool(g);
  if (!spool) return toast("Keine Rolle im Lager zum Ausbuchen, alle stecken im Drucker");
  const used = (spool.weight_used || 0) >= 1 ? ` Die Rolle ist angebrochen (${kg(remaining(spool))} übrig).` : "";
  const chip = spool.tag_uid || spool.tray_uuid ? " Die Rolle hat einen Chip." : "";
  const ok = await askConfirm("Ausbuchen bestätigen", sortLine(g.template, 1) +
    `<p class="confirmNote">Eine Rolle wird aus dem Lager genommen.${used}${chip} Sie wird in Bambuddy archiviert und lässt sich dort wiederherstellen.</p>`, "Ausbuchen", true);
  if (!ok) return;
  await api(`api/inventory/spools/${spool.id}/archive`, { method: "POST" });
  toast(`−1 Rolle ${g.color_name} ${g.material}`);
}

async function setCartQty(fields, qty, existing) {
  // Bambuddy kann die Menge eines Eintrags nicht ändern, deshalb wird er neu angelegt.
  if (existing) await api(`api/inventory/shopping-list/${existing.id}`, { method: "DELETE" });
  if (qty > 0) {
    await api("api/inventory/shopping-list", {
      method: "POST",
      body: JSON.stringify({ material: fields.material, subtype: fields.subtype || null, brand: fields.brand || null, color_name: fields.color_name || null, quantity_spools: qty, note: existing?.note || null }),
    });
    if (existing && existing.status !== "pending") {
      const fresh = await api("api/inventory/shopping-list");
      const item = fresh.filter((i) => i.status === "pending").pop();
      if (item) await api(`api/inventory/shopping-list/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: existing.status }) });
    }
  }
}

async function addToCart(g) {
  const existing = cartFor(g);
  const brand = g.brand === "Ohne Hersteller" ? "" : g.brand;
  await setCartQty({ ...g, brand }, (existing?.quantity_spools || 0) + 1, existing);
  toast(`${g.color_name} ${g.material} auf der Einkaufsliste`);
}

async function receive(item) {
  const st = stockFor(item);
  const spool = st.match ? spoolFrom(st.match.template) : { material: item.material, subtype: item.subtype, brand: item.brand, color_name: item.color_name, label_weight: 1000, weight_used: 0 };
  if (!(await confirmBooking(spool, item.quantity_spools || 1, " Der Eintrag auf der Einkaufsliste wird als eingetroffen markiert."))) return;
  await addSpools(spool, item.quantity_spools || 1);
  await api(`api/inventory/shopping-list/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "received" }) });
  toast(`${item.quantity_spools}× ${item.color_name || item.material} ins Lager gebucht`);
}

async function run(fn) {
  try {
    await fn();
  } catch (e) {
    toast("Fehler: " + e.message);
  }
  await load(true);
}

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button");
  if (!btn) return;
  if (btn.classList.contains("tab")) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    for (const name of ["stock", "shop", "usage", "brands", "places", "users"]) $("#tab-" + name).classList.toggle("hidden", btn.dataset.tab !== name);
    if (btn.dataset.tab === "users") loadUsers();
    try { localStorage.setItem("tab", btn.dataset.tab); } catch { /* egal */ }
    return;
  }
  const act = btn.dataset.act;
  if (!act) return;
  const g = btn.dataset.key ? state.groups.find((x) => x.key === btn.dataset.key) : null;
  const item = btn.dataset.id ? state.shop.find((x) => String(x.id) === btn.dataset.id) : null;
  btn.disabled = true;
  if (act === "plus" && g) run(() => plusOne(g));
  else if (act === "minus" && g) run(() => minusOne(g));
  else if (act === "cart" && g) run(() => addToCart(g));
  else if (act === "load" && g) { btn.disabled = false; openLoad({ group: g }); }
  else if (act === "rolls" && g) { btn.disabled = false; openRolls(g); }
  else if (act === "place") { btn.disabled = false; if (can(EDIT)) openPlace(parseInt(btn.dataset.place, 10)); }
  else if (act === "brand") { btn.disabled = false; if (can(EDIT)) openBrand(btn.dataset.brand); }
  else if (act === "level") btn.disabled = false;
  else if (act === "resolve") {
    const stockId = parseInt(document.querySelector(`select[data-chip="${btn.dataset.chip}"]`).value, 10);
    run(() => api("reconcile", { method: "POST", body: JSON.stringify({ chip_id: parseInt(btn.dataset.chip, 10), stock_id: stockId }) }));
  }
  else if (act === "keep") run(() => api("reconcile", { method: "POST", body: JSON.stringify({ chip_id: parseInt(btn.dataset.chip, 10), keep: true }) }));
  else if (item && act === "ordered") run(() => api(`api/inventory/shopping-list/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "purchased" }) }));
  else if (item && act === "receive") run(() => receive(item));
  else if (item && act === "qty+") run(() => setCartQty(item, item.quantity_spools + 1, item));
  else if (item && act === "qty-") run(() => setCartQty(item, item.quantity_spools - 1, item));
  else if (item && act === "remove") run(() => api(`api/inventory/shopping-list/${item.id}`, { method: "DELETE" }));
  else btn.disabled = false;
});

$("#search").addEventListener("input", (e) => {
  state.filter.text = e.target.value;
  renderStock();
});

$("#clearDone").addEventListener("click", () => run(async () => {
  for (const i of state.shop.filter((x) => x.status === "received")) {
    await api(`api/inventory/shopping-list/${i.id}`, { method: "DELETE" });
  }
}));

// Neues Material
$("#addNew").addEventListener("click", () => {
  $("#newForm").reset();
  fillLocations($("#newForm").location, `<option value="">— kein Lagerplatz —</option>`);
  $("#newForm").color.dataset.touched = "";
  $("#dupHint").classList.add("hidden");
  $("#newError").textContent = "";
  $("#newDialog").showModal();
});

// Schreibweisen vereinheitlichen: "bambu lab " wird zu dem schon vorhandenen "Bambu Lab".
const squash = (s) => norm(s).replace(/[^a-z0-9äöüß]/g, "");

function canonical(value, field) {
  const v = (value || "").trim().replace(/\s+/g, " ");
  if (!v) return v;
  const hit = state.spools.find((s) => squash(s[field]) === squash(v));
  return hit ? hit[field] : v;
}

function hexDistance(a, b) {
  const p = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  if (!/^[0-9a-f]{6}/i.test(a || "") || !/^[0-9a-f]{6}/i.test(b || "")) return 999;
  const [x, y] = [p(a), p(b)];
  return Math.sqrt(x.reduce((n, v, i) => n + (v - y[i]) ** 2, 0));
}

function readNewForm() {
  const f = new FormData($("#newForm"));
  return {
    brand: canonical(f.get("brand"), "brand"),
    material: canonical(f.get("material"), "material"),
    subtype: canonical(f.get("subtype"), "subtype") || null,
    color_name: canonical(f.get("color_name"), "color_name"),
    // Ohne gewählte Farbe kein Grau speichern, sonst sieht die Rolle fälschlich grau aus.
    rgba: $("#newForm").color.dataset.touched === "1" ? f.get("color").slice(1).toUpperCase() + "FF" : null,
    label_weight: parseInt(f.get("label_weight"), 10) || 1000,
    weight_used: 0,
    ...(f.get("cost_per_kg") ? { cost_per_kg: Math.max(0, parseFloat(String(f.get("cost_per_kg")).replace(",", ".")) || 0) } : {}),
    ...chosenLocation(),
  };
}

function chosenLocation() {
  const id = parseInt($("#newForm").location.value, 10);
  return id ? { location_id: id, storage_location: state.locations?.get(id) || null } : {};
}

function sameSort(g, s) {
  return squash(g.brand) === squash(s.brand) && squash(g.material) === squash(s.material)
    && squash(g.subtype) === squash(s.subtype) && squash(g.color_name) === squash(s.color_name);
}

function similarSorts(s) {
  // Gleiche Sorte oder sehr ähnliche: gleicher Hersteller und Material, dazu gleicher Farbname oder fast gleiche Farbe.
  if (!s.brand || !s.material) return [];
  return state.groups.filter((g) => {
    const brandMatch = squash(g.brand).startsWith(squash(s.brand)) || squash(s.brand).startsWith(squash(g.brand));
    if (!brandMatch || squash(g.material) !== squash(s.material)) return false;
    if (sameSort(g, s)) return true;
    const nameMatch = s.color_name && (squash(g.color_name) === squash(s.color_name));
    const colorMatch = s.color_touched && hexDistance(g.rgba, s.rgba) < 40;
    return nameMatch || colorMatch;
  }).slice(0, 4);
}

function updateDupHint() {
  const s = readNewForm();
  s.color_touched = $("#newForm").color.dataset.touched === "1";
  const hits = similarSorts(s);
  const box = $("#dupHint");
  if (!hits.length) return box.classList.add("hidden");
  const exact = hits.find((g) => sameSort(g, s));
  box.innerHTML = `<b>${exact ? "Diese Sorte gibt es schon:" : "Ähnliche Sorte im Lager, meinst du die?"}</b>` + hits.map((g) =>
    `<div class="dupRow"><span class="swatch" style="background:${color(g)}"></span>
      <span class="grow">${esc(g.brand)} ${esc([g.material, g.subtype].filter(Boolean).join(" "))} <b style="color:inherit">${esc(g.color_name)}</b> · ${g.spools.length} ${g.spools.length === 1 ? "Rolle" : "Rollen"}</span>
      <button type="button" class="primary" data-dup="${esc(g.key)}">Hierzu buchen</button></div>`).join("");
  box.classList.remove("hidden");
}

async function bookToGroup(g) {
  const qty = Math.min(100, Math.max(1, parseInt($("#newForm").quantity.value, 10) || 1));
  if (!(await confirmBooking(g.template, qty, " Die Sorte gibt es schon, die Rollen kommen dazu."))) return;
  await addSpools({ ...spoolFrom(g.template), ...chosenLocation() }, qty);
  $("#newDialog").close();
  toast(`${qty}× zu ${g.color_name} ${g.material} gebucht`);
  await load(true);
}

$("#newForm").addEventListener("input", (ev) => {
  if (ev.target.name === "color") ev.target.dataset.touched = "1";
  updateDupHint();
});

$("#dupHint").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-dup]");
  const g = btn && state.groups.find((x) => x.key === btn.dataset.dup);
  if (g) bookToGroup(g).catch((e) => { $("#newError").textContent = "Konnte nicht speichern: " + e.message; });
});

$("#newForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const spool = readNewForm();
  const qty = Math.min(100, Math.max(1, parseInt($("#newForm").quantity.value, 10) || 1));
  try {
    // Gibt es die Sorte schon (nur anders geschrieben), wird zur bestehenden gebucht statt doppelt angelegt.
    const exact = state.groups.find((g) => sameSort(g, spool));
    if (exact) return await bookToGroup(exact);
    if (!(await confirmBooking(spool, qty, " Es wird eine neue Sorte angelegt."))) return;
    await addSpools(spool, qty);
    $("#newDialog").close();
    toast(`${qty}× ${spool.color_name} ${spool.material} erfasst`);
    await load(true);
  } catch (e) {
    $("#newError").textContent = "Konnte nicht speichern: " + e.message;
  }
});

// Farbwähler und Hex-Feld gegenseitig abgleichen (in „Neues Material“ und „Sorte bearbeiten“).
for (const form of [$("#newForm"), $("#editForm")]) {
  const picker = form.color, hex = form.hex;
  picker.addEventListener("input", () => { hex.value = picker.value.toUpperCase(); hex.setCustomValidity(""); });
  hex.addEventListener("input", () => {
    const v = hex.value.trim().replace(/^#?/, "#");
    const ok = /^#[0-9a-f]{6}$/i.test(v);
    hex.setCustomValidity(ok || !hex.value.trim() ? "" : "Bitte 6-stelligen Hex-Code eingeben, z. B. #FF9016");
    if (!ok) return;
    picker.value = v.toLowerCase();
    picker.dataset.touched = "1";
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Sorte bearbeiten: Änderungen gelten für alle Rollen dieser Sorte.
let editGroup = null;

document.addEventListener("click", (ev) => {
  const top = ev.target.closest("[data-edit]");
  if (!top || !can(EDIT)) return;
  const g = state.groups.find((x) => x.key === top.dataset.edit);
  if (g) openEdit(g);
});

function fillLocations(select, first) {
  select.innerHTML = first + (state.locationList || []).map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
}

function openEdit(g) {
  editGroup = g;
  const f = $("#editForm");
  const t = g.template;
  f.reset();
  fillLocations(f.location, `<option value="">— nicht ändern —</option><option value="none">— kein Lagerplatz —</option>`);
  f.brand.value = t.brand || "";
  f.material.value = t.material || "";
  f.subtype.value = t.subtype || "";
  f.color_name.value = t.color_name || "";
  f.color.value = g.rgba ? "#" + g.rgba.slice(0, 6).toLowerCase() : "#808080";
  // Haben die Rollen unterschiedliche Farben, wird beim Speichern die angezeigte für alle gesetzt.
  f.color.dataset.touched = g.mixedColors ? "1" : "";
  f.hex.value = g.rgba ? "#" + g.rgba.slice(0, 6).toUpperCase() : "";
  f.label_weight.value = t.label_weight || 1000;
  f.core_weight.value = t.core_weight ?? 250;
  f.cost_per_kg.value = t.cost_per_kg ?? "";
  const missing = missingFields(g);
  $("#editInfo").textContent = (g.spools.length === 1 ? "Gilt für die eine Rolle dieser Sorte." : `Gilt für alle ${g.spools.length} Rollen dieser Sorte.`) + (missing.length ? ` Es fehlt: ${missing.join(", ")}.` : "");
  $("#editError").textContent = "";
  $("#editDialog").showModal();
}

$("#editForm").color.addEventListener("input", (ev) => { ev.target.dataset.touched = "1"; });

$("#editForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const f = ev.target;
  const t = editGroup.template;
  const next = {
    brand: canonical(f.brand.value, "brand"),
    material: canonical(f.material.value, "material"),
    subtype: canonical(f.subtype.value, "subtype") || null,
    color_name: canonical(f.color_name.value, "color_name") || null,
    label_weight: parseInt(f.label_weight.value, 10) || t.label_weight || 1000,
    core_weight: f.core_weight.value === "" ? t.core_weight ?? 250 : Math.max(0, parseInt(f.core_weight.value, 10) || 0),
    cost_per_kg: f.cost_per_kg.value === "" ? null : Math.max(0, parseFloat(f.cost_per_kg.value.replace(",", ".")) || 0),
  };
  if (f.color.dataset.touched === "1") next.rgba = f.color.value.slice(1).toUpperCase() + "FF";
  const labels = { brand: "Hersteller", material: "Material", subtype: "Typ", color_name: "Farbname", label_weight: "Gewicht", rgba: "Farbe", core_weight: "Leergewicht Spule", cost_per_kg: "Preis pro kg" };
  const changes = Object.keys(next).filter((k) => k === "rgba"
    ? editGroup.mixedColors || (editGroup.rgba || "").slice(0, 6).toUpperCase() !== next.rgba.slice(0, 6)
    : (next[k] ?? "") !== (t[k] ?? ""));
  const loc = f.location.value;
  const shelfIds = editGroup.spools.filter((s) => !state.inPrinter?.has(s.id)).map((s) => s.id);
  if (!changes.length && (!loc || !shelfIds.length)) return $("#editDialog").close();
  const update = Object.fromEntries(changes.map((k) => [k, next[k]]));
  const show = (k, v, old) => (k === "rgba" && v ? (old && editGroup.mixedColors ? "verschieden je Rolle" : "#" + v.slice(0, 6).toUpperCase()) : v);
  let rows = changes.map((k) => `<div>${labels[k]}: <s class="muted">${esc(show(k, t[k], true) || "–")}</s> → <b>${esc(show(k, next[k]) || "–")}</b></div>`).join("");
  const locName = loc === "none" ? "kein Lagerplatz" : state.locations?.get(parseInt(loc, 10));
  if (loc && shelfIds.length) rows += `<div>Lagerplatz: → <b>${esc(locName)}</b> (${shelfIds.length} ${shelfIds.length === 1 ? "Rolle" : "Rollen"} im Lager)</div>`;
  const ok = await askConfirm("Änderung bestätigen", sortLine(t, editGroup.spools.length) + `<div class="confirmNote">${rows}</div>`, "Speichern");
  if (!ok) return;
  try {
    if (changes.length) await api("api/inventory/spools/bulk-update", { method: "POST", body: JSON.stringify({ ids: editGroup.spools.map((s) => s.id), update }) });
    if (loc && shelfIds.length) {
      const locUpdate = loc === "none" ? { location_id: null, storage_location: null } : { location_id: parseInt(loc, 10), storage_location: locName };
      await api("api/inventory/spools/bulk-update", { method: "POST", body: JSON.stringify({ ids: shelfIds, update: locUpdate }) });
    }
    $("#editDialog").close();
    toast("Sorte aktualisiert");
    await load(true);
  } catch (e) {
    $("#editError").textContent = "Konnte nicht speichern: " + e.message;
  }
});

// ---------- Verbrauch: wann wurde wie viel von welcher Rolle abgebucht ----------

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return isNaN(d) ? "" : d.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function usageEntries() {
  const days = parseInt($("#usagePeriod").value, 10) || 0;
  const since = days ? Date.now() - days * 86400000 : 0;
  const words = norm($("#usageSearch").value).split(/\s+/).filter(Boolean);
  return (state.usageList || []).map((u) => ({ ...u, spool: state.allSpools?.get(u.spool_id) || null }))
    .filter((u) => {
      const t = new Date(/Z|[+-]\d\d:?\d\d$/.test(u.created_at || "") ? u.created_at : (u.created_at || "") + "Z").getTime();
      if (since && !(t >= since)) return false;
      const hay = norm([u.spool ? rollName(u.spool) : "", u.print_name, "rolle " + u.spool_id].join(" "));
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

function renderUsage() {
  const list = usageEntries();
  const grams = list.reduce((n, u) => n + (u.weight_used || 0), 0);
  const cost = list.reduce((n, u) => n + (u.cost || 0), 0);
  const prints = usageJobs(list).length;
  $("#usageSummary").innerHTML = `
    <div class="stat"><b>${kg(grams)}</b><span class="muted">verbraucht</span></div>
    <div class="stat"><b>${list.length}</b><span class="muted">Abbuchungen</span></div>
    <div class="stat"><b>${prints}</b><span class="muted">Drucke</span></div>
    ${cost ? `<div class="stat"><b>${money(cost)}</b><span class="muted">Materialkosten</span></div>` : ""}`;

  // Verbrauch je Sorte, größter zuerst.
  const bySort = new Map();
  for (const u of list) {
    const s = u.spool || {};
    const k = groupKey(s);
    const e = bySort.get(k) || { s, grams: 0 };
    e.grams += u.weight_used || 0;
    bySort.set(k, e);
  }
  const sorts = [...bySort.values()].sort((a, b) => b.grams - a.grams).slice(0, 10);
  const max = sorts[0]?.grams || 1;
  $("#usageBySort").innerHTML = sorts.length ? `<h3 class="usageHead">Nach Sorte</h3>` + sorts.map((e) => `<div class="sortRow">${dot(e.s.rgba)}
      <span class="sortName">${esc(e.s.color_name || "Unbekannte Rolle")} <span class="muted">${esc([e.s.brand, e.s.material, e.s.subtype].filter(Boolean).join(" "))}</span></span>
      <span class="sortBar"><span style="width:${Math.max(2, Math.round(e.grams / max * 100))}%;background:${/^[0-9a-f]{6}/i.test(e.s.rgba || "") ? "#" + e.s.rgba.slice(0, 6) : "var(--accent)"}"></span></span>
      <b class="sortGrams">${kg(e.grams)}</b></div>`).join("") : "";

  const printerName = (id) => ((state.printers || []).length > 1 ? (state.printers.find((p) => p.id === id)?.name || "") : "");
  const jobs = usageJobs(list);
  $("#usageList").innerHTML = jobs.length ? jobs.map((j) => {
    const status = j.status && j.status !== "completed" ? ` <span class="missing">(${j.status === "failed" ? "abgebrochen" : esc(j.status)})</span>` : "";
    const cost = j.items.reduce((n, u) => n + (u.cost || 0), 0);
    const grams = j.items.reduce((n, u) => n + (u.weight_used || 0), 0);
    return `<div class="jobCard">
      <div class="jobHead"><b>${esc(j.print_name || "Druck")}</b>${status}
        <span class="muted">${fmtDateTime(j.created_at)}${printerName(j.printer_id) ? " · " + esc(printerName(j.printer_id)) : ""}</span>
        <span class="jobTotal"><b>−${Math.round(grams)} g</b>${cost ? ` <span class="muted">${money(cost)}</span>` : ""}</span>
        <button type="button" class="need-edit jobEdit" data-act="editJob" data-job="${esc(j.key)}" title="Abbuchung korrigieren">${ic("edit")} Korrigieren</button></div>
      <div class="jobRows">
        <div class="jobRow jobLabels muted"><span></span><span>Rolle</span><span>vorher</span><span>abgebucht</span><span>danach</span></div>
        ${j.items.map((u) => {
          const s = u.spool;
          return `<div class="jobRow">${dot(s?.rgba)}
            <span class="usageRoll"><b>${esc(s?.color_name || "Unbekannte Rolle")}</b> <span class="muted">${esc(s ? [s.brand, s.material, s.subtype].filter(Boolean).join(" ") : "")} · Rolle ${u.spool_id}${s?.archived_at ? " · ausgebucht" : ""}</span></span>
            <span class="num">${u.before == null ? "–" : Math.round(u.before) + " g"}</span>
            <span class="num minus" title="${u.edited ? (u.manual ? "von Hand nachgetragen" : `korrigiert, Bambuddy hatte ${Math.round(u.original)} g`) : ""}">−${Math.round(u.weight_used)} g${u.edited ? " " + ic("edit") : ""}</span>
            <span class="num"><b>${u.after == null ? "–" : Math.round(u.after) + " g"}</b></span></div>`;
        }).join("")}
      </div></div>`;
  }).join("") : `<div class="emptyState">${(state.usageList || []).length ? "In diesem Zeitraum wurde nichts abgebucht." : "Noch kein Verbrauch erfasst. Bambuddy bucht nach jedem fertigen Druck ab."}</div>`;
}

// Bambuddy speichert pro Abbuchung nur die Gramm. Den Stand davor und danach rechnen wir vom heutigen
// Restgewicht der Rolle rückwärts: danach = Rest heute + alles, was später abgebucht wurde.
function rollHistory() {
  const map = new Map();
  const sorted = [...(state.usageList || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || String(b.id).localeCompare(String(a.id), "de", { numeric: true }));
  const running = new Map();
  for (const u of sorted) {
    const s = state.allSpools?.get(u.spool_id);
    if (!s) continue;
    const after = running.has(u.spool_id) ? running.get(u.spool_id) : remaining(s);
    const before = after + (u.weight_used || 0);
    running.set(u.spool_id, before);
    map.set(u.id, { before, after });
  }
  return map;
}

function usageJobs(list) {
  // Einträge desselben Drucks (gleicher Name, Drucker und Zeitpunkt auf die Minute) zusammenfassen.
  const hist = rollHistory();
  const jobs = new Map();
  for (const u of list) {
    const key = jobKey(u);
    if (!jobs.has(key)) jobs.set(key, { key, print_name: u.print_name, printer_id: u.printer_id, created_at: u.created_at, status: u.status, items: [] });
    const h = hist.get(u.id) || {};
    jobs.get(key).items.push({ ...u, before: h.before, after: h.after });
  }
  state.jobs = jobs;
  return [...jobs.values()];
}

const jobKey = (u) => [u.print_name || "", u.printer_id ?? "", (u.created_at || "").slice(0, 16)].join("|");

// Korrekturen aus dem Filament-Lager über die Bambuddy-Abbuchungen legen.
function costOf(spoolId, grams, orig) {
  const s = state.allSpools?.get(spoolId);
  if (s?.cost_per_kg) return grams / 1000 * s.cost_per_kg;
  return orig && orig.weight_used ? (orig.cost || 0) * grams / orig.weight_used : 0;
}

function mergeUsage(raw, edits) {
  const list = raw.map((u) => {
    const fixed = edits.edits?.[String(u.id)];
    return fixed == null ? { ...u, original: u.weight_used }
      : { ...u, original: u.weight_used, weight_used: fixed, cost: costOf(u.spool_id, fixed, u), edited: true };
  });
  for (const m of edits.manual || []) {
    list.push({ id: m.id, spool_id: m.spool_id, weight_used: m.grams, print_name: m.print_name, printer_id: m.printer_id,
      created_at: m.created_at, status: m.status, cost: costOf(m.spool_id, m.grams), manual: true, edited: true });
  }
  return list;
}

$("#usagePeriod").addEventListener("change", renderUsage);
$("#usageSearch").addEventListener("input", renderUsage);

// ---------- Abbuchung eines Drucks korrigieren ----------

let editJob = null;

function openJobEdit(job) {
  editJob = job;
  $("#jobTitle").textContent = `${job.print_name || "Druck"} · ${fmtDateTime(job.created_at)}`;
  $("#jobRows").innerHTML = job.items.map((u, i) => `<div class="jobEditRow">${dot(u.spool?.rgba)}
      <span class="grow">${esc(u.spool ? rollName(u.spool) : "Unbekannte Rolle")} · Rolle ${u.spool_id}${u.edited && !u.manual ? `<div class="muted">Bambuddy: ${Math.round(u.original)} g</div>` : ""}${u.manual ? `<div class="muted">von Hand nachgetragen</div>` : ""}</span>
      <label class="narrow">Gramm<input type="number" min="0" max="5000" step="0.1" data-item="${i}" value="${Math.round(u.weight_used * 10) / 10}"></label></div>`).join("");
  const used = new Set(job.items.map((u) => u.spool_id));
  const rolls = preferredRoll(state.spools.filter((s) => !used.has(s.id)));
  $("#jobForm").addRoll.innerHTML = `<option value="">— keine —</option>` + rolls.map(rollOption).join("");
  $("#jobForm").addGrams.value = "";
  $("#jobError").textContent = "";
  $("#jobDialog").showModal();
}

$("#jobForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const f = ev.target;
  const changes = [];
  f.querySelectorAll("input[data-item]").forEach((inp) => {
    const u = editJob.items[parseInt(inp.dataset.item, 10)];
    const grams = parseFloat(String(inp.value).replace(",", "."));
    if (!(grams >= 0) || Math.abs(grams - u.weight_used) < 0.05) return;
    changes.push({ u, grams, body: u.manual ? { manual_id: u.id, grams } : { usage_id: u.id, spool_id: u.spool_id, grams } });
  });
  const addId = parseInt(f.addRoll.value, 10);
  const addGrams = parseFloat(String(f.addGrams.value).replace(",", "."));
  if (addId && addGrams > 0) {
    const s = state.spools.find((x) => x.id === addId);
    changes.push({ u: { spool: s, spool_id: addId, weight_used: 0 }, grams: addGrams,
      body: { spool_id: addId, grams: addGrams, job: { print_name: editJob.print_name, printer_id: editJob.printer_id, created_at: editJob.created_at, status: editJob.status } } });
  }
  if (!changes.length) return $("#jobDialog").close();
  const rows = changes.map(({ u, grams }) => {
    const diff = grams - u.weight_used;
    return `<div class="confirmLine">${dot(u.spool?.rgba)}<span><b>${esc(u.spool ? rollName(u.spool) : "Rolle " + u.spool_id)}</b> · ${Math.round(u.weight_used)} g → <b>${Math.round(grams)} g</b>
      <span class="muted">(${diff > 0 ? "Rolle −" + Math.round(diff) + " g" : "Rolle +" + Math.round(-diff) + " g zurück"})</span></span></div>`;
  }).join("");
  const ok = await askConfirm("Abbuchung korrigieren", rows + `<p class="confirmNote">Die Differenz wird direkt bei der Rolle verbucht, damit der Lagerbestand stimmt. Die neue Summe des Drucks geht auch ins Bambuddy-Archiv, falls der Druck dort noch gespeichert ist.</p>`, "Speichern");
  if (!ok) return;
  // Neue Summe des Drucks fürs Bambuddy-Archiv: korrigierte und unveränderte Rollen plus nachgetragene.
  const final = new Map(editJob.items.map((u) => [u, u.weight_used]));
  for (const c of changes) final.set(c.u, c.grams);
  let total = 0, cost = 0;
  for (const [u, grams] of final) {
    total += grams;
    cost += costOf(u.spool_id, grams, u);
  }
  const job = { print_name: editJob.print_name, printer_id: editJob.printer_id, created_at: editJob.created_at };
  try {
    for (const c of changes) await api("usage-edits", { method: "POST", body: JSON.stringify(c.body) });
    $("#jobDialog").close();
    // Das Archiv ist nur eine Ergänzung: Fehlt der Druck dort, gibt es einen Hinweis statt eines Fehlers.
    let sync;
    try {
      sync = await api("archive-sync", { method: "POST", body: JSON.stringify({ job, grams: total, cost: cost > 0 ? cost : null }) });
    } catch (e) {
      sync = { status: "failed", message: "Bambuddy-Archiv nicht aktualisiert" };
    }
    toast(sync.status === "ok" ? "Abbuchung korrigiert, auch im Bambuddy-Archiv" : "Rolle korrigiert. " + sync.message, sync.status === "ok" ? 2600 : 6000);
    await load(true);
  } catch (e) {
    $("#jobError").textContent = "Konnte nicht speichern: " + e.message;
    await load(true);
  }
});

// ---------- Drucker: Rollen einlegen, herausnehmen, nicht zugeordnete Plätze ----------

function allSlots() {
  return (state.printers || []).flatMap((p) => p.slots.map((x) => ({ ...x, printerName: p.name, connected: p.connected })));
}

function assignmentAt(slot) {
  return (state.assignments || []).find((a) => a.printer_id === slot.printer_id && a.ams_id === slot.ams_id && a.tray_id === slot.tray_id);
}

function fullSlotLabel(slot) {
  return ((state.printers || []).length > 1 ? slot.printerName + " · " : "") + slot.name;
}

function rollName(s) {
  return [s.brand, s.material, s.subtype, s.color_name].filter(Boolean).join(" ");
}

function dot(rgba, size = 22) {
  const ok = /^[0-9a-f]{6}/i.test(rgba || "");
  return `<span class="swatch" style="width:${size}px;height:${size}px;background:${ok ? "#" + rgba.slice(0, 6) : "#999"}"></span>`;
}

function unassignedSlots() {
  // Belegt, ohne Chip und keiner Lager-Rolle zugeordnet: hier zieht Bambuddy keinen Verbrauch ab.
  return allSlots().filter((x) => x.connected && x.present && !x.chip && !assignmentAt(x));
}

function renderSlotBox() {
  const open = unassignedSlots();
  const box = $("#slotBox");
  if (!open.length || !can(VIEW)) return box.classList.add("hidden");
  box.innerHTML = `<h3>Rolle im Drucker ohne Zuordnung</h3>
    <p class="muted">Ohne Zuordnung wird der Verbrauch dieser Rollen nicht vom Lager abgezogen.</p>` +
    open.map((x) => `<div class="chipRow unclear">${dot(x.rgba)}<span><b>${esc(fullSlotLabel(x))}</b>${x.type ? " · " + esc(x.type) : ""}</span>
      <button class="primary need-add" data-act="assignSlot" data-slot="${x.printer_id}:${x.ams_id}:${x.tray_id}">Lager-Rolle zuordnen</button></div>`).join("");
  box.classList.remove("hidden");
}

let loadCtx = null;

function slotByKey(key) {
  return allSlots().find((x) => `${x.printer_id}:${x.ams_id}:${x.tray_id}` === key);
}

function slotOption(x) {
  const a = assignmentAt(x);
  const now = a ? `jetzt: ${rollName(a.spool || state.spools.find((s) => s.id === a.spool_id) || {})}` : x.present ? `belegt${x.chip ? " (Chip-Rolle)" : ""}${x.type ? ", " + x.type : ""}` : "leer";
  return `<option value="${x.printer_id}:${x.ams_id}:${x.tray_id}">${esc(fullSlotLabel(x))} (${esc(now)})${x.connected ? "" : " · offline"}</option>`;
}

function rollOption(s) {
  const where = state.slotOf?.has(s.id) ? " · im Drucker" : "";
  return `<option value="${s.id}">${esc(rollName(s))} · ${kg(remaining(s))}${(s.weight_used || 0) >= 1 ? " (angebrochen)" : ""}${hasChip(s) ? " · Chip" : ""}${where}</option>`;
}

function preferredRoll(list) {
  // Zuerst angebrochene Rollen aus dem Regal, dann volle; Chip-Rollen zuletzt, die ordnet Bambuddy selbst zu.
  const score = (s) => (state.inPrinter?.has(s.id) ? 4 : 0) + (hasChip(s) ? 2 : 0) + ((s.weight_used || 0) >= 1 ? 0 : 1);
  return [...list].sort((a, b) => score(a) - score(b) || a.id - b.id);
}

function openLoad({ group, spool, slot }) {
  const slots = allSlots();
  if (!slots.length) return toast("Keine Drucker in Bambuddy gefunden");
  let rolls;
  if (slot) {
    // Passende Rollen zuerst: gleiches Material, ähnliche Farbe.
    const type = norm(slot.type);
    const fit = (s) => (type && (type.includes(norm(s.material)) ? 0 : 200)) + hexDistance(s.rgba, slot.rgba);
    rolls = state.spools.filter((s) => !state.inPrinter?.has(s.id)).sort((a, b) => fit(a) - fit(b));
  } else {
    rolls = preferredRoll(spool ? [spool] : group.spools.filter((s) => !state.inPrinter?.has(s.id)));
  }
  if (!rolls.length) return toast("Keine Rolle im Lager zum Einlegen");
  loadCtx = { slot };
  const f = $("#loadForm");
  f.roll.innerHTML = rolls.map(rollOption).join("");
  // Freie Plätze zuerst anbieten.
  const order = (x) => (assignmentAt(x) ? 2 : x.present ? 1 : 0);
  f.slot.innerHTML = [...slots].sort((a, b) => order(a) - order(b)).map(slotOption).join("");
  if (slot) f.slot.value = `${slot.printer_id}:${slot.ams_id}:${slot.tray_id}`;
  f.roll.disabled = rolls.length === 1;
  $("#loadError").textContent = "";
  $("#loadDialog").showModal();
}

async function assignRoll(spool, slot) {
  const old = state.slotOf?.get(spool.id);
  if (old) await api(`api/inventory/assignments/${old.printer_id}/${old.ams_id}/${old.tray_id}`, { method: "DELETE" });
  await api("api/inventory/assignments", { method: "POST", body: JSON.stringify({ spool_id: spool.id, printer_id: slot.printer_id, ams_id: slot.ams_id, tray_id: slot.tray_id }) });
}

$("#loadForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const f = ev.target;
  const spool = state.spools.find((s) => String(s.id) === f.roll.value);
  const slot = slotByKey(f.slot.value);
  if (!spool || !slot) return;
  const current = assignmentAt(slot);
  const replaced = current && current.spool_id !== spool.id
    ? ` Dort ist bisher <b>${esc(rollName(current.spool || state.spools.find((s) => s.id === current.spool_id) || {}))}</b> eingetragen, diese Rolle kommt zurück ins Lager.` : "";
  const ok = await askConfirm("Einlegen bestätigen", `<div class="confirmLine">${dot(spool.rgba, 32)}<span><b>${esc(rollName(spool))}</b> · ${kg(remaining(spool))}</span></div>
    <p class="confirmNote">Die Rolle wird <b>${esc(fullSlotLabel(slot))}</b> zugeordnet. Ab jetzt zieht Bambuddy den Verbrauch jedes Drucks von dieser Rolle ab und stellt Material und Farbe am Drucker ein.${replaced}</p>`, "Einlegen");
  if (!ok) return;
  try {
    await assignRoll(spool, slot);
    $("#loadDialog").close();
    toast(`${spool.color_name || spool.material} in ${slot.name} eingelegt`);
    await load(true);
  } catch (e) {
    $("#loadError").textContent = "Konnte nicht zuordnen: " + e.message;
  }
});

async function unloadRoll(spool) {
  const a = state.slotOf?.get(spool.id);
  if (!a) return;
  const ok = await askConfirm("Herausnehmen bestätigen", `<div class="confirmLine">${dot(spool.rgba, 32)}<span><b>${esc(rollName(spool))}</b> · ${kg(remaining(spool))}</span></div>
    <p class="confirmNote">Die Rolle wird von <b>${esc(slotLabel(a))}</b> gelöst und zählt wieder als „im Lager“. Ihr Restgewicht bleibt erhalten.</p>`, "Herausnehmen");
  if (!ok) return;
  await api(`api/inventory/assignments/${a.printer_id}/${a.ams_id}/${a.tray_id}`, { method: "DELETE" });
  toast(`${spool.color_name || spool.material} herausgenommen`);
}

// ---------- Rollen einzeln: Restgewicht, Verbrauch, Platz ----------

let rollGroupKey = null;

function openRolls(g) {
  rollGroupKey = g.key;
  renderRolls();
  $("#rollDialog").showModal();
}

function rollCard(s) {
  const a = state.slotOf?.get(s.id);
  const where = a ? `${printerIcon(a.printer_id)} ${esc(slotLabel(a))}` : spoolPlace(s) ? `${placeIcon(spoolPlace(s))} ${esc(spoolPlace(s))}` : `${ic("pin")} im Lager, kein Lagerplatz`;
  const pct = s.label_weight ? Math.round(remaining(s) / s.label_weight * 100) : 0;
  const usage = (state.usage?.get(s.id) || []).slice(0, 5);
  const core = s.core_weight ?? 250;
  return `<div class="rollCard" data-roll="${s.id}">
    <div class="rollHead"><b>Rolle ${s.id}</b><span class="muted">${where}</span>${hasChip(s) ? `<span class="levelTag small">Chip</span>` : ""}</div>
    <div class="bar"><span style="width:${pct}%"></span></div>
    <div class="tileInfo"><span>Rest <b>${kg(remaining(s))}</b> von ${kg(s.label_weight || 0)}</span><span>${s.cost_per_kg ? money(rollValue(s)) : ""}</span></div>
    <div class="rollEdit need-edit">
      <label>Lagerplatz${a ? " (nach dem Herausnehmen)" : ""}<select data-place="${s.id}">${placeOptions(s)}</select></label>
    </div>
    <div class="rollEdit need-edit">
      <label>Restgewicht (g)<input type="number" min="0" step="1" data-rest="${s.id}" value="${Math.round(remaining(s))}"></label>
      <label>oder gewogen mit Spule (g)<input type="number" min="0" step="1" data-gross="${s.id}" placeholder="Spule ${core} g"></label>
      <button type="button" class="primary" data-act="saveWeight" data-roll="${s.id}">Speichern</button>
    </div>
    <div class="rollActions need-add">${a
      ? `<button type="button" data-act="unload" data-roll="${s.id}">Aus dem Drucker nehmen</button>`
      : `<button type="button" data-act="loadRoll" data-roll="${s.id}">In Drucker einlegen</button>`}</div>
    <div class="usage">${usage.length ? `<div class="muted">Letzte Drucke</div>` + usage.map((u) => `<div class="usageRow"><span>${fmtDate(u.created_at)}</span>
      <span class="grow">${esc(u.print_name || "Druck")}${u.status && u.status !== "completed" ? ` <span class="missing">(${u.status === "failed" ? "abgebrochen" : esc(u.status)})</span>` : ""}</span>
      <b>${Math.round(u.weight_used)} g</b>${u.cost ? `<span class="muted">${money(u.cost)}</span>` : ""}</div>`).join("")
      : `<div class="muted">Noch kein Verbrauch erfasst.</div>`}</div>
  </div>`;
}

function placeOptions(s) {
  const current = s.location_id || "";
  const opts = [`<option value="">— kein Lagerplatz —</option>`, ...(state.locationList || []).map((l) => `<option value="${l.id}">${esc(l.name)}</option>`)];
  // Alter Freitext-Lagerplatz ohne Bambuddy-Ort bleibt sichtbar, bis ein Ort gewählt wird.
  if (!current && s.storage_location) opts.splice(1, 0, `<option value="" selected>${esc(s.storage_location)}</option>`);
  return opts.join("").replace(`value="${current}">`, `value="${current}" selected>`);
}

async function savePlace(s, select) {
  const id = parseInt(select.value, 10) || null;
  const name = id ? state.locations?.get(id) : null;
  const ok = await askConfirm("Lagerplatz ändern", `<div class="confirmLine">${dot(s.rgba, 32)}<span><b>${esc(rollName(s))}</b> · Rolle ${s.id}</span></div>
    <p class="confirmNote">Lagerplatz: <s>${esc(spoolPlaceName(s) || "keiner")}</s> → <b>${esc(name || "kein Lagerplatz")}</b></p>`, "Speichern");
  if (!ok) {
    select.innerHTML = placeOptions(s);
    return;
  }
  await api(`api/inventory/spools/${s.id}`, { method: "PATCH", body: JSON.stringify({ location_id: id, storage_location: name }) });
  toast(`Lagerplatz ${name || "entfernt"}`);
}

function spoolPlaceName(s) {
  return (s.location_id && state.locations?.get(s.location_id)) || s.storage_location || "";
}

$("#rollList").addEventListener("change", (ev) => {
  const id = ev.target.dataset.place;
  const s = id && state.spools.find((x) => String(x.id) === id);
  if (s) run(() => savePlace(s, ev.target));
});

function renderRolls() {
  const g = state.groups.find((x) => x.key === rollGroupKey);
  if (!g) return $("#rollDialog").close();
  // Eingaben, die gerade getippt werden, nicht beim Auffrischen überschreiben.
  if ($("#rollList").contains(document.activeElement) && ["INPUT", "SELECT"].includes(document.activeElement.tagName)) return;
  $("#rollTitle").innerHTML = `${dot(g.rgba, 28)} ${esc(g.color_name || "Ohne Farbname")} <span class="muted">${esc([g.brand, g.material, g.subtype].filter(Boolean).join(" "))}</span>`;
  const list = [...g.spools].sort((a, b) => (state.inPrinter.has(b.id) - state.inPrinter.has(a.id)) || (b.weight_used || 0) - (a.weight_used || 0));
  $("#rollList").innerHTML = list.map(rollCard).join("");
}

$("#rollList").addEventListener("input", (ev) => {
  // Bruttogewicht von der Waage: Leergewicht der Spule abziehen und als Rest anzeigen.
  const id = ev.target.dataset.gross;
  if (!id) return;
  const s = state.spools.find((x) => String(x.id) === id);
  const gross = parseInt(ev.target.value, 10);
  if (s && gross >= 0) $(`input[data-rest="${id}"]`).value = Math.max(0, gross - (s.core_weight ?? 250));
});

async function saveWeight(s) {
  const rest = parseInt($(`input[data-rest="${s.id}"]`).value, 10);
  if (!(rest >= 0)) return toast("Bitte ein Restgewicht eingeben");
  const label = s.label_weight || 1000;
  const update = { weight_used: Math.max(0, label - rest) };
  let note = "";
  if (rest > label) {
    update.label_weight = rest;
    update.weight_used = 0;
    note = ` Das ist mehr als das Rollengewicht, deshalb wird das Rollengewicht dieser Rolle auf ${kg(rest)} gesetzt.`;
  }
  const ok = await askConfirm("Restgewicht ändern", `<div class="confirmLine">${dot(s.rgba, 32)}<span><b>${esc(rollName(s))}</b> · Rolle ${s.id}</span></div>
    <p class="confirmNote">Rest: <s>${kg(remaining(s))}</s> → <b>${kg(rest)}</b>.${note} Bambuddy gleicht diese Rolle danach nicht mehr mit der AMS-Anzeige ab, der Verbrauch aus Drucken wird weiter abgezogen.</p>`, "Speichern");
  if (!ok) return;
  await api(`api/inventory/spools/${s.id}`, { method: "PATCH", body: JSON.stringify(update) });
  toast(`Restgewicht ${kg(rest)} gespeichert`);
}

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const s = btn.dataset.roll && state.spools.find((x) => String(x.id) === btn.dataset.roll);
  if (act === "saveWeight" && s) run(() => saveWeight(s));
  else if (act === "unload" && s) run(() => unloadRoll(s));
  else if (act === "loadRoll" && s) openLoad({ spool: s });
  else if (act === "editJob") {
    const job = state.jobs?.get(btn.dataset.job);
    if (job) openJobEdit(job);
  }
  else if (act === "assignSlot") {
    const slot = slotByKey(btn.dataset.slot);
    if (slot) openLoad({ slot });
  }
});

// Hersteller-Logo
let currentBrand = null;
function openBrand(brand) {
  // Ohne Namen: neuen Hersteller anlegen.
  currentBrand = brand || null;
  $("#brandForm").reset();
  $("#brandTitle").classList.toggle("hidden", !brand);
  $("#brandNameField").classList.toggle("hidden", !!brand);
  $("#brandName").textContent = brand || "";
  $("#brandLogoPreview").innerHTML = brand ? logoHtml(brand, "big") : "";
  const entry = brand ? (state.brands || {})[brandKey(brand)] : null;
  $("#brandForm").website.value = (entry && entry.website) || "";
  $("#brandDialog").showModal();
}

$("#addBrand").addEventListener("click", () => openBrand(null));

// ---------- Lagerplätze: Icon wählen oder eigenes Bild ----------

function renderPlaces() {
  const list = [...(state.locationList || [])].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const count = (id) => state.spools.filter((s) => s.location_id === id && !state.inPrinter?.has(s.id)).length;
  $("#placeGrid").innerHTML = list.length ? list.map((l) => `
    <div class="brandCard">
      <span class="placeBig">${placeIconById(l.id, "big")}</span>
      <span class="brandCardName">${esc(l.name)}</span>
      <span class="muted">${count(l.id)} ${count(l.id) === 1 ? "Rolle" : "Rollen"}</span>
      <button class="need-edit" data-act="place" data-place="${l.id}">Icon ändern</button>
    </div>`).join("") : `<div class="emptyState">Noch keine Lagerplätze. Lege sie in Bambuddy unter Inventar → Lagerorte an.</div>`;
}

let currentPlace = null;

function openPlace(id) {
  const loc = (state.locationList || []).find((l) => l.id === id);
  if (!loc) return;
  currentPlace = loc;
  const set = (state.places || {})[String(id)] || {};
  const f = $("#placeForm");
  f.reset();
  $("#placeName").textContent = loc.name;
  $("#placeChoices").innerHTML = PLACE_ICONS.map(([key, label]) => `<label class="iconChoice">
      <input type="radio" name="icon" value="${key}"${(set.icon || "shelf") === key ? " checked" : ""}>${ic(key)}<span>${label}</span></label>`).join("");
  f.mdi.value = /^mdi:/.test(set.icon || "") ? set.icon : "";
  updateMdiPreview();
  $("#placeImagePreview").innerHTML = set.image ? placeIconById(id, "big") : "";
  $("#placeRemoveRow").classList.toggle("hidden", !set.image);
  $("#placeError").textContent = "";
  $("#placeDialog").showModal();
}

// MDI-Namen beim Tippen vorschlagen und das Icon gleich zeigen.
function updateMdiPreview() {
  const v = $("#placeForm").mdi.value.trim().toLowerCase().replace(/^(mdi:)?/, "mdi:");
  $("#mdiPreview").innerHTML = $("#placeForm").mdi.value.trim() ? iconHtml(v, "big") : "";
  $("#placeChoices").classList.toggle("dimmed", !!$("#placeForm").mdi.value.trim());
}

let mdiTimer = null;
$("#placeForm").mdi.addEventListener("input", () => {
  updateMdiPreview();
  clearTimeout(mdiTimer);
  mdiTimer = setTimeout(async () => {
    const names = await api("mdi-search?q=" + encodeURIComponent($("#placeForm").mdi.value)).catch(() => []);
    $("#mdiList").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
  }, 200);
});

$("#placeChoices").addEventListener("change", () => {
  $("#placeForm").mdi.value = "";
  updateMdiPreview();
});

$("#placeForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const f = ev.target;
  const id = currentPlace.id;
  const mdi = f.mdi.value.trim().toLowerCase().replace(/^(mdi:)?/, "mdi:");
  const icon = f.mdi.value.trim() ? mdi : f.icon.value === "shelf" ? "" : f.icon.value;
  const file = f.file.files[0];
  try {
    state.places = await api(`places/${id}`, { method: "PUT", body: JSON.stringify({ icon }) });
    if (file) state.places = await api(`place-image/${id}`, { method: "POST", body: file, headers: { "Content-Type": file.type || "image/png" } });
    else if (f.removeImage.checked) state.places = await api(`place-image/${id}`, { method: "DELETE" });
    $("#placeDialog").close();
    render();
    toast("Icon gespeichert");
  } catch (e) {
    $("#placeError").textContent = "Konnte nicht speichern: " + e.message;
  }
});

$("#brandForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const form = ev.target;
  const file = form.file.files[0];
  if (!currentBrand) {
    const name = form.brandname.value.trim().replace(/\s+/g, " ");
    if (!name) return toast("Bitte einen Namen eingeben");
    const existing = allBrands().find((b) => brandKey(b.name) === brandKey(name));
    currentBrand = existing ? existing.name : name;
  }
  try {
    await api(`brands/${encodeURIComponent(currentBrand)}`, { method: "PUT", body: JSON.stringify({ website: form.website.value, name: currentBrand }) });
    if (can(ADMIN) && form.removeLogo.checked && !file) await api(`logo/${encodeURIComponent(currentBrand)}`, { method: "DELETE" });
    if (can(ADMIN) && file) await api(`logo/${encodeURIComponent(currentBrand)}`, { method: "POST", body: file, headers: { "Content-Type": file.type || "image/png" } });
    state.logoVersion = Date.now();
    $("#brandDialog").close();
    state.brands = await api("brands").catch(() => state.brands);
    render();
    toast("Hersteller gespeichert");
  } catch (e) {
    toast("Fehler: " + e.message);
  }
});

// Benutzerverwaltung (nur Admin)
async function loadUsers() {
  if (!can(ADMIN)) return;
  try {
    const users = await api("users");
    users.sort((a, b) => b.level - a.level || (a.name || "").localeCompare(b.name || "", "de"));
    $("#userList").innerHTML = users.map((u) => `<div class="userRow">
      <div class="grow"><b>${esc(u.name || u.login || "?")}</b>${u.login ? ` <span class="muted">Benutzername: ${esc(u.login)}</span>` : ""}
        <div class="muted">${u.last_seen ? "zuletzt da: " + esc(u.last_seen.replace("T", " ")) : "hat die App noch nie geöffnet"}</div></div>
      <span class="levelTag">${LEVELS[u.level]}${u.listed ? "" : " <span class='muted'>(Standard)</span>"}</span>
    </div>`).join("") || `<div class="emptyState">Noch niemand.</div>`;
  } catch (e) {
    toast("Fehler: " + e.message);
  }
}

// Start: erst die eigenen Rechte holen, dann die Daten.
(async () => {
  state.me = await api("api/me").catch(() => ({ level: 0 }));
  if (state.me.theme) setTheme(state.me.theme);
  applyRights();
  try {
    const saved = JSON.parse(localStorage.getItem("filter") || "{}");
    // Früher war je Filter nur ein Wert gespeichert, jetzt eine Liste.
    for (const k of FILTER_KEYS) state.filter[k] = Array.isArray(saved[k]) ? saved[k] : saved[k] ? [saved[k]] : [];
    const tab = localStorage.getItem("tab");
    const btn = tab && document.querySelector(`.tab[data-tab="${tab}"]`);
    if (btn && (tab !== "users" || can(ADMIN))) btn.click();
  } catch { /* egal */ }
  load();
})();
setInterval(() => { if (!document.hidden) load(true); }, REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(true); });
