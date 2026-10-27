"use strict";

/* =====================================================================
   TaskFlow · lógica de la aplicación
   Tareas · calendario · recordatorios · subtareas · listas · repetición
   ===================================================================== */

/* ===== Constantes ===== */
const KEY = "taskflow.v2";
const LEGACY_KEY = "taskflow.tasks";
const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };
const PRIORITY_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };
const PRIORITY_NEXT = { baja: "media", media: "alta", alta: "baja" };

const DEFAULT_CATS = [
  { id: "personal", name: "Personal", color: "#6B74F5" },
  { id: "trabajo", name: "Trabajo", color: "#FF7D8C" },
  { id: "estudios", name: "Estudios", color: "#A86BFF" },
  { id: "salud", name: "Salud", color: "#2EC4A6" },
  { id: "casa", name: "Casa", color: "#FFA64D" },
];
const SWATCHES = ["#6B74F5", "#A86BFF", "#FF7D8C", "#FF9F5A", "#F5C038", "#2EC4A6", "#3DB8F5", "#8E97B8"];

const REMINDERS = [
  ["", "Sin recordatorio"], ["0", "En el momento"], ["5", "5 minutos antes"], ["15", "15 minutos antes"],
  ["30", "30 minutos antes"], ["60", "1 hora antes"], ["1440", "1 día antes"],
];
const REPEATS = [["none", "No se repite"], ["daily", "Cada día"], ["weekly", "Cada semana"], ["monthly", "Cada mes"]];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const VIEWS = [
  { id: "today", label: "Hoy", icon: "today" },
  { id: "upcoming", label: "Próximas", icon: "clock" },
  { id: "calendar", label: "Calendario", icon: "calendar" },
  { id: "all", label: "Todas", icon: "list" },
  { id: "done", label: "Hechas", icon: "check" },
];

/* ===== Iconos ===== */
const ICONS = {
  today: '<rect x="3" y="4" width="18" height="18" rx="4"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="4"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  flame: '<path d="M12 22c4 0 7-2.8 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-4-2-7-5-9 0 5-3 7-3 12 0 4.2 3 8 7 8z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  command: '<path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3z"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V4M7 8l5-5 5 5M4 20h16"/>',
  reset: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5"/>',
  subs: '<path d="M9 6h12M9 12h12M9 18h12M3 6l1.2 1.2L6 5M3 12l1.2 1.2L6 11M3 18l1.2 1.2L6 17"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0zM12 17v5"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  next: '<path d="M5 5l10 7-10 7zM19 5v14"/>',
  prev: '<path d="M19 5L9 12l10 7zM5 5v14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="3"/><path d="M5 15V6a2 2 0 012-2h9"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  calplus: '<rect x="3" y="4" width="18" height="18" rx="4"/><path d="M16 2v4M8 2v4M3 10h18M12 13v6M9 16h6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 118 0v3"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c0-3.6 2.9-6 6.500-6s6.500 2.400 6.500 6"/><circle cx="17.500" cy="9" r="2.600"/><path d="M17 14c2.700 0 4.500 1.800 4.500 4.500"/>',
  download2: '<path d d="M12 3v12M7 11l5 5 5-5M4 20h16"/>',
};

function icon(name, cls = "") {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ===== Utilidades ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ===== Estado y persistencia ===== */
let state = load();
let view = "today";
let prioFilter = "all";
let query = "";
let calMonth = startOfMonth(new Date());
let calSelected = todayISO();
let calDir = "";
const expanded = new Set();
let doneOpen = false;
let lastDeleted = null;
let newId = null;
let animateList = true;
let editingId = null;
let editingCat = null;
let notifHinted = false;
let extEvents = []; // eventos de calendarios externos (Google / Outlook), de solo lectura
const EXT_COLORS = { google: "#4285F4", microsoft: "#0A84D0" };
const SRC_LABEL = { google: "Google", microsoft: "Outlook" };

function defaultState() {
  return {
    tasks: [], categories: DEFAULT_CATS.map((c) => ({ ...c })),
    settings: { theme: "auto", accent: "indigo", sound: true },
    log: [], done: {}, pomo: {},
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignorar */ }
  if (!s || !Array.isArray(s.tasks)) {
    s = defaultState();
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (Array.isArray(old)) s.tasks = old.map((t) => ({ ...t }));
    } catch { /* ignorar */ }
  }
  const base = defaultState();
  s = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  if (!Array.isArray(s.categories) || !s.categories.length) s.categories = base.categories;
  s.tasks.forEach((t) => normalize(t, s));
  if (!Object.keys(s.done).length) {
    s.tasks.filter((t) => t.done && t.completedAt).forEach((t) => {
      const k = iso(new Date(t.completedAt)); s.done[k] = (s.done[k] || 0) + 1;
    });
  }
  return s;
}

function normalize(t, st = state) {
  t.id ||= uid();
  t.title = String(t.title || "Sin título");
  t.description ||= "";
  if (!PRIORITY_ORDER.hasOwnProperty(t.priority)) t.priority = "media";
  if (!st.categories.some((c) => c.id === t.category)) t.category = st.categories[0].id;
  t.due ||= ""; t.time ||= "";
  t.reminder = t.reminder ?? "";
  t.repeat ||= "none";
  t.subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  t.done = !!t.done;
  t.createdAt ||= Date.now();
  t.completedAt = t.completedAt || null;
  t.reminded = !!t.reminded;
  computeRemind(t);
  return t;
}

function save() {
  if (typeof applyingRemote === "undefined" || !applyingRemote) state.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  if (typeof cloudPush === "function") cloudPush(); // sincroniza con la cuenta (cloud.js)
}

function commit() { save(); render(); }

/* ===== Fechas y recordatorios ===== */
function baseTs(t) {
  if (!t.due) return null;
  const [h, m] = (t.time || "09:00").split(":").map(Number);
  const d = fromISO(t.due); d.setHours(h, m, 0, 0);
  return d.getTime();
}
function endTs(t) {
  if (!t.due) return null;
  if (t.time) return baseTs(t);
  const d = fromISO(t.due); d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function computeRemind(t) {
  const b = baseTs(t);
  t.remindTs = b !== null && t.reminder !== "" && t.reminder != null ? b - Number(t.reminder) * 60000 : null;
}
const isOverdue = (t) => !t.done && t.due && endTs(t) < Date.now();

function relDay(s) {
  const diff = Math.round((fromISO(s) - fromISO(todayISO())) / 864e5);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  const d = fromISO(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return cap(d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).replace(".", ""));
}
const dueLabel = (t) => (t.due ? relDay(t.due) + (t.time ? ` · ${t.time}` : "") : "Sin fecha");

function advance(s, rule) {
  const d = fromISO(s);
  if (rule === "daily") d.setDate(d.getDate() + 1);
  else if (rule === "weekly") d.setDate(d.getDate() + 7);
  else {
    const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return iso(d);
}

function sectionOf(t) {
  if (!t.due) return "none";
  const td = todayISO();
  if (t.due < td) return "overdue";
  if (t.due === td) return "today";
  if (t.due === iso(addDays(new Date(), 1))) return "tomorrow";
  if (t.due <= iso(addDays(new Date(), 7))) return "week";
  return "later";
}
const SECTIONS = [
  ["overdue", "Vencidas"], ["today", "Hoy"], ["tomorrow", "Mañana"],
  ["week", "Esta semana"], ["later", "Más adelante"], ["none", "Sin fecha"],
];

function cmp(a, b) {
  const da = a.due ? a.due + (a.time || "24:00") : "9999";
  const db = b.due ? b.due + (b.time || "24:00") : "9999";
  return da < db ? -1 : da > db ? 1 : (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || b.createdAt - a.createdAt;
}

const get = (id) => state.tasks.find((t) => t.id === id);
const catById = (id) => state.categories.find((c) => c.id === id) || state.categories[0];

/* ===== Acciones sobre tareas ===== */
function makeTask(p) {
  const t = {
    id: uid(), title: "", description: "", priority: "media", category: state.categories[0].id,
    due: "", time: "", reminder: "", repeat: "none", subtasks: [], done: false,
    createdAt: Date.now(), completedAt: null, reminded: false, remindTs: null, ...p,
  };
  computeRemind(t);
  return t;
}

function addTask(p) {
  const t = makeTask(p);
  state.tasks.unshift(t);
  newId = t.id;
  commit();
  return t;
}

// Gancho para sincronizar con calendarios externos tras guardar una tarea
function afterSave(t) {
  if (t && typeof autoSyncTask === "function") autoSyncTask(t);
}

function bumpDone(day, n) {
  state.done[day] = Math.max(0, (state.done[day] || 0) + n);
}

function toggleTask(id, el) {
  const t = get(id);
  if (!t) return;
  const finish = () => {
    const prev = t.completedAt;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    if (t.done) {
      bumpDone(todayISO(), 1);
      if (t.repeat !== "none" && t.due && !t.spawned) spawnNext(t);
    } else if (prev) bumpDone(iso(new Date(prev)), -1);
    commit();
  };
  if (!t.done) {
    const row = el && el.closest(".task");
    if (row) row.classList.add("is-completing");
    if (el) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); }
    tone([[660, 0], [990, .09]], .07);
    setTimeout(finish, reduceMotion ? 0 : 420);
  } else finish();
}

function spawnNext(t) {
  t.spawned = true;
  let next = advance(t.due, t.repeat), guard = 0;
  while (next < todayISO() && guard++ < 400) next = advance(next, t.repeat);
  const copy = makeTask({
    ...t, id: uid(), due: next, done: false, completedAt: null, reminded: false, spawned: false,
    createdAt: Date.now(), subtasks: t.subtasks.map((s) => ({ id: uid(), text: s.text, done: false })),
  });
  state.tasks.unshift(copy);
  setTimeout(() => showToast(`Repetición creada para ${relDay(next).toLowerCase()}`), 500);
}

function deleteTasks(ids, message) {
  lastDeleted = state.tasks.filter((t) => ids.includes(t.id));
  state.tasks = state.tasks.filter((t) => !ids.includes(t.id));
  commit();
  showToast(message, { label: "Deshacer", fn: undoDelete });
}

function undoDelete() {
  if (!lastDeleted) return;
  state.tasks = [...lastDeleted, ...state.tasks];
  lastDeleted = null;
  commit();
  hideToast();
}

function rescheduleTask(id, day) {
  const t = get(id);
  if (!t || t.due === day) return;
  t.due = day; t.reminded = false; t.spawned = false;
  computeRemind(t);
  commit();
  showToast(`Movida al ${fromISO(day).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`);
}

/* ===== Entrada rápida con lenguaje natural ===== */
function parseQuick(text) {
  let s = ` ${text} `;
  const out = { priority: null, due: "", time: "", category: null };

  s = s.replace(/\s!(alta|media|baja)\b/i, (m, p) => { out.priority = p.toLowerCase(); return " "; });
  s = s.replace(/\s#([\p{L}\d_-]+)/u, (m, c) => {
    const cat = state.categories.find((x) => norm(x.name) === norm(c) || x.id === norm(c));
    if (cat) { out.category = cat.id; return " "; }
    return m;
  });

  let m = s.match(/\s(?:a las |a la |@)?(\d{1,2})[:.](\d{2})(?!\d)/i);
  if (m && +m[1] < 24 && +m[2] < 60) { out.time = `${pad(m[1])}:${m[2]}`; s = s.replace(m[0], " "); }
  else {
    m = s.match(/\sa las? (\d{1,2})(?:\s?h)?(?![\d:])/i);
    if (m && +m[1] < 24) { out.time = `${pad(m[1])}:00`; s = s.replace(m[0], " "); }
  }

  const now = new Date();
  const rel = [[/\spasado mañana\b/i, 2], [/\smañana\b/i, 1], [/\shoy\b/i, 0]];
  for (const [re, n] of rel) {
    const r = s.match(re);
    if (r) { out.due = iso(addDays(now, n)); s = s.replace(r[0], " "); break; }
  }
  if (!out.due) {
    const w = s.match(/\s(?:el |este |próximo |proximo )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
    if (w) {
      const target = WEEKDAYS.findIndex((d) => norm(d) === norm(w[1]));
      let diff = (target - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      out.due = iso(addDays(now, diff));
      s = s.replace(w[0], " ");
    }
  }
  if (!out.due) {
    const dm = s.match(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/);
    if (dm && +dm[1] >= 1 && +dm[1] <= 31 && +dm[2] >= 1 && +dm[2] <= 12) {
      let y = dm[3] ? +dm[3] : now.getFullYear();
      if (y < 100) y += 2000;
      let d = new Date(y, +dm[2] - 1, +dm[1]);
      if (!dm[3] && iso(d) < todayISO()) d = new Date(y + 1, +dm[2] - 1, +dm[1]);
      out.due = iso(d);
      s = s.replace(dm[0], " ");
    }
  }
  out.title = s.replace(/\s+/g, " ").trim();
  return out;
}

function quickDefaults(p) {
  const res = { ...p };
  if (!res.due) {
    if (view === "today") res.due = todayISO();
    else if (view === "upcoming") res.due = iso(addDays(new Date(), 1));
  }
  if (!res.category && view.startsWith("cat:")) res.category = view.slice(4);
  return res;
}

function renderQuickPreview() {
  const val = $("#quick-input").value;
  const box = $("#quick-preview");
  if (!val.trim()) { box.innerHTML = ""; return; }
  const p = parseQuick(val);
  const chips = [];
  if (p.due) chips.push(`<span class="tag tag--due">${icon("calendar")}${relDay(p.due)}${p.time ? " · " + p.time : ""}</span>`);
  else if (p.time) chips.push(`<span class="tag tag--due">${icon("clock")}${p.time}</span>`);
  if (p.due && p.time) chips.push(`<span class="tag tag--bell">${icon("bell")}Aviso 15 min antes</span>`);
  if (p.priority) chips.push(`<span class="tag tag--prio-${p.priority}">${PRIORITY_LABEL[p.priority]}</span>`);
  if (p.category) { const c = catById(p.category); chips.push(`<span class="tag tag--cat" style="--c:${c.color}"><i></i>${esc(c.name)}</span>`); }
  box.innerHTML = chips.join("");
}

/* ===== Render: navegación ===== */
function counts() {
  const td = todayISO();
  const pending = state.tasks.filter((t) => !t.done);
  const byCat = {};
  pending.forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + 1; });
  return {
    today: pending.filter((t) => t.due && t.due <= td).length,
    overdue: pending.filter(isOverdue).length,
    upcoming: pending.filter((t) => t.due && t.due > td).length,
    all: pending.length,
    byCat,
  };
}

let pillReady = false;
function renderNav() {
  const c = counts();
  const num = { today: c.today, upcoming: c.upcoming, all: c.all };
  $("#nav").innerHTML = VIEWS.map((v) => {
    const n = num[v.id];
    const alert = v.id === "today" && c.overdue ? " is-alert" : "";
    return `<button type="button" class="nav-item ${view === v.id ? "is-active" : ""}" data-action="view" data-view="${v.id}" ${view === v.id ? 'aria-current="page"' : ""}>
      ${icon(v.icon)}<span>${v.label}</span>${n ? `<em class="nav-count${alert}">${n}</em>` : ""}</button>`;
  }).join("");

  $("#nav-cats").innerHTML = state.categories.map((cat) => {
    const id = "cat:" + cat.id;
    const n = c.byCat[cat.id];
    return `<div class="nav-row">
      <button type="button" class="nav-item ${view === id ? "is-active" : ""}" data-action="view" data-view="${id}" style="--c:${cat.color}">
        <i class="dot" style="--c:${cat.color}"></i><span class="nav-name">${esc(cat.name)}</span>${n ? `<em class="nav-count">${n}</em>` : ""}
      </button>
      <button type="button" class="nav-edit" data-action="edit-cat" data-cat="${cat.id}" aria-label="Editar proyecto ${esc(cat.name)}">${icon("edit")}</button>
    </div>`;
  }).join("");
  if (typeof renderGroupNav === "function") renderGroupNav();
  movePill();
}

function movePill() {
  const pill = $("#nav-pill"), wrap = $("#nav-wrap");
  const a = $(".nav-item.is-active", wrap);
  if (!a) { pill.style.opacity = 0; return; }
  const w = wrap.getBoundingClientRect(), r = a.getBoundingClientRect();
  if (!r.width) { pill.style.opacity = 0; return; }
  if (!pillReady) pill.classList.add("no-anim");
  pill.style.opacity = 1;
  pill.style.width = r.width + "px";
  pill.style.height = r.height + "px";
  pill.style.transform = `translate(${r.left - w.left}px, ${r.top - w.top}px)`;
  if (!pillReady) { pill.offsetWidth; pill.classList.remove("no-anim"); pillReady = true; }
}

/* ===== Render: cabecera, héroe, filtros ===== */
function viewTitle() {
  if (query) return `Resultados`;
  if (view.startsWith("cat:")) return catById(view.slice(4)).name;
  return { today: "Hoy", upcoming: "Próximas", calendar: "Calendario", all: "Todas las tareas", done: "Hechas" }[view];
}

function renderHead() {
  const pending = state.tasks.filter((t) => !t.done).length;
  $("#view-title").textContent = viewTitle();
  let eyebrow;
  if (query) eyebrow = `“${query}”`;
  else if (view === "today") eyebrow = cap(new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
  else if (view === "calendar") eyebrow = "Planifica tu mes";
  else if (view === "done") eyebrow = `${state.tasks.filter((t) => t.done).length} completadas`;
  else eyebrow = `${view === "all" ? pending : state.tasks.filter((t) => !t.done && (view === "upcoming" ? t.due > todayISO() : t.category === view.slice(4))).length} pendientes`;
  $("#eyebrow").textContent = eyebrow;
}

function streak() {
  let n = 0, d = new Date();
  if (!state.done[iso(d)]) d = addDays(d, -1);
  while (state.done[iso(d)] > 0) { n++; d = addDays(d, -1); }
  return n;
}

let lastRing = 326.73;
function projectHeroHTML(catId) {
  const cat = catById(catId), ts = state.tasks.filter((t) => t.category === catId);
  const done = ts.filter((t) => t.done).length, total = ts.length, pct = total ? Math.round((done / total) * 100) : 0;
  const over = ts.filter(isOverdue).length;
  const next = ts.filter((t) => !t.done && t.due).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || "")))[0];
  return `<section class="hero glass spot project-hero" style="--c:${cat.color}">
    <div class="hero__text">
      <p class="hero__hi">${icon("lock")} Proyecto privado · solo tú lo ves</p>
      <h2 class="hero__msg"><b>${done}</b> de <b>${total}</b> ${total === 1 ? "tarea hecha" : "tareas hechas"}${over ? ` · <b class="alert">${over} ${over === 1 ? "vencida" : "vencidas"}</b>` : ""}</h2>
      <div class="proj-bar" role="img" aria-label="${pct}% completado"><i style="width:${pct}%"></i></div>
      <div class="hero__chips"><span class="chip-stat">${icon("calendar")}${next ? `Próximo plazo: ${relDay(next.due)}${next.time ? " " + next.time : ""}` : "Sin plazos próximos"}</span></div>
    </div>
    <div class="ring" role="img" aria-label="${pct}%"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${(326.73 * (1 - pct / 100)).toFixed(1)};stroke:${cat.color}"/></svg><div class="ring__txt"><strong>${pct}%</strong><span>listo</span></div></div>
  </section>`;
}

function renderHero() {
  const area = $("#hero-area");
  const show = !query && (view === "today" || view === "all");
  if (!query && view.startsWith("cat:")) { area.innerHTML = projectHeroHTML(view.slice(4)); return; }
  if (!show) { area.innerHTML = ""; return; }

  const td = todayISO();
  const c = counts();
  const todays = state.tasks.filter((t) => t.due === td);
  const todaysDone = todays.filter((t) => t.done).length;
  const pct = todays.length ? todaysDone / todays.length : 0;
  const doneToday = state.done[td] || 0;
  const weekDone = Array.from({ length: 7 }, (_, i) => state.done[iso(addDays(new Date(), -i))] || 0).reduce((a, b) => a + b, 0);
  const h = new Date().getHours();
  const hi = h < 6 ? "Buenas noches" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
  const left = todays.length - todaysDone;
  let msg;
  if (todays.length && !left && !c.overdue) msg = `<b>Todo hecho por hoy.</b> Buen trabajo.`;
  else if (!todays.length && !c.overdue) msg = `Hoy no tienes nada planificado. <b>Día despejado.</b>`;
  else {
    const parts = [];
    if (left) parts.push(`<b>${left} ${left === 1 ? "tarea" : "tareas"}</b> para hoy`);
    if (c.overdue) parts.push(`<b class="alert">${c.overdue} ${c.overdue === 1 ? "vencida" : "vencidas"}</b>`);
    msg = `Tienes ${parts.join(" y ")}.`;
  }
  const st = streak();
  const target = 326.73 * (1 - pct);

  area.innerHTML = `
    <section class="hero glass spot">
      <div class="hero__text">
        <p class="hero__hi">${hi}</p>
        <h2 class="hero__msg">${msg}</h2>
        <div class="hero__chips">
          ${st ? `<span class="chip-stat chip-stat--flame">${icon("flame")}Racha de ${st} ${st === 1 ? "día" : "días"}</span>` : ""}
          <span class="chip-stat">${icon("check")}${doneToday} ${doneToday === 1 ? "completada" : "completadas"} hoy</span>
        </div>
      </div>
      <div class="ring" role="img" aria-label="${Math.round(pct * 100)}% de las tareas de hoy completadas">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${lastRing}" data-target="${target}"/></svg>
        <div class="ring__txt"><strong>${Math.round(pct * 100)}%</strong><span>hoy</span></div>
      </div>
    </section>
    <div class="stats" style="margin-top:.75rem">
      <div class="stat spot"><div class="stat__label"><i style="--c:var(--accent)"></i>Pendientes</div><div class="stat__value">${c.all}</div></div>
      <div class="stat spot"><div class="stat__label"><i style="--c:var(--ring-medium)"></i>Para hoy</div><div class="stat__value">${c.today - c.overdue < 0 ? 0 : c.today - c.overdue}</div></div>
      <div class="stat spot"><div class="stat__label"><i style="--c:var(--danger)"></i>Vencidas</div><div class="stat__value">${c.overdue}</div></div>
      <div class="stat spot"><div class="stat__label"><i style="--c:var(--ok)"></i>Últimos 7 días</div><div class="stat__value">${weekDone}</div></div>
    </div>`;
  const fg = $(".ring-fg", area);
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = target; }));
  lastRing = target;
}

function renderFilters() {
  const f = $("#filters");
  const showQuick = !["calendar", "done"].includes(view) || query;
  $("#quick-form").hidden = !showQuick;
  if (view === "calendar" && !query) { f.innerHTML = ""; return; }
  if (view === "done" && !query) {
    f.innerHTML = state.tasks.some((t) => t.done)
      ? `<span></span><button type="button" class="btn btn--ghost btn--sm" data-action="clear-done">${icon("trash")} Borrar completadas</button>` : "";
    return;
  }
  const opts = [["all", "Todas"], ["alta", "Alta"], ["media", "Media"], ["baja", "Baja"]];
  f.innerHTML = `<div class="seg" style="--n:4;--i:${opts.findIndex((o) => o[0] === prioFilter)}" role="group" aria-label="Filtrar por importancia">
    ${opts.map(([v, l]) => `<button type="button" data-action="filter" data-value="${v}" aria-pressed="${prioFilter === v}">${l}</button>`).join("")}</div>`;
}

/* ===== Render: tareas ===== */
function highlight(text) {
  const safe = esc(text);
  if (!query) return safe;
  const pattern = esc(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${pattern})`, "gi"), "<mark>$1</mark>");
}

function matches(t) {
  if (!query) return true;
  const q = norm(query);
  return norm(t.title).includes(q) || norm(t.description).includes(q) ||
    norm(catById(t.category).name).includes(q) || t.subtasks.some((s) => norm(s.text).includes(q));
}

function taskItem(t, i = 0, opts = {}) {
  const cat = catById(t.category);
  const subs = t.subtasks;
  const subDone = subs.filter((s) => s.done).length;
  const overdue = isOverdue(t);
  const isToday = t.due === todayISO() && !overdue && !t.done;
  const open = expanded.has(t.id);
  const cls = [
    "task", t.done ? "is-done" : "", overdue ? "is-overdue" : "",
    t.id === newId ? "is-new" : animateList ? "enter" : "",
  ].join(" ");

  const tags = [];
  tags.push(`<button type="button" class="tag tag--prio-${t.priority}" data-action="prio" title="Cambiar importancia" aria-label="Importancia ${PRIORITY_LABEL[t.priority]}. Pulsa para cambiar">${PRIORITY_LABEL[t.priority]}</button>`);
  if (t.due && !opts.hideDate) tags.push(`<span class="tag tag--due ${overdue ? "is-overdue" : isToday ? "is-today" : ""}">${icon("calendar")}${dueLabel(t)}</span>`);
  else if (t.due && t.time) tags.push(`<span class="tag tag--due ${overdue ? "is-overdue" : ""}">${icon("clock")}${esc(t.time)}</span>`);
  if (t.remindTs && !t.done) tags.push(`<span class="tag tag--bell" title="${t.reminded ? "Recordatorio enviado" : "Recordatorio programado"}">${icon("bell")}${REMINDERS.find((r) => r[0] === String(t.reminder))?.[1].replace("Sin recordatorio", "") || ""}</span>`);
  if (t.repeat !== "none") tags.push(`<span class="tag" title="Se repite">${icon("repeat")}${REPEATS.find((r) => r[0] === t.repeat)[1].replace("Cada ", "")}</span>`);
  if (subs.length) tags.push(`<button type="button" class="tag tag--subs" data-action="expand" aria-expanded="${open}" title="Mostrar subtareas">${icon("subs")}${subDone}/${subs.length}<span class="bar"><i style="--p:${Math.round((subDone / subs.length) * 100)}%"></i></span></button>`);
  if (!opts.hideCat) tags.push(`<span class="tag tag--cat" style="--c:${cat.color}"><i></i>${esc(cat.name)}</span>`);

  return `<li class="${cls}" data-id="${esc(t.id)}" data-priority="${t.priority}" style="--i:${Math.min(i, 12)}">
    <button type="button" class="task__check" data-action="toggle" aria-label="${t.done ? "Marcar como pendiente" : "Marcar como hecha"}" aria-pressed="${t.done}">${CHECK_SVG}</button>
    <div class="task__body">
      <button type="button" class="task__title" data-action="edit">${highlight(t.title)}</button>
      ${t.description ? `<p class="task__desc">${highlight(t.description)}</p>` : ""}
      <div class="task__meta">${tags.join("")}</div>
      ${open && subs.length ? `<ul class="subtasks">${subs.map((s) => `<li class="${s.done ? "is-sub-done" : ""}" data-sub="${s.id}">
        <button type="button" class="sub-check" data-action="sub-toggle" aria-label="${s.done ? "Desmarcar" : "Marcar"} subtarea" aria-pressed="${s.done}">${CHECK_SVG}</button><span class="sub-text">${highlight(s.text)}</span></li>`).join("")}</ul>` : ""}
    </div>
    <div class="task__actions">
      ${t.due && !t.done && typeof canPushCalendar === "function" && canPushCalendar() ? `<button type="button" class="icon-btn icon-btn--sm" data-action="push-cal" aria-label="Enviar al calendario" title="${t.ext && Object.keys(t.ext).length ? "Actualizar en el calendario" : "Enviar al calendario"}">${icon("calplus")}</button>` : ""}
      <button type="button" class="icon-btn icon-btn--sm" data-action="edit" aria-label="Editar tarea" title="Editar">${icon("edit")}</button>
      <button type="button" class="icon-btn icon-btn--sm" data-action="delete" aria-label="Eliminar tarea" title="Eliminar">${icon("trash")}</button>
    </div>
  </li>`;
}

function emptyState() {
  if (query) return { ic: "search", h: "Sin resultados", p: `No hay tareas que coincidan con “${esc(query)}”.` };
  const m = {
    today: { ic: "sparkle", h: "Todo al día", p: "No tienes tareas para hoy. Añade una arriba o planifica algo en el calendario." },
    upcoming: { ic: "clock", h: "Nada en el horizonte", p: "Las tareas con fecha futura aparecerán aquí." },
    all: { ic: "inbox", h: "Aún no hay tareas", p: "Crea tu primera tarea o carga unas de ejemplo para ver cómo funciona.", seed: true },
    done: { ic: "check", h: "Todavía nada completado", p: "Cuando marques tareas como hechas, las verás aquí." },
  };
  return m[view] || { ic: "inbox", h: "Proyecto vacío", p: "No hay tareas en este proyecto todavía." };
}

function renderList() {
  const area = $("#list-area");
  const td = todayISO();
  let pending = [], done = [];

  if (query) {
    const m = state.tasks.filter(matches);
    pending = m.filter((t) => !t.done); done = m.filter((t) => t.done);
  } else if (view === "today") {
    pending = state.tasks.filter((t) => !t.done && t.due && t.due <= td);
    done = state.tasks.filter((t) => t.done && t.completedAt && iso(new Date(t.completedAt)) === td);
  } else if (view === "upcoming") pending = state.tasks.filter((t) => !t.done && t.due > td);
  else if (view === "all") pending = state.tasks.filter((t) => !t.done);
  else if (view === "done") done = state.tasks.filter((t) => t.done);
  else if (view.startsWith("cat:")) {
    const id = view.slice(4);
    pending = state.tasks.filter((t) => !t.done && t.category === id);
    done = state.tasks.filter((t) => t.done && t.category === id);
  }

  if (prioFilter !== "all") {
    pending = pending.filter((t) => t.priority === prioFilter);
    done = done.filter((t) => t.priority === prioFilter);
  }
  pending.sort(cmp);
  done.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  let html = "", idx = 0;
  SECTIONS.forEach(([key, label]) => {
    const items = pending.filter((t) => sectionOf(t) === key);
    if (!items.length) return;
    html += `<section class="group"><h3 class="group__title ${key === "overdue" ? "is-alert" : ""}">${label}<span class="count">${items.length}</span></h3>
      <ul class="task-list">${items.map((t) => taskItem(t, idx++)).join("")}</ul></section>`;
  });

  if (done.length) {
    const list = `<ul class="task-list">${done.map((t) => taskItem(t, idx++)).join("")}</ul>`;
    html += view === "done"
      ? list
      : `<details class="fold" ${doneOpen ? "open" : ""}><summary>${view === "today" && !query ? "Completadas hoy" : "Completadas"}<span class="count">${done.length}</span></summary>${list}</details>`;
  }

  if (!html) {
    const e = emptyState();
    html = `<div class="empty"><div class="empty__ic">${icon(e.ic)}</div><h3>${e.h}</h3><p>${e.p}</p>
      ${e.seed ? `<button type="button" class="btn btn--primary" data-action="seed">${icon("sparkle")} Cargar ejemplos</button>` : ""}</div>`;
  }
  area.innerHTML = html;
}

/* ===== Render: calendario ===== */
function renderCalendar() {
  const area = $("#calendar-area");
  const first = calMonth;
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const byDay = {};
  state.tasks.forEach((t) => { if (t.due) (byDay[t.due] ||= []).push(t); });
  const extByDay = {};
  extEvents.forEach((ev) => (extByDay[ev.day] ||= []).push(ev));
  const td = todayISO();
  const chipTask = (t) => `<div class="cal-chip ${t.done ? "is-done" : ""}" draggable="true" data-id="${t.id}" data-priority="${t.priority}" style="--c:${catById(t.category).color}" title="${esc(t.title)}"><i></i><span>${esc(t.title)}</span></div>`;
  const chipExt = (ev) => `<div class="cal-chip cal-chip--ext" data-url="${esc(ev.url || "")}" data-priority="media" style="--c:${EXT_COLORS[ev.src]}" title="${esc(SRC_LABEL[ev.src] + ": " + ev.title)}"><i></i><span>${ev.time ? ev.time + " " : ""}${esc(ev.title)}</span></div>`;

  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), key = iso(d);
    const list = (byDay[key] || []).slice().sort((a, b) => Number(a.done) - Number(b.done) || cmp(a, b));
    const ext = (extByDay[key] || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const chips = [...list.map(chipTask), ...ext.map(chipExt)];
    const classes = ["cal-cell", d.getMonth() !== first.getMonth() ? "is-other" : "", key === td ? "is-today" : "", key === calSelected ? "is-selected" : ""].join(" ");
    const lab = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    cells += `<div class="${classes}" role="gridcell" tabindex="0" data-day="${key}" aria-label="${lab}, ${list.length} tareas${ext.length ? `, ${ext.length} eventos` : ""}" aria-selected="${key === calSelected}">
      <span class="cal-cell__num">${d.getDate()}</span>
      <div class="cal-cell__chips">${chips.slice(0, 3).join("")}
      ${chips.length > 3 ? `<span class="cal-more">+${chips.length - 3} más</span>` : ""}</div>
    </div>`;
  }

  const title = cap(calMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
  const dayTasks = (byDay[calSelected] || []).slice().sort((a, b) => Number(a.done) - Number(b.done) || cmp(a, b));
  const dayLabel = cap(fromISO(calSelected).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
  const dayPending = dayTasks.filter((t) => !t.done).length;

  area.innerHTML = `
    <section class="cal glass" aria-label="Calendario mensual">
      <div class="cal__head">
        <h2 class="cal__title">${title}</h2>
        <div class="cal__nav">
          <button type="button" class="icon-btn" data-action="cal-prev" aria-label="Mes anterior">${icon("left")}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="cal-today">Hoy</button>
          <button type="button" class="icon-btn" data-action="cal-next" aria-label="Mes siguiente">${icon("right")}</button>
        </div>
      </div>
      <div class="cal__dow" aria-hidden="true">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal__grid ${calDir}" role="grid">${cells}</div>
    </section>
    <section class="day-panel glass" aria-label="Tareas del día seleccionado">
      <div class="day-panel__head">
        <div><h2>${dayLabel}</h2><p>${dayTasks.length ? `${dayPending} pendientes · ${dayTasks.length - dayPending} hechas` : "Sin tareas este día"}</p></div>
        <button type="button" class="btn btn--primary btn--sm" data-action="new-task" data-day="${calSelected}">${icon("plus")} Añadir</button>
      </div>
      ${extDayHTML(calSelected)}
      ${dayTasks.length
        ? `<ul class="task-list">${dayTasks.map((t, i) => taskItem(t, i, { hideDate: true })).join("")}</ul>`
        : extEvents.some((e) => e.day === calSelected) ? "" : `<div class="empty" style="padding:1.6rem"><p>Arrastra una tarea del calendario hasta aquí o pulsa “Añadir”.</p></div>`}
    </section>`;
  calDir = "";
}

function extDayHTML(day) {
  const evs = extEvents.filter((e) => e.day === day).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  if (!evs.length) return "";
  return `<ul class="ext-list" aria-label="Eventos de tus calendarios">${evs.map((e) => `<li class="ext-item" style="--c:${EXT_COLORS[e.src]}">
    <i></i><span class="ext-time">${e.allDay ? "Todo el día" : e.time + (e.end ? "–" + e.end : "")}</span><span class="ext-title">${esc(e.title)}</span><span class="tag">${SRC_LABEL[e.src]}</span>
    ${e.url ? `<a class="icon-btn icon-btn--sm" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir en ${SRC_LABEL[e.src]}">${icon("link")}</a>` : ""}
    <button type="button" class="icon-btn icon-btn--sm" data-action="ext-task" data-ext="${esc(e.id)}" aria-label="Crear tarea desde este evento" title="Crear tarea">${icon("plus")}</button></li>`).join("")}</ul>`;
}

/* ===== Render: panel derecho ===== */
function renderRail() {
  const now = Date.now();
  const rem = state.tasks.filter((t) => !t.done && t.remindTs && t.remindTs > now).sort((a, b) => a.remindTs - b.remindTs).slice(0, 4);
  $("#rem-list").innerHTML = rem.length
    ? rem.map((t) => {
      const d = new Date(t.remindTs);
      const label = `${relDay(iso(d))} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return `<li><button type="button" class="mini-item" data-action="open-task" data-id="${t.id}"><span class="mini-item__ic">${icon("bell")}</span><span><span class="mini-item__t">${esc(t.title)}</span><span class="mini-item__s">${label}</span></span></button></li>`;
    }).join("")
    : `<li class="mini-empty">Nada programado. Añade un recordatorio a una tarea con fecha.</li>`;

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
  const vals = days.map((d) => state.done[iso(d)] || 0);
  const max = Math.max(3, ...vals);
  $("#week-total").textContent = `${vals.reduce((a, b) => a + b, 0)} completadas`;
  $("#week-bars").innerHTML = days.map((d, i) => `<div class="bar-col" title="${cap(d.toLocaleDateString("es-ES", { weekday: "long" }))}: ${vals[i]}">
    <b>${vals[i] || ""}</b><div class="bar ${i === 6 ? "is-today" : ""}" style="--h:${Math.round((vals[i] / max) * 80)}px"></div>
    <em>${"DLMXJVS"[d.getDay()]}</em></div>`).join("");

  $("#timer-sessions").textContent = (state.pomo[todayISO()] || 0)
    ? `${state.pomo[todayISO()]} ${state.pomo[todayISO()] === 1 ? "sesión" : "sesiones"} de enfoque hoy` : "Sin sesiones hoy";
}

/* ===== Render general ===== */
function render() {
  const inGroup = view.startsWith("grp:") && typeof groupsRender === "function";
  document.body.classList.toggle("in-group", inGroup);
  if (inGroup) { // vista de grupo (groups.js): el contenido principal lo pinta ese módulo
    renderNav(); renderRail(); renderBell(); syncSettings(); updateTitle(); groupsRender();
    animateList = false; newId = null;
    return;
  }
  const calendarMode = view === "calendar" && !query;
  renderNav();
  renderHead();
  renderHero();
  renderFilters();
  $("#list-area").hidden = calendarMode;
  $("#calendar-area").hidden = !calendarMode;
  if (calendarMode) renderCalendar(); else renderList();
  renderRail();
  renderBell();
  syncSettings();
  updateTitle();
  if (typeof renderIntegrations === "function") renderIntegrations();
  if (calendarMode && typeof refreshExternalSoon === "function") refreshExternalSoon();
  animateList = false;
  newId = null;
}

function updateTitle() {
  if (timer.running) return;
  const n = counts().overdue;
  document.title = n ? `(${n}) TaskFlow · Tareas y recordatorios` : "TaskFlow · Tareas, calendario y recordatorios";
}

function setView(v) {
  if (v === view && !query) return;
  view = v; prioFilter = "all"; animateList = true;
  if (query) { query = ""; $("#search").value = ""; }
  if (v === "calendar") { calMonth = startOfMonth(new Date()); calSelected = todayISO(); }
  render();
  $("#main").scrollIntoView?.({ block: "start" });
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/* ===== Iconos estáticos ===== */
function hydrateIcons(root = document) {
  $$("[data-icon]", root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute("data-icon"); });
}

/* ===== Tema ===== */
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
function effectiveTheme() {
  return state.settings.theme === "auto" ? (darkMQ.matches ? "dark" : "light") : state.settings.theme;
}
function applyTheme() {
  const eff = effectiveTheme();
  document.documentElement.dataset.theme = eff;
  document.documentElement.dataset.accent = state.settings.accent;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = eff === "dark" ? "#0b0c16" : "#e8ebf6";
  $("#btn-theme").innerHTML = icon(eff === "dark" ? "sun" : "moon");
}
darkMQ.addEventListener("change", applyTheme);

function syncSettings() {
  const themes = ["auto", "light", "dark"];
  const seg = $("#set-theme");
  seg.style.setProperty("--i", themes.indexOf(state.settings.theme));
  $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", b.dataset.theme === state.settings.theme));
  $$("#set-accent button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.accent === state.settings.accent));
  $("#set-sound").setAttribute("aria-checked", state.settings.sound);
  const supported = "Notification" in window;
  const perm = supported ? Notification.permission : "unsupported";
  const btn = $("#set-notif");
  btn.textContent = perm === "granted" ? "Activados" : perm === "denied" ? "Bloqueados" : supported ? "Activar" : "No disponible";
  btn.disabled = perm !== "default";
  btn.style.opacity = perm === "default" ? 1 : .6;
  $("#notif-foot").innerHTML = perm === "default"
    ? `<button type="button" class="btn btn--soft btn--sm" data-action="enable-notif">${icon("bell")} Activar avisos del sistema</button>` : "";
}

/* ===== Sonido y confeti ===== */
let audioCtx;
function tone(notes, vol = .12) {
  if (!state.settings.sound) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    notes.forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + d);
      g.gain.linearRampToValueAtTime(vol, t0 + d + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .55);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d); o.stop(t0 + d + .6);
    });
  } catch { /* audio no disponible */ }
}
const chime = () => tone([[880, 0], [1174.7, .14], [1568, .28]], .12);

const cv = $("#confetti"), cx = cv.getContext("2d");
let parts = [], raf = 0;
function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
addEventListener("resize", () => { sizeCanvas(); movePill(); });

function burst(x, y) {
  if (reduceMotion) return;
  const colors = [getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6B74F5", "#FF7D8C", "#F5C038", "#2EC4A6", "#A86BFF", "#3DB8F5"];
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, r: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 5 + Math.random() * 5, c: colors[i % colors.length], life: 1 });
  }
  if (!raf) raf = requestAnimationFrame(confettiLoop);
}
function confettiLoop() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  parts.forEach((p) => {
    p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= .017;
    cx.save(); cx.globalAlpha = Math.max(p.life, 0); cx.translate(p.x, p.y); cx.rotate(p.r);
    cx.fillStyle = p.c; cx.beginPath(); cx.roundRect ? cx.roundRect(-p.w / 2, -p.w / 4, p.w, p.w / 2, 2) : cx.rect(-p.w / 2, -p.w / 4, p.w, p.w / 2); cx.fill(); cx.restore();
  });
  raf = parts.length ? requestAnimationFrame(confettiLoop) : 0;
  if (!raf) cx.clearRect(0, 0, innerWidth, innerHeight);
}

/* ===== Toast ===== */
let toastTimer, toastFn = null;
function showToast(message, action) {
  $("#toast-msg").textContent = message;
  const btn = $("#toast-action");
  btn.textContent = action ? action.label : "";
  toastFn = action ? action.fn : null;
  $("#toast").classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 5500);
}
function hideToast() { $("#toast").classList.remove("is-visible"); }
$("#toast-action").addEventListener("click", () => { if (toastFn) toastFn(); hideToast(); });

/* ===== Diálogos ===== */
let lastFocus = null;
function openDialog(dlg) {
  lastFocus = document.activeElement;
  closePopovers();
  if (!dlg.open) dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add("is-open")));
}
function closeDialog(dlg) {
  if (!dlg.open) return;
  dlg.classList.remove("is-open");
  setTimeout(() => { if (dlg.open) dlg.close(); lastFocus?.focus?.({ preventScroll: true }); }, reduceMotion ? 0 : 220);
}
$$("dialog.sheet").forEach((dlg) => {
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(dlg); });
  dlg.addEventListener("mousedown", (e) => { if (e.target === dlg) closeDialog(dlg); });
  $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => closeDialog(dlg)));
});

/* ===== Formulario de tarea ===== */
const taskDlg = $("#task-dialog");
const fTitle = $("#f-title");

function syncSeg(seg) {
  const inputs = $$("input", seg);
  seg.style.setProperty("--i", Math.max(0, inputs.findIndex((i) => i.checked)));
}
$("#f-prio").addEventListener("change", (e) => syncSeg(e.currentTarget));

function subRow(s = { id: uid(), text: "", done: false }) {
  const row = document.createElement("div");
  row.className = "sub-row";
  row.dataset.id = s.id; row.dataset.done = s.done ? "1" : "";
  row.innerHTML = `<div class="field" style="flex:1"><input type="text" maxlength="80" placeholder="Describe el paso…" aria-label="Subtarea" value="${esc(s.text)}"></div>
    <button type="button" class="icon-btn icon-btn--sm" aria-label="Quitar subtarea" data-sub-remove>${icon("x")}</button>`;
  return row;
}

function openTask(id, defaults = {}) {
  editingId = id || null;
  const t = id ? get(id) : null;
  $("#dlg-title").textContent = t ? "Editar tarea" : "Nueva tarea";
  $("#f-submit").textContent = t ? "Guardar cambios" : "Crear tarea";
  $("#f-delete").hidden = !t;
  $("#f-error").textContent = "";

  $("#f-cat").innerHTML = state.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("#f-reminder").innerHTML = REMINDERS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  $("#f-repeat").innerHTML = REPEATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

  const d = { priority: "media", category: view.startsWith("cat:") ? view.slice(4) : state.categories[0].id, ...defaults, ...(t || {}) };
  fTitle.value = t ? t.title : "";
  $("#f-desc").value = d.description || "";
  $("#f-due").value = d.due || "";
  $("#f-time").value = d.time || "";
  $("#f-reminder").value = d.reminder ?? "";
  $("#f-repeat").value = d.repeat || "none";
  $("#f-cat").value = d.category;
  $(`#f-prio input[value="${d.priority}"]`).checked = true;
  syncSeg($("#f-prio"));
  const list = $("#sub-list");
  list.innerHTML = "";
  (t ? t.subtasks : []).forEach((s) => list.append(subRow(s)));
  openDialog(taskDlg);
  setTimeout(() => fTitle.focus({ preventScroll: true }), 80);
}

$("#sub-add").addEventListener("click", () => {
  const row = subRow(); $("#sub-list").append(row); $("input", row).focus();
});
$("#sub-list").addEventListener("click", (e) => { const b = e.target.closest("[data-sub-remove]"); if (b) b.closest(".sub-row").remove(); });
$("#sub-list").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  const row = subRow(); e.target.closest(".sub-row").after(row); $("input", row).focus();
});

$("#quick-dates").addEventListener("click", (e) => {
  const b = e.target.closest("[data-qd]"); if (!b) return;
  const v = b.dataset.qd;
  $("#f-due").value = v === "none" ? "" : iso(addDays(new Date(), Number(v)));
  if (v === "none") { $("#f-time").value = ""; }
});

$("#task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = fTitle.value.trim();
  const err = $("#f-error");
  const due = $("#f-due").value, time = $("#f-time").value, reminder = $("#f-reminder").value, repeat = $("#f-repeat").value;
  if (!title) { err.textContent = "El título es obligatorio."; fTitle.focus(); return; }
  if (!due && (reminder !== "" || repeat !== "none" || time)) {
    err.textContent = "Para usar hora, recordatorio o repetición necesitas elegir una fecha."; $("#f-due").focus(); return;
  }
  const subtasks = $$(".sub-row").map((r) => ({ id: r.dataset.id, text: $("input", r).value.trim(), done: !!r.dataset.done })).filter((s) => s.text);
  const data = {
    title, description: $("#f-desc").value.trim(), due, time, reminder, repeat,
    category: $("#f-cat").value, priority: $("#f-prio input:checked").value, subtasks,
  };
  if (editingId) {
    const t = get(editingId);
    const changed = t.due !== due || t.time !== time || String(t.reminder) !== reminder;
    Object.assign(t, data);
    if (changed) { t.reminded = false; t.spawned = false; }
    computeRemind(t);
    commit();
    showToast("Cambios guardados");
    afterSave(t);
  } else {
    afterSave(addTask(data));
    showToast("Tarea creada");
  }
  closeDialog(taskDlg);
  if (reminder !== "") hintNotifications();
});

$("#f-delete").addEventListener("click", () => {
  if (!editingId) return;
  const id = editingId;
  closeDialog(taskDlg);
  setTimeout(() => deleteTasks([id], "Tarea eliminada"), 200);
});

/* ===== Listas (categorías) ===== */
const catDlg = $("#cat-dialog");
function openCat(id) {
  editingCat = id || null;
  const cat = id ? state.categories.find((c) => c.id === id) : null;
  $("#cat-title").textContent = cat ? "Editar proyecto" : "Nuevo proyecto";
  $("#c-name").value = cat ? cat.name : "";
  $("#c-error").textContent = "";
  $("#c-delete").hidden = !cat || state.categories.length < 2;
  const sel = cat ? cat.color : SWATCHES[state.categories.length % SWATCHES.length];
  $("#c-colors").innerHTML = SWATCHES.map((c, i) => `<input type="radio" name="ccolor" id="cc${i}" value="${c}" ${c === sel ? "checked" : ""}><label for="cc${i}" style="--c:${c}" aria-label="Color ${i + 1}"></label>`).join("");
  openDialog(catDlg);
  setTimeout(() => $("#c-name").focus({ preventScroll: true }), 80);
}
$("#cat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#c-name").value.trim();
  if (!name) { $("#c-error").textContent = "Escribe un nombre para el proyecto."; return; }
  if (state.categories.some((c) => norm(c.name) === norm(name) && c.id !== editingCat)) { $("#c-error").textContent = "Ya existe un proyecto con ese nombre."; return; }
  const color = $("#c-colors input:checked")?.value || SWATCHES[0];
  if (editingCat) { Object.assign(state.categories.find((c) => c.id === editingCat), { name, color }); }
  else { const id = "c" + Date.now().toString(36); state.categories.push({ id, name, color }); view = "cat:" + id; animateList = true; }
  commit(); closeDialog(catDlg);
});
$("#c-delete").addEventListener("click", () => {
  if (!editingCat || state.categories.length < 2) return;
  const fallback = state.categories.find((c) => c.id !== editingCat).id;
  state.tasks.forEach((t) => { if (t.category === editingCat) t.category = fallback; });
  state.categories = state.categories.filter((c) => c.id !== editingCat);
  if (view === "cat:" + editingCat) view = "today";
  commit(); closeDialog(catDlg);
  showToast("Proyecto eliminado. Sus tareas pasaron a otro proyecto.");
});

/* ===== Recordatorios ===== */
function showBanner({ eyebrow = "Recordatorio", title, sub = "", taskId = "", actions = true }) {
  const el = document.createElement("div");
  el.className = "banner glass";
  if (taskId) el.dataset.id = taskId;
  el.innerHTML = `<div class="banner__ic">${icon("bell")}</div>
    <div class="banner__body"><p class="banner__eyebrow">${esc(eyebrow)}</p><p class="banner__title">${esc(title)}</p>${sub ? `<p class="banner__sub">${esc(sub)}</p>` : ""}
    ${taskId && actions ? `<div class="banner__actions"><button type="button" class="btn btn--primary btn--sm" data-action="banner-done">Hecha</button><button type="button" class="btn btn--soft btn--sm" data-action="banner-snooze">Posponer 10 min</button></div>` : ""}</div>
    <button type="button" class="icon-btn icon-btn--sm" data-action="banner-close" aria-label="Cerrar aviso">${icon("x")}</button>`;
  const box = $("#banners");
  box.prepend(el);
  while (box.children.length > 4) box.lastElementChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in")));
  if (!taskId) setTimeout(() => dismissBanner(el), 9000);
}
function dismissBanner(el) {
  if (!el || !el.isConnected) return;
  el.classList.remove("is-in");
  setTimeout(() => el.remove(), 380);
}

function pushLog(entry) {
  state.log.unshift({ id: uid(), ts: Date.now(), read: false, ...entry });
  state.log = state.log.slice(0, 40);
}

function sysNotify(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body, tag: title + body, icon: "icon-192.png", badge: "icon-192.png" };
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => new Notification(title, opts));
    else new Notification(title, opts);
  } catch { /* algunos navegadores móviles solo permiten notificaciones desde el service worker */ }
}

function checkReminders() {
  const now = Date.now();
  const due = state.tasks.filter((t) => !t.done && t.remindTs != null && !t.reminded && t.remindTs <= now);
  if (!due.length) return;
  due.sort((a, b) => a.remindTs - b.remindTs).forEach((t, i) => {
    t.reminded = true;
    const late = now - baseTs(t) > 0;
    pushLog({ taskId: t.id, title: t.title, text: late ? `Venció ${dueLabel(t).toLowerCase()}` : `Para ${dueLabel(t).toLowerCase()}` });
    if (i < 3) showBanner({ title: t.title, sub: late ? `Venció ${dueLabel(t).toLowerCase()}` : dueLabel(t), taskId: t.id });
    sysNotify("TaskFlow · Recordatorio", `${t.title} — ${dueLabel(t)}`);
  });
  if (due.length > 3) showBanner({ eyebrow: "Más avisos", title: `Y ${due.length - 3} recordatorios más`, sub: "Consúltalos en la campana." });
  chime();
  save(); render();
}

function renderBell() {
  const unread = state.log.filter((l) => !l.read).length;
  const badge = $("#bell-badge");
  badge.hidden = !unread;
  badge.textContent = unread > 9 ? "9+" : unread;
  $("#log-list").innerHTML = state.log.length
    ? state.log.slice(0, 12).map((l) => `<li class="log-item ${l.read ? "" : "is-unread"}"><div class="mini-item__ic">${icon("bell")}</div>
        <div><p>${esc(l.title)}</p><small>${esc(l.text)} · ${timeAgo(l.ts)}</small></div></li>`).join("")
    : `<li class="log-empty">Aún no ha saltado ningún recordatorio.</li>`;
}
function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "ahora"; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

async function enableNotifications() {
  if (!("Notification" in window)) { showToast("Tu navegador no admite notificaciones del sistema."); return; }
  try {
    const p = await Notification.requestPermission();
    syncSettings();
    if (p === "granted") { showToast("Avisos del sistema activados"); sysNotify("TaskFlow", "Los recordatorios te llegarán aunque esta pestaña esté en segundo plano."); }
    else showToast("No se concedió el permiso de notificaciones.");
  } catch { showToast("No se pudieron activar las notificaciones."); }
}
function hintNotifications() {
  if (notifHinted || !("Notification" in window) || Notification.permission !== "default") return;
  notifHinted = true;
  setTimeout(() => showToast("¿Quieres recibir los avisos aunque cambies de pestaña?", { label: "Activar", fn: enableNotifications }), 900);
}

/* ===== Popovers ===== */
const pops = { bell: ["#btn-bell", "#pop-bell"], settings: ["#btn-settings", "#pop-settings"] };
function closePopovers(except) {
  Object.entries(pops).forEach(([k, [b, p]]) => {
    if (k === except) return;
    $(p).hidden = true; $(b).setAttribute("aria-expanded", "false");
  });
}
function togglePopover(name) {
  const [b, p] = pops[name];
  const pop = $(p), btn = $(b);
  const open = pop.hidden;
  closePopovers(open ? name : undefined);
  pop.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
  if (open) {
    const r = btn.getBoundingClientRect();
    pop.style.top = r.bottom + 10 + "px";
    pop.style.right = Math.max(12, innerWidth - r.right - 6) + "px";
    if (name === "bell") {
      renderBell();
      setTimeout(() => { state.log.forEach((l) => (l.read = true)); save(); $("#bell-badge").hidden = true; }, 1200);
    }
  }
}
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".popover") || e.target.closest("#btn-bell") || e.target.closest("#btn-settings")) return;
  closePopovers();
});

/* ===== Temporizador de enfoque ===== */
const timer = { mode: "focus", dur: { focus: 25 * 60000, break: 5 * 60000 }, running: false, end: 0, left: 25 * 60000 };
const RING_C = 326.73;
function paintTimer() {
  const total = timer.dur[timer.mode];
  const s = Math.ceil(timer.left / 1000);
  const txt = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  $("#timer-time").textContent = txt;
  $("#timer-ring").style.strokeDashoffset = RING_C * (1 - timer.left / total);
  $("#timer-label").textContent = timer.mode === "focus" ? (timer.running ? "Enfocado" : "Concentración") : "Descanso";
  $("#timer-toggle").textContent = timer.running ? "Pausar" : timer.left < total ? "Reanudar" : "Empezar";
  $("#timer").classList.toggle("is-running", timer.running);
  $(".timer", $("#timer")).classList.toggle("is-break", timer.mode === "break");
  $(".timer", $("#timer")).classList.toggle("is-running", timer.running);
  const seg = $("#timer-mode");
  seg.style.setProperty("--i", timer.mode === "focus" ? 0 : 1);
  $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === timer.mode));
  document.title = timer.running ? `${txt} · ${timer.mode === "focus" ? "Enfoque" : "Descanso"}` : document.title.replace(/^\d\d:\d\d · \w+$/, "TaskFlow");
  if (!timer.running) updateTitle();
}
function setTimerMode(mode) {
  timer.mode = mode; timer.running = false; timer.left = timer.dur[mode]; paintTimer();
}
function timerToggle() {
  if (timer.running) { timer.running = false; timer.left = Math.max(0, timer.end - Date.now()); }
  else { timer.running = true; timer.end = Date.now() + timer.left; try { audioCtx?.resume(); } catch { /* */ } }
  paintTimer();
  if (typeof onFocusTimer === "function") onFocusTimer(timer.running, timer.mode);
}
function timerDone() {
  const wasFocus = timer.mode === "focus";
  if (wasFocus) { state.pomo[todayISO()] = (state.pomo[todayISO()] || 0) + 1; save(); renderRail(); }
  chime();
  showBanner({ eyebrow: wasFocus ? "Sesión completada" : "Descanso terminado", title: wasFocus ? "Buen trabajo. Toca descansar 5 minutos." : "Listo para otra sesión de enfoque.", actions: false });
  sysNotify("TaskFlow", wasFocus ? "Sesión de enfoque completada" : "Descanso terminado");
  setTimerMode(wasFocus ? "break" : "focus");
}
setInterval(() => {
  if (!timer.running) return;
  timer.left = Math.max(0, timer.end - Date.now());
  if (timer.left === 0) { timer.running = false; timerDone(); } else paintTimer();
}, 250);

/* ===== Paleta de comandos ===== */
const palDlg = $("#palette");
let palItems = [], palIdx = 0;

function commands() {
  return [
    { g: "Acciones", l: "Nueva tarea", ic: "plus", k: "N", run: () => openTask() },
    { g: "Ir a", l: "Hoy", ic: "today", run: () => setView("today") },
    { g: "Ir a", l: "Próximas", ic: "clock", run: () => setView("upcoming") },
    { g: "Ir a", l: "Calendario", ic: "calendar", run: () => setView("calendar") },
    { g: "Ir a", l: "Todas las tareas", ic: "list", run: () => setView("all") },
    { g: "Ir a", l: "Hechas", ic: "check", run: () => setView("done") },
    ...state.categories.map((c) => ({ g: "Listas", l: c.name, ic: "list", run: () => setView("cat:" + c.id) })),
    { g: "Acciones", l: "Nuevo proyecto", ic: "plus", run: () => openCat() },
    { g: "Acciones", l: timer.running ? "Pausar temporizador" : "Iniciar temporizador de enfoque", ic: "clock", run: timerToggle },
    { g: "Ajustes", l: "Cambiar tema claro/oscuro", ic: "moon", run: toggleTheme },
    { g: "Ajustes", l: "Activar avisos del sistema", ic: "bell", run: enableNotifications },
    { g: "Datos", l: "Exportar copia (JSON)", ic: "download", run: exportJSON },
    { g: "Datos", l: "Exportar calendario (.ics)", ic: "calendar", run: exportICS },
    ...(typeof integrationCommands === "function" ? integrationCommands() : []),
  ];
}

function renderPalette() {
  const q = norm($("#pal-input").value.trim());
  const cmds = commands().filter((c) => !q || norm(c.l).includes(q));
  const tasks = q ? state.tasks.filter((t) => norm(t.title).includes(q)).slice(0, 6).map((t) => ({
    g: "Tareas", l: t.title, ic: t.done ? "check" : "today", s: t.due ? dueLabel(t) : "", run: () => openTask(t.id),
  })) : [];
  palItems = [...tasks, ...cmds];
  palIdx = Math.min(palIdx, Math.max(0, palItems.length - 1));
  let html = "", lastG = "";
  palItems.forEach((it, i) => {
    if (it.g !== lastG) { html += `<li class="pal__group" role="presentation">${it.g}</li>`; lastG = it.g; }
    html += `<li class="pal__item ${i === palIdx ? "is-active" : ""}" role="option" data-i="${i}" aria-selected="${i === palIdx}">${icon(it.ic)}<span>${esc(it.l)}</span>${it.k ? `<small><kbd>${it.k}</kbd></small>` : it.s ? `<small>${esc(it.s)}</small>` : ""}</li>`;
  });
  $("#pal-list").innerHTML = html || `<li class="pal__empty">Sin resultados</li>`;
  $(".pal__item.is-active")?.scrollIntoView({ block: "nearest" });
}
function openPalette() { $("#pal-input").value = ""; palIdx = 0; renderPalette(); openDialog(palDlg); setTimeout(() => $("#pal-input").focus(), 60); }
function runPalette(i) {
  const it = palItems[i]; if (!it) return;
  closeDialog(palDlg);
  setTimeout(it.run, 120);
}
$("#pal-input").addEventListener("input", () => { palIdx = 0; renderPalette(); });
$("#pal-input").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); palIdx = (palIdx + 1) % Math.max(1, palItems.length); renderPalette(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); palIdx = (palIdx - 1 + palItems.length) % Math.max(1, palItems.length); renderPalette(); }
  else if (e.key === "Enter") { e.preventDefault(); runPalette(palIdx); }
});
$("#pal-list").addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) runPalette(+li.dataset.i); });
$("#pal-list").addEventListener("pointermove", (e) => {
  const li = e.target.closest("[data-i]");
  if (li && +li.dataset.i !== palIdx) { palIdx = +li.dataset.i; $$(".pal__item").forEach((n) => { const on = +n.dataset.i === palIdx; n.classList.toggle("is-active", on); n.setAttribute("aria-selected", on); }); }
});

/* ===== Datos: exportar / importar ===== */
function download(name, content, type) {
  if (window.TF_SANDBOX && window.claude && typeof claude.use === "function") { // la página alojada no puede iniciar descargas por sí sola
    claude.use("downloads").then((d) => d ? d.save({ filename: name.replace(/\.ics$/, ".ics.txt"), data: content }).then(() => showToast("Archivo guardado")).catch(() => showToast("Descarga cancelada")) : showToast("Las descargas no están disponibles aquí.")).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(`taskflow-${todayISO()}.json`, JSON.stringify({ app: "taskflow", version: 2, exportedAt: new Date().toISOString(), tasks: state.tasks, categories: state.categories, done: state.done, pomo: state.pomo }, null, 2), "application/json");
  showToast("Copia exportada");
}
function exportICS() {
  const esc2 = (s) => String(s).replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const fmt = (t, ms) => { const d = new Date(ms); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; };
  const rules = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };
  const events = state.tasks.filter((t) => t.due && !t.done).map((t) => {
    const l = ["BEGIN:VEVENT", `UID:${t.id}@taskflow`, `DTSTAMP:${stamp}`];
    if (t.time) { l.push(`DTSTART:${fmt(t, baseTs(t))}`, `DTEND:${fmt(t, baseTs(t) + 30 * 60000)}`); }
    else { const d = t.due.replace(/-/g, ""); l.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${iso(addDays(fromISO(t.due), 1)).replace(/-/g, "")}`); }
    l.push(`SUMMARY:${esc2(t.title)}`);
    if (t.description) l.push(`DESCRIPTION:${esc2(t.description)}`);
    l.push(`CATEGORIES:${esc2(catById(t.category).name)}`);
    if (rules[t.repeat]) l.push(`RRULE:FREQ=${rules[t.repeat]}`);
    if (t.reminder !== "" && t.reminder != null) l.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc2(t.title)}`, `TRIGGER:-PT${Number(t.reminder)}M`, "END:VALARM");
    l.push("END:VEVENT");
    return l.join("\r\n");
  });
  if (!events.length) { showToast("No hay tareas pendientes con fecha para exportar."); return; }
  download("taskflow.ics", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TaskFlow//ES", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n"), "text/calendar");
  showToast(`${events.length} eventos exportados`);
}
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks)) throw new Error("formato");
    (data.categories || []).forEach((c) => { if (c.id && c.name && !state.categories.some((x) => x.id === c.id)) state.categories.push({ id: c.id, name: c.name, color: c.color || SWATCHES[0] }); });
    let n = 0;
    data.tasks.forEach((t) => { if (t && t.title && !get(t.id)) { state.tasks.push(normalize({ ...t })); n++; } });
    Object.entries(data.done || {}).forEach(([k, v]) => { state.done[k] = Math.max(state.done[k] || 0, v); });
    commit(); showToast(`${n} ${n === 1 ? "tarea importada" : "tareas importadas"}`);
  } catch { showToast("No se pudo leer ese archivo."); }
});

/* ===== Ejemplos ===== */
function seed() {
  const d = (n) => iso(addDays(new Date(), n));
  const subs = (...xs) => xs.map(([text, done]) => ({ id: uid(), text, done: !!done }));
  const items = [
    { title: "Enviar factura a Estudio Norte", priority: "alta", category: "trabajo", due: d(-1), time: "12:00", reminder: "0", reminded: true },
    { title: "Revisar propuesta del cliente", description: "Comentar precios y plazos antes de la reunión de las 19:00.", priority: "alta", category: "trabajo", due: d(0), time: "18:00", reminder: "30", subtasks: subs(["Leer el anexo técnico", true], ["Anotar dudas", false], ["Enviar feedback", false]) },
    { title: "Comprar ingredientes para la cena", priority: "baja", category: "casa", due: d(0) },
    { title: "Salir a correr 5 km", priority: "media", category: "salud", due: d(0), time: "20:30", reminder: "15", repeat: "daily" },
    { title: "Cita con el dentista", priority: "media", category: "salud", due: d(1), time: "10:30", reminder: "60" },
    { title: "Reunión de equipo semanal", priority: "media", category: "trabajo", due: d(2), time: "09:30", reminder: "15", repeat: "weekly" },
    { title: "Entregar práctica de estadística", description: "Subir el PDF al campus virtual.", priority: "alta", category: "estudios", due: d(3), time: "23:59", reminder: "1440", subtasks: subs(["Gráficos", false], ["Conclusiones", false]) },
    { title: "Pagar el alquiler", priority: "alta", category: "casa", due: d(6), reminder: "1440", repeat: "monthly" },
    { title: "Planificar las vacaciones de verano", priority: "baja", category: "personal" },
    { title: "Llamar a la abuela", priority: "media", category: "personal", due: d(-2), done: true, completedAt: Date.now() - 36e5 * 26 },
    { title: "Leer capítulo 4 de álgebra", priority: "baja", category: "estudios", due: d(0), done: true, completedAt: Date.now() - 36e5 },
  ];
  items.reverse().forEach((p) => {
    const t = makeTask(p);
    if (t.done) bumpDone(iso(new Date(t.completedAt)), 1);
    state.tasks.unshift(t);
  });
  commit();
  showToast("Ejemplos cargados");
}

/* ===== Eventos globales ===== */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const action = a.dataset.action;
  const row = a.closest(".task");
  const id = row?.dataset.id || a.dataset.id || a.closest(".banner")?.dataset.id;

  switch (action) {
    case "go-home": e.preventDefault(); setView("today"); break;
    case "view": setView(a.dataset.view); break;
    case "new-task": openTask(null, a.dataset.day ? { due: a.dataset.day } : view === "calendar" ? { due: calSelected } : {}); break;
    case "toggle": toggleTask(id, a); break;
    case "edit": openTask(id); break;
    case "open-task": openTask(id); closePopovers(); break;
    case "delete": deleteTasks([id], "Tarea eliminada"); break;
    case "prio": { const t = get(id); if (t) { t.priority = PRIORITY_NEXT[t.priority]; commit(); } break; }
    case "expand": expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); break;
    case "sub-toggle": {
      const t = get(id), s = t?.subtasks.find((x) => x.id === a.closest("[data-sub]").dataset.sub);
      if (s) { s.done = !s.done; commit(); }
      break;
    }
    case "filter": prioFilter = a.dataset.value; animateList = true; render(); break;
    case "clear-done": {
      const ids = state.tasks.filter((t) => t.done).map((t) => t.id);
      deleteTasks(ids, `${ids.length} ${ids.length === 1 ? "tarea eliminada" : "tareas eliminadas"}`);
      break;
    }
    case "seed": seed(); break;
    case "edit-cat": openCat(a.dataset.cat); break;
    case "cal-prev": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); calDir = "slide-prev"; render(); break;
    case "cal-next": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); calDir = "slide-next"; render(); break;
    case "cal-today": calMonth = startOfMonth(new Date()); calSelected = todayISO(); calDir = "slide-next"; render(); break;
    case "banner-done": { const t = get(id); const b = a.closest(".banner"); if (t && !t.done) toggleTask(id, a); dismissBanner(b); break; }
    case "banner-snooze": {
      const t = get(id); if (t) { t.remindTs = Date.now() + 10 * 60000; t.reminded = false; save(); renderRail(); showToast("Te lo recordaré en 10 minutos"); }
      dismissBanner(a.closest(".banner")); break;
    }
    case "banner-close": dismissBanner(a.closest(".banner")); break;
    case "log-read": state.log.forEach((l) => (l.read = true)); save(); renderBell(); break;
    case "set-theme": state.settings.theme = a.dataset.theme; save(); applyTheme(); syncSettings(); break;
    case "set-accent": state.settings.accent = a.dataset.accent; save(); applyTheme(); syncSettings(); break;
    case "toggle-sound": state.settings.sound = !state.settings.sound; save(); syncSettings(); if (state.settings.sound) chime(); break;
    case "enable-notif": enableNotifications(); break;
    case "export-json": exportJSON(); break;
    case "export-ics": exportICS(); break;
    case "import-json": $("#import-file").click(); break;
    case "reset-all":
      if (confirm("Se borrarán todas tus tareas, listas y ajustes. ¿Continuar?")) {
        state = defaultState(); view = "today"; save(); applyTheme(); render(); closePopovers(); showToast("Datos restablecidos");
      }
      break;
    case "push-cal": if (typeof pushTaskToCalendar === "function") pushTaskToCalendar(id); break;
    case "ext-task": {
      const ev = extEvents.find((x) => x.id === a.dataset.ext);
      if (ev) { addTask({ title: ev.title, due: ev.day, time: ev.time || "", description: `Desde ${SRC_LABEL[ev.src]}${ev.url ? "\n" + ev.url : ""}` }); showToast("Tarea creada desde el evento"); }
      break;
    }
    case "open-conn": closePopovers(); typeof openConn === "function" && openConn(a.dataset.tab); break;
    case "open-ai": closePopovers(); typeof openAi === "function" && openAi(); break;
    case "install-app": typeof installApp === "function" && installApp(); break;
    case "timer-toggle": timerToggle(); break;
    case "timer-reset": timer.running = false; timer.left = timer.dur[timer.mode]; paintTimer(); break;
    case "timer-mode": setTimerMode(a.dataset.mode); break;
  }
});

// Calendario: selección, doble clic y arrastrar para reprogramar
const calArea = $("#calendar-area");
calArea.addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell");
  if (!cell || e.target.closest(".cal-chip")) {
    const chip = e.target.closest(".cal-chip");
    if (chip?.dataset.url) { if (/^https:\/\//.test(chip.dataset.url)) window.open(chip.dataset.url, "_blank", "noopener"); }
    else if (chip) openTask(chip.dataset.id);
    return;
  }
  calSelected = cell.dataset.day;
  const d = fromISO(calSelected);
  if (d.getMonth() !== calMonth.getMonth()) calMonth = startOfMonth(d);
  render();
});
calArea.addEventListener("dblclick", (e) => {
  const cell = e.target.closest(".cal-cell");
  if (cell && !e.target.closest(".cal-chip")) openTask(null, { due: cell.dataset.day });
  /* doble clic en un evento externo: no hace nada especial */
});
calArea.addEventListener("keydown", (e) => {
  const cell = e.target.closest(".cal-cell");
  if (!cell) return;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); calSelected = cell.dataset.day; render(); $(`.cal-cell[data-day="${calSelected}"]`)?.focus(); }
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
  if (step) {
    e.preventDefault();
    const d = addDays(fromISO(cell.dataset.day), step);
    calSelected = iso(d);
    if (d.getMonth() !== calMonth.getMonth()) calMonth = startOfMonth(d);
    render(); $(`.cal-cell[data-day="${calSelected}"]`)?.focus();
  }
});
calArea.addEventListener("dragstart", (e) => {
  const chip = e.target.closest(".cal-chip"); if (!chip) return;
  e.dataTransfer.setData("text/plain", chip.dataset.id); e.dataTransfer.effectAllowed = "move";
});
calArea.addEventListener("dragover", (e) => {
  const cell = e.target.closest(".cal-cell"); if (!cell) return;
  e.preventDefault();
  $$(".cal-cell.is-drop", calArea).forEach((c) => c !== cell && c.classList.remove("is-drop"));
  cell.classList.add("is-drop");
});
calArea.addEventListener("dragleave", (e) => { if (!calArea.contains(e.relatedTarget)) $$(".is-drop", calArea).forEach((c) => c.classList.remove("is-drop")); });
calArea.addEventListener("drop", (e) => {
  const cell = e.target.closest(".cal-cell"); if (!cell) return;
  e.preventDefault();
  rescheduleTask(e.dataTransfer.getData("text/plain"), cell.dataset.day);
});
calArea.addEventListener("dragend", () => $$(".is-drop", calArea).forEach((c) => c.classList.remove("is-drop")));

// Detalles de completadas
$("#list-area").addEventListener("toggle", (e) => { if (e.target.matches("details.fold")) doneOpen = e.target.open; }, true);

// Añadir rápido
$("#quick-input").addEventListener("input", renderQuickPreview);
$("#quick-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#quick-input");
  const p = quickDefaults(parseQuick(input.value));
  if (!p.title) { input.focus(); return; }
  const hasReminder = p.due && p.time;
  afterSave(addTask({ title: p.title, priority: p.priority || "media", due: p.due, time: p.time, ...(p.category ? { category: p.category } : {}), ...(hasReminder ? { reminder: "15" } : {}) }));
  input.value = ""; renderQuickPreview();
  if (hasReminder) hintNotifications();
});

// Búsqueda
$("#search").addEventListener("input", (e) => { query = e.target.value.trim(); animateList = true; render(); });

// Botones de la barra superior
$("#btn-palette").addEventListener("click", openPalette);
$("#btn-bell").addEventListener("click", () => togglePopover("bell"));
$("#btn-settings").addEventListener("click", () => togglePopover("settings"));
function toggleTheme() { state.settings.theme = effectiveTheme() === "dark" ? "light" : "dark"; save(); applyTheme(); syncSettings(); }
$("#btn-theme").addEventListener("click", toggleTheme);
$("#add-cat").addEventListener("click", () => openCat());

// Luz que sigue al cursor
document.addEventListener("pointermove", (e) => {
  const el = e.target.closest?.(".spot");
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", e.clientX - r.left + "px");
  el.style.setProperty("--my", e.clientY - r.top + "px");
}, { passive: true });

// Atajos de teclado
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || document.activeElement?.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palDlg.open ? closeDialog(palDlg) : openPalette(); return; }
  if (e.key === "Escape") { closePopovers(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
  if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
  else if (e.key.toLowerCase() === "n") { e.preventDefault(); openTask(null, view === "calendar" ? { due: calSelected } : {}); }
  else if (e.key.toLowerCase() === "t") { setView("today"); }
});
$("#search").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.target.value = ""; query = ""; e.target.blur(); render(); } });

// Sincroniza varias pestañas
addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  state = load(); applyTheme(); render();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkReminders(); render(); } });

/* ===== Inicio ===== */
hydrateIcons();
applyTheme();
paintTimer();
render();
setInterval(checkReminders, 15000);
setInterval(() => { if (!document.hidden) { renderRail(); updateTitle(); } }, 60000);
setTimeout(checkReminders, 700);

// Atajo de la PWA / enlace: ?action=new abre el formulario
if (new URLSearchParams(location.search).get("action") === "new") {
  history.replaceState(null, "", location.pathname);
  setTimeout(() => openTask(), 300);
}
