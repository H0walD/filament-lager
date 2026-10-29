"use strict";

// Alle Adressen sind relativ, damit die Seite hinter dem Home-Assistant-Ingress läuft.
const REFRESH_MS = 15000;
const LOW_GRAMS = 300;

const state = {
  spools: [],
  shop: [],
  groups: [],
  filter: { text: "", brand: [], material: [], color: [], place: [], weight: "" },
  logoVersion: Date.now(),
  loaded: false,
};

const $ = (sel) => document.querySelector(sel);

// Rechte-Stufen wie im Server: 0 kein Zugriff, 1 ansehen, 2 erfassen, 3 bearbeiten, 4 Admin.
// Rechte kommen pro Gruppe vom Server (siehe Reiter Benutzer); Admin darf alles.
const isAdmin = () => state.me?.group === "admin";
const has = (perm) => isAdmin() || (state.me?.perms || []).includes(perm);
const hasAny = () => isAdmin() || (state.me?.perms || []).length > 0;
const PERM_KEYS = ["tab_stock", "tab_shop", "tab_usage", "tab_brands", "tab_places", "tab_design", "shop_edit", "rolls_add",
  "rolls_remove", "rolls_edit", "sorts_edit", "printer", "usage_edit", "brands_edit", "places_edit"];

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
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13.5h10L18 7"/><path d="M10 11v6M14 11v6"/>',
  box: '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/>',
  drawer: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.5h17M3.5 15h17M10 6.5h4M10 12.2h4M10 17.8h4"/>',
  cabinet: '<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><path d="M12 2.5v19M9.5 11v2M14.5 11v2"/>',
  tiles: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  rows: '<rect x="3.5" y="4" width="17" height="4" rx="1.2"/><rect x="3.5" y="10" width="17" height="4" rx="1.2"/><rect x="3.5" y="16" width="17" height="4" rx="1.2"/>',
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

// Lager als Kacheln oder Liste, je Benutzer gespeichert wie das Design.
function setView(view, save) {
  state.view = view === "list" ? "list" : "tiles";
  document.querySelectorAll(".viewSwitch button").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  try { localStorage.setItem("view", state.view); } catch { /* egal */ }
  if (save) api("api/me", { method: "POST", body: JSON.stringify({ view: state.view }) }).catch(() => {});
  if (state.loaded) renderStock();
}

// ---------- Design: Schriftarten und -grössen je Benutzer ----------
// Schriften liegen in der App (www/fonts), sehen also auf jedem Gerät gleich aus; geladen wird nichts aus dem Internet.
const FONTS = {
  system: ["Standard des Geräts", 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  inter: ["Inter", '"Inter FL", system-ui, sans-serif'],
  roboto: ["Roboto", '"Roboto FL", system-ui, sans-serif'],
  "open-sans": ["Open Sans", '"Open Sans FL", system-ui, sans-serif'],
  "source-sans-3": ["Source Sans 3", '"Source Sans 3 FL", system-ui, sans-serif'],
  atkinson: ["Atkinson Hyperlegible (besonders gut lesbar)", '"Atkinson Hyperlegible Next FL", system-ui, sans-serif'],
  lexend: ["Lexend (ruhig, gut lesbar)", '"Lexend FL", system-ui, sans-serif'],
  nunito: ["Nunito (rundlich)", '"Nunito FL", system-ui, sans-serif'],
  comfortaa: ["Comfortaa (verspielt rund)", '"Comfortaa FL", system-ui, sans-serif'],
  montserrat: ["Montserrat (geometrisch)", '"Montserrat FL", system-ui, sans-serif'],
  oswald: ["Oswald (schmal, für Titel)", '"Oswald FL", "Arial Narrow", sans-serif'],
  merriweather: ["Merriweather (mit Serifen)", '"Merriweather FL", Georgia, serif'],
  "roboto-slab": ["Roboto Slab (Serifen, technisch)", '"Roboto Slab FL", Georgia, serif'],
  "jetbrains-mono": ["JetBrains Mono (Schreibmaschine)", '"JetBrains Mono FL", ui-monospace, monospace'],
};
const DESIGN_DEFAULT = { title_font: "system", text_font: "system", title_size: 100, text_size: 100, desc_size: 100 };

function applyDesign(design) {
  const d = { ...DESIGN_DEFAULT, ...(design || {}) };
  state.design = d;
  const vars = {
    "--font-text": (FONTS[d.text_font] || FONTS.system)[1],
    "--font-title": (FONTS[d.title_font] || FONTS.system)[1],
    "--fs-title": d.title_size / 100,
    "--fs-text": d.text_size / 100,
    "--fs-desc": d.desc_size / 100,
  };
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  try { localStorage.setItem("designVars", JSON.stringify(vars)); } catch { /* egal */ }
}

function fillDesignForm() {
  const f = $("#designForm");
  const opts = Object.entries(FONTS).map(([k, [label, stack]]) => `<option value="${k}" style="font-family:${esc(stack)}">${esc(label)}</option>`).join("");
  f.title_font.innerHTML = opts;
  f.text_font.innerHTML = opts;
  for (const [k, v] of Object.entries(state.design || DESIGN_DEFAULT)) if (f[k]) f[k].value = v;
  f.querySelectorAll(".designVal").forEach((el) => { el.textContent = f[el.dataset.for].value + " %"; });
}

let designTimer = null;
function saveDesign(design) {
  applyDesign(design);
  fillDesignForm();
  clearTimeout(designTimer);
  designTimer = setTimeout(() => api("api/me", { method: "POST", body: JSON.stringify({ design: state.design }) }).catch(() => toast("Design nicht gespeichert")), 400);
}

$("#designForm").addEventListener("input", () => {
  const f = $("#designForm");
  saveDesign({ title_font: f.title_font.value, text_font: f.text_font.value,
    title_size: +f.title_size.value, text_size: +f.text_size.value, desc_size: +f.desc_size.value });
});
$("#designReset").addEventListener("click", () => saveDesign(DESIGN_DEFAULT));

$("#viewTiles").innerHTML = ic("tiles");
$("#viewList").innerHTML = ic("rows");
document.querySelectorAll(".viewSwitch button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view, true)));

$("#themeBtn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));
setTheme(document.documentElement.dataset.theme);

function applyRights() {
  // Pro Recht eine Klasse am body; Elemente mit need-<recht> sind ohne dieses Recht ausgeblendet (style.css).
  for (const p of PERM_KEYS) document.body.classList.toggle("p-" + p, has(p));
  document.body.classList.toggle("is-admin", isAdmin());
  const blocked = !hasAny();
  $("main").querySelectorAll("section").forEach((s) => s.classList.toggle("blocked", blocked));
  $("#noAccess").classList.toggle("hidden", !blocked);
  $(".tabs").classList.toggle("hidden", blocked);
  $("#meInfo").textContent = state.me?.name && state.me.name !== "lokal" ? `${state.me.name} · ${state.me.group_name || ""}` : "";
  // Steht man auf einem Reiter, den man nicht mehr sehen darf, auf den ersten erlaubten wechseln.
  const active = document.querySelector(".tab.active");
  if (!blocked && active && getComputedStyle(active).display === "none") {
    [...document.querySelectorAll(".tab")].find((t) => getComputedStyle(t).display !== "none")?.click();
  }
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
  if (me?.view && me.view !== state.view) setView(me.view);
  if (me?.design && JSON.stringify({ ...DESIGN_DEFAULT, ...me.design }) !== JSON.stringify(state.design) && !$("#designForm").contains(document.activeElement)) {
    applyDesign(me.design);
    fillDesignForm();
  }
  if (me && (me.group !== state.me?.group || JSON.stringify(me.perms) !== JSON.stringify(state.me?.perms))) {
    state.me = me;
    applyRights();
  }
  if (!hasAny()) return;
  try {
    const [spools, shop, rec, slots, brands, locations, , rawUsage, printers, edits] = await Promise.all([api("api/inventory/spools?include_archived=true"),
      api("api/inventory/shopping-list"), api("reconcile").catch(() => null), api("api/inventory/assignments").catch(() => []),
      api("brands").catch(() => ({})), api("api/inventory/locations").catch(() => []),
      api("places").then((p) => { state.places = p || {}; }).catch(() => {}),
      api("api/inventory/usage?limit=500").catch(() => []), api("printers").catch(() => null),
      api("usage-edits").catch(() => null), api("shop-meta").then((m) => { state.shopMeta = m || {}; }).catch(() => {})]);
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
    loadUnbooked();
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
  return swatchBg(g.rgba, "#999999");
}

// Bambuddy speichert Farben als RRGGBBAA. Durchsichtige Farben liegen wie in Bambu Studio über einem Schachbrett,
// leicht abgeschwächt, damit auch ein klares Blau noch als Blau erkennbar ist.
function swatchBg(rgba, fallback = "#999") {
  if (!/^[0-9a-f]{6}/i.test(rgba || "")) return fallback;
  const alpha = /^[0-9a-f]{8}$/i.test(rgba) ? parseInt(rgba.slice(6, 8), 16) / 255 : 1;
  if (alpha >= 1) return "#" + rgba.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgba.slice(i, i + 2), 16));
  const c = `rgba(${r},${g},${b},${(0.35 + 0.6 * alpha).toFixed(2)})`;
  return `linear-gradient(${c},${c}),repeating-conic-gradient(#c8c8c8 0 25%,#f4f4f4 0 50%) 50% / 12px 12px`;
}

// Deckkraft-Auswahl im Formular: nächster Wert zu Bambuddys Alpha.
function alphaOption(rgba) {
  const a = /^[0-9a-f]{8}$/i.test(rgba || "") ? parseInt(rgba.slice(6, 8), 16) : 255;
  return a > 0xc0 ? "FF" : a > 0x40 ? "80" : "00";
}

const formRgba = (form) => form.color.value.slice(1).toUpperCase() + form.alpha.value;

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

// Filter Restmenge: Gramm, die von der Sorte insgesamt noch übrig sind (Lager und Drucker zusammen).
// "low" = knapp oder leer wie auf den Kacheln, "empty" = leer, sonst eine Zahl = höchstens so viele Gramm.
const WEIGHT_PRESETS = [["low", "Knapp oder leer"], ["empty", "Leer"], ["250", "bis 250 g"], ["500", "bis 500 g"], ["1000", "bis 1 kg"], ["2000", "bis 2 kg"]];

function weightMatches(g, w) {
  if (!w) return true;
  if (w === "low") return g.low || g.empty;
  if (w === "empty") return g.empty;
  const max = Number(w);
  return !(max >= 0) || g.remaining <= max;
}

function weightText(w) {
  if (!w) return "Alle Mengen";
  return WEIGHT_PRESETS.find(([v]) => v === w)?.[1] || `bis ${kg(Number(w))}`;
}

function matchesFilter(g) {
  // Innerhalb eines Filters reicht ein Treffer (oder), zwischen den Filtern muss alles passen (und).
  const f = state.filter;
  if (!weightMatches(g, f.weight)) return false;
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
  const dot = (rgba) => `<span class="swatch" style="background:${swatchBg(rgba)}"></span>`;
  const recent = (rec.merged || []).filter((m) => Date.now() / 1000 - m.time < 86400).reverse();
  const unclear = rec.unclear || [];
  if (!recent.length && !unclear.length) return $("#chipBox").classList.add("hidden");
  $("#chipBox").innerHTML = `<h3>Vom Drucker erkannt</h3>` +
    unclear.map((u) => `<div class="chipRow unclear">${dot(u.rgba)}<span>Chip-Rolle <b>${esc(u.chip)}</b> passt zu mehreren Sorten:</span>
      <select data-chip="${u.chip_id}">${u.options.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>
      <button class="primary need-printer" data-act="resolve" data-chip="${u.chip_id}">Zuordnen</button>
      <button class="need-printer" data-act="keep" data-chip="${u.chip_id}">Ist eine neue Rolle</button></div>`).join("") +
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
      <div class="brandActions">
        <button class="need-brands_edit" data-act="brand" data-brand="${esc(b.name)}">Bearbeiten</button>
        <button class="need-brands_edit danger" data-act="deleteBrand" data-brand="${esc(b.name)}" ${b.rolls ? `disabled title="Löschen geht erst, wenn keine Rolle mehr zugewiesen ist"` : `title="Hersteller löschen"`}>${ic("trash")}</button>
      </div>
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
  renderWeightFilter();
  $("#fReset").classList.toggle("hidden", !filterActive());
}

const filterActive = () => FILTER_KEYS.some((k) => state.filter[k].length) || !!state.filter.weight;

function renderWeightFilter() {
  const box = $("#fWeight");
  const w = state.filter.weight;
  box.classList.toggle("active", !!w);
  // Beim Tippen im eigenen Wert nicht neu zeichnen, sonst springt der Cursor raus (Auffrischen alle 15 s).
  if (box.contains(document.activeElement) && document.activeElement.dataset.wcustom != null) {
    box.querySelector(".msBtn").textContent = weightText(w);
    return;
  }
  const custom = w && !WEIGHT_PRESETS.some(([v]) => v === w) ? w : "";
  const radio = (v, label) => `<label><input type="radio" name="fWeight" data-weight value="${v}"${w === v ? " checked" : ""}>${esc(label)}</label>`;
  box.innerHTML = `<button type="button" class="msBtn" data-ms="weight">${esc(weightText(w))}</button>
    <div class="msMenu${openMenu === "weight" ? "" : " hidden"}">
      ${radio("", "Alle Mengen")}
      ${WEIGHT_PRESETS.map(([v, label]) => radio(v, label)).join("")}
      <label class="wCustom">bis <input type="number" min="0" step="50" inputmode="numeric" data-wcustom placeholder="z. B. 750" value="${esc(custom)}"> g</label>
    </div>`;
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
  if (ev.target.matches("input[data-weight]")) {
    state.filter.weight = ev.target.value;
    saveFilter();
    renderChips();
    renderStock();
    return;
  }
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

// Eigener Wert im Filter Restmenge: schon beim Tippen filtern, leer = alle Mengen.
$(".filters").addEventListener("input", (ev) => {
  if (!ev.target.matches("input[data-wcustom]")) return;
  const v = ev.target.value.trim();
  state.filter.weight = v !== "" && Number(v) >= 0 ? String(Math.round(Number(v))) : "";
  for (const r of document.querySelectorAll("input[data-weight]")) r.checked = r.value === state.filter.weight;
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
  state.filter.weight = "";
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
  const asList = state.view === "list";
  const rollCount = (list) => { const n = list.reduce((m, g) => m + g.spools.length, 0); return `${n} ${n === 1 ? "Rolle" : "Rollen"}`; };
  $("#brands").innerHTML = brands.map((brand) => {
    const list = byBrand.get(brand).sort((a, b) => (a.subtype + a.color_name).localeCompare(b.subtype + b.color_name, "de"));
    // Innerhalb des Herstellers nach Material getrennt, jeweils mit Überschrift.
    const byMat = new Map();
    for (const g of list) {
      const mat = g.material || "Ohne Material";
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(g);
    }
    const mats = [...byMat.keys()].sort((a, b) => a.localeCompare(b, "de"));
    return `<div class="brand">
      <div class="brandHead">${logoHtml(brand)}<h2>${esc(brand)}</h2><span class="muted">${rollCount(list)}</span>
        ${websiteLink(brand)}
        <button class="icon need-brands_edit" data-act="brand" data-brand="${esc(brand)}" title="Hersteller bearbeiten">${ic("edit")}</button></div>
      ${mats.map((mat) => `<div class="matGroup">
        <h3 class="matHead">${esc(mat)} <span class="muted">${rollCount(byMat.get(mat))}</span></h3>
        ${asList ? `<div class="stockList">${byMat.get(mat).map(rowHtml).join("")}</div>` : `<div class="grid">${byMat.get(mat).map(tileHtml).join("")}</div>`}
      </div>`).join("")}</div>`;
  }).join("");
}

function tileHtml(g) {
  const pct = g.capacity ? Math.round((g.remaining / g.capacity) * 100) : 0;
  const cls = g.empty ? "empty" : g.low ? "low" : "";
  const badge = g.empty ? `<span class="badge empty">leer</span>` : g.low ? `<span class="badge low">knapp</span>` : "";
  return `<div class="tile ${cls}">
    <div class="tileTop" data-edit="${esc(g.key)}" title="Antippen zum Bearbeiten"><span class="swatch" style="background:${color(g)}"></span>
      <div class="grow"><div class="tileName">${esc(g.color_name || "Ohne Farbname")} <span class="editHint need-sorts_edit">${ic("edit")}</span></div>
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
      ${tileActions(g)}
    </div></div>`;
}

function tileActions(g) {
  const cart = cartFor(g);
  return `<button class="minus need-rolls_remove" data-act="minus" data-key="${esc(g.key)}" title="Eine Rolle ausbuchen"${g.shelf ? "" : " disabled"}>−1</button>
      <button class="need-rolls_add" data-act="plus" data-key="${esc(g.key)}" title="Eine volle Rolle dazubuchen">+1</button>
      <button class="need-shop_edit" data-act="cart" data-key="${esc(g.key)}" title="Auf die Einkaufsliste">${cart ? `${ic("cart")} <span class="badge cart">${cart.quantity_spools}</span>` : ic("cart")}</button>
      <button class="need-printer" data-act="load" data-key="${esc(g.key)}" title="Rolle in den Drucker einlegen"${g.shelf ? "" : " disabled"}>${ic("printer")}</button>
      <button data-act="rolls" data-key="${esc(g.key)}" title="Rollen einzeln ansehen, Restgewicht und Verbrauch">${ic("list")}</button>`;
}

// Listenansicht: eine Zeile pro Sorte mit denselben Angaben und Knöpfen wie die Kachel.
function rowHtml(g) {
  const pct = g.capacity ? Math.round((g.remaining / g.capacity) * 100) : 0;
  const cls = g.empty ? "empty" : g.low ? "low" : "";
  const badge = g.empty ? `<span class="badge empty">leer</span>` : g.low ? `<span class="badge low">knapp</span>` : "";
  const where = [
    ...g.places.map((pl) => `<span>${placeIcon(pl)} ${esc(pl)}</span>`),
    ...g.slotList.map((x) => `<span>${printerIcon(x.printer_id)} ${esc(x.label)}</span>`),
  ];
  return `<div class="stockRow ${cls}">
    <div class="rowName" data-edit="${esc(g.key)}" title="Antippen zum Bearbeiten"><span class="swatch" style="background:${color(g)}"></span>
      <div><div class="tileName">${esc(g.color_name || "Ohne Farbname")} <span class="editHint need-sorts_edit">${ic("edit")}</span></div>
      <div class="tileSub">${esc(g.subtype || "")}${missingFields(g).length ? ` <span class="missing">${g.subtype ? "· " : ""}fehlt: ${missingFields(g).join(", ")}</span>` : ""}</div></div></div>
    <div class="rowStock"><span><b>${g.shelf}</b> im Lager${g.printer ? ` · <b>${g.printer}</b> im Drucker` : ""} ${badge}</span>
      <div class="rowBar"><div class="bar"><span style="width:${pct}%"></span></div><span>${kg(g.remaining)}</span></div></div>
    <div class="rowWhere tileMeta">${where.length ? where.join("") : g.shelf ? `<span class="muted">${ic("pin")} kein Lagerplatz</span>` : ""}
      ${g.value ? `<span>${ic("coin")} ${money(g.value)}</span>` : ""}</div>
    <div class="tileActions">${tileActions(g)}</div>
  </div>`;
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
    if (i.status === "pending") actions = `<button class="need-shop_edit" data-act="ordered" data-id="${i.id}">Bestellt</button><button class="primary need-shop_edit need-rolls_add" data-act="receive" data-id="${i.id}">Eingetroffen</button>`;
    else if (i.status === "purchased") actions = `<button class="primary need-shop_edit need-rolls_add" data-act="receive" data-id="${i.id}">Eingetroffen → ins Lager</button>`;
    return `<div class="shopItem ${done ? "done" : ""}">
      ${sw}${i.brand ? logoHtml(i.brand, "small") : ""}
      <div class="shopMain"><b>${esc(i.color_name || "")}</b> ${esc([i.material, i.subtype].filter(Boolean).join(" "))}
        <div class="muted">${esc(i.brand || "")}${i.note ? " · " + esc(i.note) : ""}</div>${shopWho(i)}</div>
      <div class="shopStock">Im Lager: <b>${st.rolls}</b> ${st.rolls === 1 ? "Rolle" : "Rollen"}<div class="muted">${st.printer ? st.printer + " im Drucker · " : ""}${kg(st.grams)} übrig</div></div>
      <div class="qty">${done ? "" : `<button class="icon need-shop_edit" data-act="qty-" data-id="${i.id}">−</button>`}<span>${i.quantity_spools}×</span>${done ? "" : `<button class="icon need-shop_edit" data-act="qty+" data-id="${i.id}">+</button>`}</div>
      <span class="status ${esc(i.status)}">${esc(statusLabel)}</span>
      ${actions}
      <button class="icon need-shop_edit" data-act="remove" data-id="${i.id}" title="Entfernen">${ic("close")}</button>
    </div>`;
  }).join("");
}

// Wer den Eintrag auf die Einkaufsliste gesetzt hat und wann (merkt sich die App selbst).
function shopWho(i) {
  const m = state.shopMeta?.[String(i.id)];
  if (!m) return "";
  const changed = m.changed_by && m.changed_by !== m.by ? ` · Menge geändert von ${esc(m.changed_by)}` : "";
  return `<div class="muted shopWho">${ic("edit")} eingetragen von <b>${esc(m.by)}</b> am ${fmtDateTime(m.at)}${changed}</div>`;
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

function askConfirm(title, html, yesLabel = "Bestätigen", danger = false, slide = false) {
  // Eigenes Bestätigungsfenster; liefert true bei „Bestätigen“.
  // Mit slide muss man zum Bestätigen einen Regler ganz nach rechts ziehen (für Löschen, das nicht rückgängig geht).
  const dlg = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmBody").innerHTML = html + (slide ? `<div class="slideTrack"><span class="slideText">${esc(yesLabel)}: nach rechts ziehen</span>
    <div class="slideKnob" role="slider" tabindex="0" aria-label="${esc(yesLabel)}: nach rechts ziehen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${ic("trash")}</div></div>` : "");
  const yes = $("#confirmYes");
  yes.textContent = yesLabel;
  yes.className = danger ? "danger" : "primary";
  yes.classList.toggle("hidden", slide);
  return new Promise((resolve) => {
    // Direkt auf die Knöpfe reagieren statt auf „close“, das kommt in manchen Browsern verzögert.
    const done = (answer) => {
      dlg.removeEventListener("click", onClick);
      dlg.removeEventListener("cancel", onCancel);
      resolve(answer);
    };
    if (slide) setupSlide(dlg, () => { dlg.close(); done(true); });
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

function setupSlide(dlg, onDone) {
  const track = dlg.querySelector(".slideTrack"), knob = dlg.querySelector(".slideKnob");
  const max = () => track.clientWidth - knob.offsetWidth - 8;
  let x = 0, startX = null;
  const move = (v, animate) => {
    x = Math.max(0, Math.min(max(), v));
    knob.style.transition = animate ? "transform .2s" : "none";
    knob.style.transform = `translateX(${x}px)`;
    track.style.setProperty("--slide", Math.round(x / max() * 100) + "%");
    knob.setAttribute("aria-valuenow", Math.round(x / max() * 100));
  };
  const finish = () => {
    if (x >= max() - 2) onDone();
    else move(0, true);
  };
  knob.addEventListener("pointerdown", (ev) => { startX = ev.clientX - x; knob.setPointerCapture(ev.pointerId); });
  knob.addEventListener("pointermove", (ev) => { if (startX !== null) move(ev.clientX - startX); });
  knob.addEventListener("pointerup", () => { startX = null; finish(); });
  knob.addEventListener("pointercancel", () => { startX = null; move(0, true); });
  knob.addEventListener("keydown", (ev) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    move(x + (ev.key === "ArrowRight" ? 1 : -1) * max() / 5, true);
    if (x >= max() - 2) setTimeout(onDone, 200);
  });
}

function sortLine(f, qty) {
  const sw = /^[0-9a-f]{6}/i.test(f.rgba || "") ? `<span class="swatch" style="background:${swatchBg(f.rgba)}"></span>` : "";
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

async function deleteRoll(s) {
  const a = state.slotOf?.get(s.id);
  const uses = (state.usage?.get(s.id) || []).length;
  const ok = await askConfirm("Rolle löschen", `<div class="confirmLine">${dot(s.rgba, 32)}<span><b>${esc(rollName(s))}</b> · Rolle ${s.id} · ${kg(remaining(s))}</span></div>
    <p class="confirmNote">Die Rolle wird in Bambuddy endgültig gelöscht, nicht nur ausgebucht.${uses ? ` Ihre ${uses} Verbrauchseinträge verschwinden mit.` : ""}${a ? ` Sie wird von <b>${esc(slotLabel(a))}</b> gelöst.` : ""} Zum Ausbuchen mit Wiederherstellen nimm lieber „−1“.</p>`, "Löschen", true);
  if (!ok) return;
  await api(`api/inventory/spools/${s.id}`, { method: "DELETE" });
  toast(`Rolle ${s.id} gelöscht`);
}

async function deleteSort(g) {
  const inPrinter = g.spools.filter((s) => state.inPrinter?.has(s.id)).length;
  const ok = await askConfirm("Ganze Sorte löschen", sortLine(g.template, g.spools.length) +
    `<p class="confirmNote">Alle ${g.spools.length} ${g.spools.length === 1 ? "Rolle" : "Rollen"} dieser Sorte werden in Bambuddy endgültig gelöscht, mit ihrem Verbrauch.${inPrinter ? ` ${inPrinter} davon ${inPrinter === 1 ? "steckt" : "stecken"} im Drucker und ${inPrinter === 1 ? "wird" : "werden"} gelöst.` : ""} Das lässt sich nicht rückgängig machen.</p>`, "Löschen", true, true);
  if (!ok) return;
  $("#editDialog").close();
  let failed = 0;
  for (const s of g.spools) {
    try { await api(`api/inventory/spools/${s.id}`, { method: "DELETE" }); } catch { failed++; }
  }
  toast(failed ? `${g.spools.length - failed} gelöscht, ${failed} nicht` : `${g.color_name || g.material} gelöscht`, failed ? 5000 : 2600);
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
      body: JSON.stringify({ material: fields.material, subtype: fields.subtype || null, brand: fields.brand || null, color_name: fields.color_name || null, quantity_spools: qty, note: existing?.note || null, ...(existing ? { _keep: existing.id } : {}) }),
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
    for (const name of ["stock", "shop", "usage", "brands", "places", "users", "design"]) $("#tab-" + name).classList.toggle("hidden", btn.dataset.tab !== name);
    if (btn.dataset.tab === "users") loadUsers();
    if (btn.dataset.tab === "usage") loadUnbooked();
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
  else if (act === "place") { btn.disabled = false; if (has("places_edit")) openPlace(parseInt(btn.dataset.place, 10)); }
  else if (act === "brand") { btn.disabled = false; if (has("brands_edit")) openBrand(btn.dataset.brand); }
  else if (act === "deleteBrand") { btn.disabled = false; if (has("brands_edit")) deleteBrand(btn.dataset.brand); }
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
    rgba: $("#newForm").color.dataset.touched === "1" ? formRgba($("#newForm")) : null,
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
  // Nur echte Doppel: gleicher Hersteller, Material, Typ und Farbname (Schreibweise egal).
  // Eine ähnliche Farbe allein ist kein Doppel, z. B. Grey und Silver vom selben Hersteller.
  if (!s.brand || !s.material || !s.color_name) return [];
  return state.groups.filter((g) => sameSort(g, s)).slice(0, 4);
}

function updateDupHint() {
  const s = readNewForm();
  s.color_touched = $("#newForm").color.dataset.touched === "1";
  const hits = similarSorts(s);
  const box = $("#dupHint");
  if (!hits.length) return box.classList.add("hidden");
  box.innerHTML = `<b>Diese Sorte gibt es schon:</b>` + hits.map((g) =>
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
  if (ev.target.name === "color" || ev.target.name === "alpha") $("#newForm").color.dataset.touched = "1";
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
  form.alpha.addEventListener("change", () => { picker.dataset.touched = "1"; });
  hex.addEventListener("input", () => {
    // 6 Stellen für die Farbe, optional 2 weitere für die Deckkraft (#RRGGBBAA wie in Bambu Studio).
    const v = hex.value.trim().replace(/^#?/, "#");
    const ok = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v);
    hex.setCustomValidity(ok || !hex.value.trim() ? "" : "Bitte Hex-Code eingeben, z. B. #FF9016 oder transparent #FF901680");
    if (!ok) return;
    picker.value = v.slice(0, 7).toLowerCase();
    if (v.length === 9) form.alpha.value = alphaOption(v.slice(1));
    picker.dataset.touched = "1";
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Sorte bearbeiten: Änderungen gelten für alle Rollen dieser Sorte.
let editGroup = null;

document.addEventListener("click", (ev) => {
  const top = ev.target.closest("[data-edit]");
  if (!top || !has("sorts_edit")) return;
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
  f.alpha.value = alphaOption(g.rgba);
  f.label_weight.value = t.label_weight || 1000;
  f.core_weight.value = t.core_weight ?? 250;
  f.cost_per_kg.value = t.cost_per_kg ?? "";
  const missing = missingFields(g);
  $("#editInfo").textContent = (g.spools.length === 1 ? "Gilt für die eine Rolle dieser Sorte." : `Gilt für alle ${g.spools.length} Rollen dieser Sorte.`) + (missing.length ? ` Es fehlt: ${missing.join(", ")}.` : "");
  $("#editError").textContent = "";
  $("#editDialog").showModal();
}

$("#deleteSort").addEventListener("click", () => { if (editGroup) run(() => deleteSort(editGroup)); });

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
  if (f.color.dataset.touched === "1") next.rgba = formRgba(f);
  const labels = { brand: "Hersteller", material: "Material", subtype: "Typ", color_name: "Farbname", label_weight: "Gewicht", rgba: "Farbe", core_weight: "Leergewicht Spule", cost_per_kg: "Preis pro kg" };
  const changes = Object.keys(next).filter((k) => k === "rgba"
    ? editGroup.mixedColors || (editGroup.rgba || "").slice(0, 6).toUpperCase() !== next.rgba.slice(0, 6) || alphaOption(editGroup.rgba) !== next.rgba.slice(6)
    : (next[k] ?? "") !== (t[k] ?? ""));
  const loc = f.location.value;
  const shelfIds = editGroup.spools.filter((s) => !state.inPrinter?.has(s.id)).map((s) => s.id);
  if (!changes.length && (!loc || !shelfIds.length)) return $("#editDialog").close();
  const update = Object.fromEntries(changes.map((k) => [k, next[k]]));
  const alphaName = { FF: "", 80: " durchscheinend", "00": " transparent" };
  const show = (k, v, old) => (k === "rgba" && v ? (old && editGroup.mixedColors ? "verschieden je Rolle" : "#" + v.slice(0, 6).toUpperCase() + alphaName[alphaOption(v)]) : v);
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
    const status = j.status && j.status !== "completed" ? ` <span class="missing">(${statusText(j.status)})</span>` : "";
    const cost = j.items.reduce((n, u) => n + (u.cost || 0), 0);
    const grams = j.items.reduce((n, u) => n + (u.weight_used || 0), 0);
    return `<div class="jobCard">
      <div class="jobHead"><b>${esc(j.print_name || "Druck")}</b>${status}
        <span class="muted">${fmtDateTime(j.created_at)}${printerName(j.printer_id) ? " · " + esc(printerName(j.printer_id)) : ""}</span>
        <span class="jobTotal"><b>−${Math.round(grams)} g</b>${cost ? ` <span class="muted">${money(cost)}</span>` : ""}</span>
        <button type="button" class="need-usage_edit jobEdit" data-act="editJob" data-job="${esc(j.key)}" title="Abbuchung korrigieren">${ic("edit")} Korrigieren</button></div>
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
  // Umgebuchte Abbuchungen stehen bei der falschen Rolle auf 0 g; die zeigen wir nicht mehr an.
  for (const j of jobs.values()) {
    const rest = j.items.filter((u) => !(u.edited && !u.weight_used));
    if (rest.length) j.items = rest;
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

// ---------- Drucke ohne Abbuchung (aus Bambuddys Archiv) ----------
// Z. B. wenn beim Druck keine Rolle zugeordnet war. Nur laden, wenn der Reiter offen ist: Das Archiv ist gross.

async function loadUnbooked() {
  if (!has("tab_usage") || $("#tab-usage").classList.contains("hidden")) return;
  try {
    state.unbooked = (await api("unbooked")).prints || [];
  } catch {
    state.unbooked = [];
  }
  renderUnbooked();
}

function renderUnbooked() {
  const box = $("#unbookedBox");
  const list = state.unbooked || [];
  if (!list.length) return box.classList.add("hidden");
  const printerName = (id) => ((state.printers || []).length > 1 ? (state.printers.find((p) => p.id === id)?.name || "") : "");
  box.innerHTML = `<h3>Drucke ohne Abbuchung</h3>
    <p class="muted">Diese Drucke stehen in Bambuddys Archiv, aber bei keiner Rolle wurde Filament abgezogen. Meist war im Drucker keine Rolle zugeordnet.</p>` +
    list.map((a) => {
      const status = a.status && a.status !== "completed" ? ` <span class="missing">(${statusText(a.status)})</span>` : "";
      const rgba = /^#?[0-9a-f]{6}/i.test(a.filament_color || "") ? a.filament_color.replace("#", "").slice(0, 6) + "FF" : "";
      return `<div class="chipRow unclear">${dot(rgba)}<span class="grow"><b>${esc(a.print_name || "Druck")}</b>${status}
        <span class="muted"> · ${fmtDateTime(a.completed_at)}${printerName(a.printer_id) ? " · " + esc(printerName(a.printer_id)) : ""} · ${a.grams ? Math.round(a.grams * 10) / 10 + " g" : "Menge unbekannt"}${a.filament_type ? " " + esc(a.filament_type) : ""}</span></span>
        <span class="unbookedActs"><button class="primary need-usage_edit" data-act="bookArchive" data-arch="${a.id}">Rolle nachtragen</button>
        <button class="need-usage_edit" data-act="dismissArchive" data-arch="${a.id}" title="Nicht abbuchen, z. B. fremdes Filament">Ausblenden</button></span></div>`;
    }).join("");
  box.classList.remove("hidden");
}

function statusText(st) {
  return ["failed", "aborted", "cancelled", "stopped"].includes(st) ? "abgebrochen" : esc(st);
}

function bookArchive(a) {
  openJobEdit({ print_name: a.print_name, printer_id: a.printer_id, created_at: a.completed_at, status: a.status, items: [], archive: a });
}

async function dismissArchive(a) {
  const ok = await askConfirm("Druck ausblenden", `<p><b>${esc(a.print_name || "Druck")}</b> · ${fmtDateTime(a.completed_at)}</p><p class="confirmNote">Der Druck wird nicht abgebucht und hier nicht mehr angezeigt. In Bambuddys Archiv bleibt er.</p>`, "Ausblenden");
  if (!ok) return;
  await api("usage-edits", { method: "POST", body: JSON.stringify({ dismiss: a.id }) });
  state.unbooked = (state.unbooked || []).filter((x) => x.id !== a.id);
  renderUnbooked();
}

$("#usagePeriod").addEventListener("change", renderUsage);
$("#manualJob").addEventListener("click", () => openJobEdit({ items: [], manualNew: true, status: "completed" }));
$("#usageSearch").addEventListener("input", renderUsage);

// ---------- Abbuchung eines Drucks korrigieren ----------

let editJob = null;

function openJobEdit(job) {
  editJob = job;
  const a = job.archive;
  $("#jobHeading").textContent = a ? "Abbuchung nachtragen" : "Abbuchung korrigieren";
  $("#jobTitle").textContent = `${job.print_name || "Druck"} · ${fmtDateTime(job.created_at)}`;
  // Je Rolle: Menge ändern oder auf eine andere Rolle umbuchen, wenn beim Druck die falsche zugeordnet war.
  $("#jobRows").innerHTML = job.items.map((u, i) => `<div class="jobEditRow">${dot(u.spool?.rgba)}
      <span class="grow">${esc(u.spool ? rollName(u.spool) : "Unbekannte Rolle")} · Rolle ${u.spool_id}${u.edited && !u.manual ? `<div class="muted">Bambuddy: ${Math.round(u.original)} g</div>` : ""}${u.manual ? `<div class="muted">von Hand nachgetragen</div>` : ""}</span>
      <label class="narrow">Gramm<input type="number" min="0" max="5000" step="0.1" data-item="${i}" value="${Math.round(u.weight_used * 10) / 10}"></label>
      <div class="moveWrap"><select class="moveSel" data-move="${i}" title="Auf eine andere Rolle umbuchen"><option value="">Rolle stimmt</option>${preferredRoll(state.spools.filter((s) => s.id !== u.spool_id)).map((s) => rollOption(s).replace(/^(<option [^>]*>)/, "$1Umbuchen auf: ")).join("")}</select></div></div>`).join("");
  $("#jobRows").classList.toggle("hidden", !job.items.length);
  $("#jobRows").querySelectorAll("select.moveSel").forEach(rollPick);
  $("#jobAddHead").textContent = a ? "Welche Rolle wurde verwendet?" : "Rolle nachtragen, die nicht abgebucht wurde";
  const used = new Set(job.items.map((u) => u.spool_id));
  let rolls = preferredRoll(state.spools.filter((s) => !used.has(s.id)));
  if (a) {
    // Zuerst Rollen, die in diesem Drucker stecken, dann gleiches Material.
    const mat = norm(a.filament_type || "");
    const here = new Set((state.assignments || []).filter((x) => x.printer_id === a.printer_id).map((x) => x.spool_id));
    const score = (s) => (here.has(s.id) ? 0 : 2) + (mat && norm(s.material || "") === mat ? 0 : 1);
    rolls = [...rolls].sort((x, y) => score(x) - score(y));
  }
  $("#jobForm").addRoll.innerHTML = (a ? "" : `<option value="">— keine —</option>`) + rolls.map(rollOption).join("");
  rollPick($("#jobForm").addRoll);
  $("#jobForm").addGrams.value = a?.grams || "";
  // Druck ganz von Hand: Name, Drucker und Zeitpunkt selbst eintragen.
  const m = $("#jobManual");
  m.classList.toggle("hidden", !job.manualNew);
  if (job.manualNew) {
    $("#jobHeading").textContent = "Druck von Hand nachtragen";
    $("#jobTitle").textContent = "Für Drucke, die weder abgebucht noch in Bambuddys Archiv zu finden sind.";
    $("#jobAddHead").textContent = "Welche Rolle wurde verwendet?";
    const f = $("#jobForm");
    f.manName.value = "";
    f.manPrinter.innerHTML = (state.printers || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("") || `<option value="">–</option>`;
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    f.manWhen.value = now.toISOString().slice(0, 16);
    f.addRoll.innerHTML = preferredRoll(state.spools).map(rollOption).join("");
    rollPick(f.addRoll);
  }
  $("#jobError").textContent = "";
  $("#jobDialog").showModal();
}

$("#jobForm").addEventListener("submit", async (ev) => {
  if (ev.submitter?.value !== "ok") return;
  ev.preventDefault();
  const f = ev.target;
  const changes = [];
  if (editJob.manualNew) {
    const when = new Date(f.manWhen.value);
    if (!f.manName.value.trim()) return ($("#jobError").textContent = "Bitte einen Namen für den Druck eingeben");
    if (isNaN(when)) return ($("#jobError").textContent = "Bitte Datum und Uhrzeit eingeben");
    Object.assign(editJob, { print_name: f.manName.value.trim(), printer_id: parseInt(f.manPrinter.value, 10) || null, created_at: when.toISOString() });
  }
  const jobInfo = { print_name: editJob.print_name, printer_id: editJob.printer_id, created_at: editJob.created_at, status: editJob.status };
  f.querySelectorAll("input[data-item]").forEach((inp) => {
    const i = parseInt(inp.dataset.item, 10);
    const u = editJob.items[i];
    const grams = parseFloat(String(inp.value).replace(",", "."));
    const zero = (g) => (u.manual ? { manual_id: u.id, grams: g } : { usage_id: u.id, spool_id: u.spool_id, grams: g });
    const moveTo = parseInt(f.querySelector(`select[data-move="${i}"]`)?.value, 10);
    if (moveTo && grams > 0) {
      // Umbuchen: bei der falschen Rolle auf 0 setzen (gibt das Filament zurück), bei der richtigen nachtragen.
      const to = state.spools.find((x) => x.id === moveTo);
      changes.push({ u, grams: 0, move: { to, grams }, body: zero(0) });
      changes.push({ u: { spool: to, spool_id: moveTo, weight_used: 0 }, grams, hidden: true, body: { spool_id: moveTo, grams, job: jobInfo } });
      return;
    }
    if (!(grams >= 0) || Math.abs(grams - u.weight_used) < 0.05) return;
    changes.push({ u, grams, body: zero(grams) });
  });
  const addId = parseInt(f.addRoll.value, 10);
  const addGrams = parseFloat(String(f.addGrams.value).replace(",", "."));
  if (addId && addGrams > 0) {
    const s = state.spools.find((x) => x.id === addId);
    changes.push({ u: { spool: s, spool_id: addId, weight_used: 0 }, grams: addGrams,
      body: { spool_id: addId, grams: addGrams, job: jobInfo } });
  }
  if (!changes.length) return $("#jobDialog").close();
  const rows = changes.filter((c) => !c.hidden).map(({ u, grams, move }) => {
    if (move) {
      return `<div class="confirmLine">${dot(u.spool?.rgba)}<span>Umbuchen von <b>${esc(u.spool ? rollName(u.spool) : "Rolle " + u.spool_id)}</b>
        <span class="muted">(+${Math.round(u.weight_used)} g zurück)</span> auf ${dot(move.to?.rgba, 16)} <b>${esc(move.to ? rollName(move.to) : "")}</b>
        <span class="muted">(−${Math.round(move.grams)} g)</span></span></div>`;
    }
    const diff = grams - u.weight_used;
    return `<div class="confirmLine">${dot(u.spool?.rgba)}<span><b>${esc(u.spool ? rollName(u.spool) : "Rolle " + u.spool_id)}</b> · ${Math.round(u.weight_used)} g → <b>${Math.round(grams)} g</b>
      <span class="muted">(${diff > 0 ? "Rolle −" + Math.round(diff) + " g" : "Rolle +" + Math.round(-diff) + " g zurück"})</span></span></div>`;
  }).join("");
  const ok = await askConfirm(editJob.manualNew ? "Druck nachtragen" : editJob.archive ? "Abbuchung nachtragen" : "Abbuchung korrigieren", rows + `<p class="confirmNote">Die Differenz wird direkt bei der Rolle verbucht, damit der Lagerbestand stimmt.${editJob.manualNew ? "" : " Die neue Summe des Drucks geht auch ins Bambuddy-Archiv, falls der Druck dort noch gespeichert ist."}</p>`, "Speichern");
  if (!ok) return;
  // Neue Summe des Drucks fürs Bambuddy-Archiv: korrigierte und unveränderte Rollen plus nachgetragene.
  const final = new Map(editJob.items.map((u) => [u, u.weight_used]));
  for (const c of changes) final.set(c.u, c.move ? 0 : c.grams);
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
    // Von Hand nachgetragene Drucke gibt es im Archiv nicht; nichts anfassen, damit kein anderer Druck geändert wird.
    let sync = editJob.manualNew ? { status: "ok", manual: true } : null;
    if (!sync) try {
      sync = await api("archive-sync", { method: "POST", body: JSON.stringify({ job, grams: total, cost: cost > 0 ? cost : null }) });
    } catch (e) {
      sync = { status: "failed", message: "Bambuddy-Archiv nicht aktualisiert" };
    }
    if (editJob.archive) state.unbooked = (state.unbooked || []).filter((x) => x.id !== editJob.archive.id);
    toast(sync.manual ? "Druck nachgetragen" : sync.status === "ok" ? "Abbuchung gespeichert, auch im Bambuddy-Archiv" : "Rolle korrigiert. " + sync.message, sync.status === "ok" ? 2600 : 6000);
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
  return `<span class="swatch" style="width:${size}px;height:${size}px;background:${swatchBg(rgba)}"></span>`;
}

function unassignedSlots() {
  // Belegt, ohne Chip und keiner Lager-Rolle zugeordnet: hier zieht Bambuddy keinen Verbrauch ab.
  // Die externe Spule zählt nur bei Druckern ohne AMS (z. B. A1 Mini ohne AMS lite): Dort ist sie die einzige Quelle.
  // Bei Druckern mit AMS meldet sie ohne Sensor nur den zuletzt eingestellten Filamenttyp, auch wenn keine Rolle hängt.
  const hasAms = new Set(allSlots().filter((x) => x.ams_id !== 255).map((x) => x.printer_id));
  return allSlots().filter((x) => x.connected && x.present && !x.chip && (x.ams_id !== 255 || !hasAms.has(x.printer_id)) && !assignmentAt(x));
}

function renderSlotBox() {
  const open = unassignedSlots();
  const box = $("#slotBox");
  if (!open.length || !has("tab_stock")) return box.classList.add("hidden");
  box.innerHTML = `<h3>Rolle im Drucker ohne Zuordnung</h3>
    <p class="muted">Ohne Zuordnung wird der Verbrauch dieser Rollen nicht vom Lager abgezogen.</p>` +
    open.map((x) => `<div class="chipRow unclear">${dot(x.rgba)}<span><b>${esc(fullSlotLabel(x))}</b>${x.type ? " · " + esc(x.type) : ""}</span>
      <button class="primary need-printer" data-act="assignSlot" data-slot="${x.printer_id}:${x.ams_id}:${x.tray_id}">Lager-Rolle zuordnen</button></div>`).join("");
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
  return `<option value="${s.id}" data-rgba="${esc(s.rgba || "")}">${esc(rollName(s))} · ${kg(remaining(s))}${(s.weight_used || 0) >= 1 ? " (angebrochen)" : ""}${hasChip(s) ? " · Chip" : ""}${where}</option>`;
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
  rollPick(f.roll);
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
    <div class="rollEdit need-rolls_edit">
      <label>Lagerplatz${a ? " (nach dem Herausnehmen)" : ""}<select data-place="${s.id}">${placeOptions(s)}</select></label>
    </div>
    <div class="rollEdit need-rolls_edit">
      <label>Restgewicht (g)<input type="number" min="0" step="1" data-rest="${s.id}" value="${Math.round(remaining(s))}"></label>
      <label>oder gewogen mit Spule (g)<input type="number" min="0" step="1" data-gross="${s.id}" placeholder="Spule ${core} g"></label>
      <button type="button" class="primary" data-act="saveWeight" data-roll="${s.id}">Speichern</button>
    </div>
    <div class="rollActions">${a
      ? `<button type="button" class="need-printer" data-act="unload" data-roll="${s.id}">Aus dem Drucker nehmen</button>`
      : `<button type="button" class="need-printer" data-act="loadRoll" data-roll="${s.id}">In Drucker einlegen</button>`}
      <button type="button" class="need-rolls_remove dangerOutline" data-act="deleteRoll" data-roll="${s.id}">${ic("trash")} Rolle löschen</button></div>
    <div class="usage">${usage.length ? `<div class="muted">Letzte Drucke</div>` + usage.map((u) => `<div class="usageRow"><span>${fmtDate(u.created_at)}</span>
      <span class="grow">${esc(u.print_name || "Druck")}${u.status && u.status !== "completed" ? ` <span class="missing">(${statusText(u.status)})</span>` : ""}</span>
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
  else if (act === "deleteRoll" && s) run(() => deleteRoll(s));
  else if (act === "loadRoll" && s) openLoad({ spool: s });
  else if (act === "editJob") {
    const job = state.jobs?.get(btn.dataset.job);
    if (job) openJobEdit(job);
  }
  else if (act === "bookArchive" || act === "dismissArchive") {
    const a = (state.unbooked || []).find((x) => String(x.id) === btn.dataset.arch);
    if (a && act === "bookArchive") bookArchive(a);
    else if (a) run(() => dismissArchive(a));
  }
  else if (act === "assignSlot") {
    const slot = slotByKey(btn.dataset.slot);
    if (slot) openLoad({ slot });
  }
});

async function deleteBrand(name) {
  const rolls = state.spools.filter((s) => brandKey(s.brand) === brandKey(name)).length;
  if (rolls) return toast(`${name} hat noch ${rolls} ${rolls === 1 ? "Rolle" : "Rollen"}, löschen geht erst ohne Rollen`, 4000);
  const ok = await askConfirm("Hersteller löschen", `<div class="confirmLine">${logoHtml(name)}<span><b>${esc(name)}</b></span></div>
    <p class="confirmNote">Webseite und Logo werden entfernt. Dem Hersteller ist keine Rolle zugewiesen.</p>`, "Löschen");
  if (!ok) return;
  try {
    await api(`brands/${encodeURIComponent(name)}`, { method: "DELETE" });
    state.brands = await api("brands").catch(() => state.brands);
    state.logoVersion = Date.now();
    render();
    toast(`${name} gelöscht`);
  } catch (e) {
    toast("Nicht gelöscht: " + e.message, 5000);
  }
}

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
      <button class="need-places_edit" data-act="place" data-place="${l.id}">Icon ändern</button>
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
    if (form.removeLogo.checked && !file) await api(`logo/${encodeURIComponent(currentBrand)}`, { method: "DELETE" });
    if (file) await api(`logo/${encodeURIComponent(currentBrand)}`, { method: "POST", body: file, headers: { "Content-Type": file.type || "image/png" } });
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
  if (!isAdmin()) return;
  try {
    const [users, g] = await Promise.all([api("users"), api("groups")]);
    state.groupData = g;
    const order = (id) => ["admin", "bearbeiten", "erfassen", "ansehen"].indexOf(id) + 1 || 9;
    const groups = [...g.groups].sort((a, b) => order(a.id) - order(b.id) || a.name.localeCompare(b.name, "de"));
    const nameOf = (id) => groups.find((x) => x.id === id)?.name || id;
    $("#defaultGroup").innerHTML = groups.filter((x) => x.id !== "admin").map((x) => `<option value="${esc(x.id)}"${x.id === g.default ? " selected" : ""}>${esc(x.name)}</option>`).join("");
    users.sort((a, b) => order(a.group) - order(b.group) || (a.name || "").localeCompare(b.name || "", "de"));
    $("#userList").innerHTML = users.map((u) => {
      const locked = u.source === "config_admin" || !u.id;
      const options = `<option value="">Vorgabe${u.source === "app" ? "" : ` (${esc(nameOf(u.group))})`}</option>` +
        groups.map((x) => `<option value="${esc(x.id)}"${u.source === "app" && x.id === u.group ? " selected" : ""}>${esc(x.name)}</option>`).join("");
      return `<div class="userRow">
      <div class="grow"><b>${esc(u.name || u.login || "?")}</b>${u.login ? ` <span class="muted">Benutzername: ${esc(u.login)}</span>` : ""}
        <div class="muted">${u.last_seen ? "zuletzt da: " + esc(u.last_seen.replace("T", " ")) : "hat die App noch nie geöffnet"}</div></div>
      ${locked ? `<span class="levelTag">${esc(nameOf(u.group))} <span class="muted">${u.source === "config_admin" ? "(aus Konfiguration)" : "(noch nie angemeldet)"}</span></span>`
        : `<select class="userGroup" data-user="${esc(u.id)}">${options}</select>`}
    </div>`;
    }).join("") || `<div class="emptyState">Noch niemand.</div>`;
    $("#groupList").innerHTML = groups.map((x) => groupCard(x, g.perms)).join("");
  } catch (e) {
    toast("Fehler: " + e.message);
  }
}

function groupCard(x, perms) {
  const fixed = x.id === "admin" || x.id === "kein";
  const checks = perms.map((p) => `<label class="permRow"><input type="checkbox" value="${p.key}"${x.id === "admin" || x.perms.includes(p.key) ? " checked" : ""}${fixed ? " disabled" : ""}> ${esc(p.label)}</label>`).join("");
  return `<form class="groupCard" data-group="${esc(x.id)}">
    ${fixed ? `<h3>${esc(x.name)} <span class="muted">fest</span></h3>` : `<label>Name<input name="name" value="${esc(x.name)}" maxlength="40" required></label>`}
    <div class="permList">${checks}</div>
    ${fixed ? "" : `<div class="actions"><button type="button" class="dangerOutline" data-group-del="${esc(x.id)}">${ic("trash")} Löschen</button><button type="submit" class="primary">Speichern</button></div>`}
  </form>`;
}

$("#groupList").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const perms = [...f.querySelectorAll(".permList input:checked")].map((i) => i.value);
  try {
    await api(`groups/${encodeURIComponent(f.dataset.group)}`, { method: "PUT", body: JSON.stringify({ name: f.name.value, perms }) });
    toast(`Gruppe ${f.name.value} gespeichert`);
    await loadUsers();
  } catch (e) {
    toast("Nicht gespeichert: " + e.message, 5000);
  }
});

$("#groupList").addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-group-del]");
  if (!btn) return;
  const gid = btn.dataset.groupDel;
  const name = state.groupData?.groups.find((x) => x.id === gid)?.name || gid;
  if (!(await askConfirm("Gruppe löschen", `<p class="confirmNote">Die Gruppe <b>${esc(name)}</b> wird gelöscht. Ihre Mitglieder kommen in ihre Vorgabe-Gruppe.</p>`, "Löschen", true))) return;
  try {
    await api(`groups/${encodeURIComponent(gid)}`, { method: "DELETE" });
    toast(`Gruppe ${name} gelöscht`);
    await loadUsers();
  } catch (e) {
    toast("Nicht gelöscht: " + e.message, 5000);
  }
});

$("#addGroup").addEventListener("click", async () => {
  try {
    // Neue Gruppe startet mit Ansehen, Einkaufsliste und Design, wie die Gruppe Ansehen.
    await api("groups", { method: "POST", body: JSON.stringify({ name: "Neue Gruppe",
      perms: ["tab_stock", "tab_shop", "tab_usage", "tab_brands", "tab_places", "tab_design", "shop_edit"] }) });
    await loadUsers();
    const forms = $("#groupList").querySelectorAll("form");
    forms[forms.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    forms[forms.length - 1]?.name?.select();
  } catch (e) {
    toast("Fehler: " + e.message);
  }
});

$("#userList").addEventListener("change", async (ev) => {
  const sel = ev.target.closest("select.userGroup");
  if (!sel) return;
  try {
    await api(`users/${encodeURIComponent(sel.dataset.user)}`, { method: "PUT", body: JSON.stringify({ group: sel.value || null }) });
    toast("Gruppe geändert");
  } catch (e) {
    toast("Nicht geändert: " + e.message, 5000);
  }
  await loadUsers();
});

$("#defaultGroup").addEventListener("change", async (ev) => {
  try {
    await api("groups/default", { method: "PUT", body: JSON.stringify({ group: ev.target.value }) });
    toast("Standardgruppe geändert");
  } catch (e) {
    toast("Nicht geändert: " + e.message, 5000);
  }
  await loadUsers();
});

// Start: erst die eigenen Rechte holen, dann die Daten.
(async () => {
  state.me = await api("api/me").catch(() => ({ level: 0, perms: [] }));
  if (state.me.theme) setTheme(state.me.theme);
  applyDesign(state.me.design);
  fillDesignForm();
  let view = state.me.view;
  try { view = view || localStorage.getItem("view"); } catch { /* egal */ }
  setView(view);
  applyRights();
  try {
    const saved = JSON.parse(localStorage.getItem("filter") || "{}");
    // Früher war je Filter nur ein Wert gespeichert, jetzt eine Liste.
    for (const k of FILTER_KEYS) state.filter[k] = Array.isArray(saved[k]) ? saved[k] : saved[k] ? [saved[k]] : [];
    state.filter.weight = typeof saved.weight === "string" ? saved.weight : "";
    const tab = localStorage.getItem("tab");
    const btn = tab && document.querySelector(`.tab[data-tab="${tab}"]`);
    if (btn && getComputedStyle(btn).display !== "none") btn.click();
  } catch { /* egal */ }
  load();
})();
setInterval(() => { if (!document.hidden) load(true); }, REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(true); });

// ---------- Auswahlliste beim Tippen ----------
// Ersetzt die Browser-Liste (datalist), die sich weder vergrössern noch angenehm scrollen lässt.
// Die Werte kommen weiterhin aus den datalist-Elementen, die renderLists() füllt.

function setupCombo(input) {
  const list = document.getElementById(input.getAttribute("list"));
  if (!list) return;
  input.removeAttribute("list");
  const box = document.createElement("div");
  box.className = "combo hidden";
  box.setAttribute("role", "listbox");
  (input.closest("dialog") || document.body).appendChild(box);
  let items = [], active = -1;

  const place = () => {
    const r = input.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    box.style.left = r.left + "px";
    box.style.width = Math.max(r.width, 200) + "px";
    box.style.maxHeight = Math.max(160, Math.min(320, below > 200 ? below : r.top - 12)) + "px";
    if (below > 200 || below > r.top) { box.style.top = r.bottom + 4 + "px"; box.style.bottom = ""; }
    else { box.style.top = ""; box.style.bottom = window.innerHeight - r.top + 4 + "px"; }
  };
  const close = () => { box.classList.add("hidden"); active = -1; };
  const highlight = (i) => {
    active = i;
    box.querySelectorAll(".comboItem").forEach((el, n) => el.classList.toggle("active", n === i));
    box.children[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const show = () => {
    const q = input.value.trim().toLowerCase();
    const all = [...list.options].map((o) => o.value).filter(Boolean);
    // Treffer am Anfang zuerst, danach Treffer irgendwo im Wort.
    items = [...new Set([...all.filter((v) => v.toLowerCase().startsWith(q)), ...all.filter((v) => v.toLowerCase().includes(q))])];
    if (items.length === 1 && items[0].toLowerCase() === q) items = [];
    if (!items.length || document.activeElement !== input) return close();
    box.innerHTML = items.map((v) => `<div class="comboItem" role="option">${esc(v)}</div>`).join("");
    box.classList.remove("hidden");
    place();
    active = -1;
  };
  const pick = (v) => {
    input.value = v;
    close();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  input.addEventListener("focus", show);
  input.addEventListener("input", (ev) => { if (ev.isTrusted) show(); });
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (ev) => {
    if (box.classList.contains("hidden")) return;
    if (ev.key === "ArrowDown") { ev.preventDefault(); highlight(Math.min(items.length - 1, active + 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); highlight(Math.max(0, active - 1)); }
    else if (ev.key === "Enter" && active >= 0) { ev.preventDefault(); pick(items[active]); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(); }
  });
  // mousedown statt click, damit das Feld den Fokus nicht vorher verliert.
  box.addEventListener("mousedown", (ev) => {
    const el = ev.target.closest(".comboItem");
    if (!el) return;
    ev.preventDefault();
    pick(items[[...box.children].indexOf(el)]);
  });
  // Die MDI-Vorschläge kommen erst nach dem Tippen vom Server.
  new MutationObserver(() => { if (document.activeElement === input) show(); }).observe(list, { childList: true });
  const follow = () => { if (!box.classList.contains("hidden")) place(); };
  window.addEventListener("resize", follow);
  (input.closest("dialog") || window).addEventListener("scroll", follow, true);
  input.closest("dialog")?.addEventListener("close", close);
}

document.querySelectorAll("input[list]").forEach(setupCombo);

// ---------- Rollenauswahl mit Farbpunkt ----------
// Eine normale Auswahlliste kann keine Farben zeigen. Die Liste bleibt im Formular (Wert, Absenden),
// angezeigt wird ein Knopf mit Farbpunkt, der eine eigene Liste aufklappt.

function rollPick(select) {
  const optHtml = (o) => `${o.dataset.rgba !== undefined ? dot(o.dataset.rgba, 18) : `<span class="swatch none" style="width:18px;height:18px"></span>`}<span>${esc(o.textContent)}</span>`;
  if (!select._pick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rollPick";
    select.after(btn);
    select.classList.add("pickHidden");
    const box = document.createElement("div");
    box.className = "combo hidden";
    box.setAttribute("role", "listbox");
    (select.closest("dialog") || document.body).appendChild(box);
    let active = -1;
    const close = () => box.classList.add("hidden");
    const highlight = (i) => {
      active = i;
      box.querySelectorAll(".comboItem").forEach((el, n) => el.classList.toggle("active", n === i));
      box.children[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    const place = () => {
      const r = btn.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      box.style.left = r.left + "px";
      box.style.width = Math.max(r.width, 240) + "px";
      box.style.maxHeight = Math.max(160, Math.min(360, below > 220 ? below : r.top - 12)) + "px";
      if (below > 220 || below > r.top) { box.style.top = r.bottom + 4 + "px"; box.style.bottom = ""; }
      else { box.style.top = ""; box.style.bottom = window.innerHeight - r.top + 4 + "px"; }
    };
    const pick = (i) => {
      select.selectedIndex = i;
      close();
      select.dispatchEvent(new Event("change", { bubbles: true }));
      btn.focus();
    };
    btn.addEventListener("click", () => {
      if (!box.classList.contains("hidden")) return close();
      box.innerHTML = [...select.options].map((o) => `<div class="comboItem rollItem" role="option">${optHtml(o)}</div>`).join("");
      box.classList.remove("hidden");
      place();
      highlight(select.selectedIndex);
    });
    btn.addEventListener("keydown", (ev) => {
      if (box.classList.contains("hidden")) return;
      if (ev.key === "ArrowDown") { ev.preventDefault(); highlight(Math.min(select.options.length - 1, active + 1)); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); highlight(Math.max(0, active - 1)); }
      else if (ev.key === "Enter" && active >= 0) { ev.preventDefault(); pick(active); }
      else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); close(); }
    });
    btn.addEventListener("blur", () => setTimeout(close, 150));
    box.addEventListener("mousedown", (ev) => {
      const el = ev.target.closest(".comboItem");
      if (!el) return;
      ev.preventDefault();
      pick([...box.children].indexOf(el));
    });
    select.addEventListener("change", () => select._pick());
    const follow = () => { if (!box.classList.contains("hidden")) place(); };
    window.addEventListener("resize", follow);
    (select.closest("dialog") || window).addEventListener("scroll", follow, true);
    select.closest("dialog")?.addEventListener("close", close);
    select._pick = () => {
      const o = select.options[select.selectedIndex];
      btn.innerHTML = (o ? optHtml(o) : "<span>—</span>") + `<span class="rollPickArrow">${"\u25BE"}</span>`;
      btn.disabled = select.disabled;
    };
  }
  select._pick();
}
