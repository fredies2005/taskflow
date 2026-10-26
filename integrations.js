"use strict";

/* =====================================================================
   TaskFlow · Conexiones: Google (Calendar + Gmail), Outlook (Calendar +
   Correo) y Spotify.  Todo ocurre en el navegador: tú aportas tus propios
   Client ID de OAuth y los tokens se guardan solo en este dispositivo.
   Se carga después de app.js y reutiliza sus funciones globales.
   ===================================================================== */

const CONN_KEY = "taskflow.conn";
const REDIRECT = location.origin + location.pathname;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/* ===== Configuración persistente (separada de las tareas) ===== */
function loadConn() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(CONN_KEY)) || {}; } catch { /* ignorar */ }
  return {
    google: { clientId: "", ...c.google },
    microsoft: { clientId: "", tenant: "common", ...c.microsoft },
    spotify: { clientId: "", ...c.spotify },
    ai: { active: "", providers: {}, ...c.ai },
    mcp: Array.isArray(c.mcp) ? c.mcp : [],
    prefs: { calTarget: "google", autoSync: false, musicOnFocus: false, playlist: "", ...c.prefs },
    linkEmail: typeof c.linkEmail === "string" ? c.linkEmail : "",
    links: c.links && typeof c.links === "object" ? c.links : {},
  };
}
let conn = loadConn();
function saveConn() { try { localStorage.setItem(CONN_KEY, JSON.stringify(conn)); } catch { /* ignorar */ } }

/* ===== HTTP ===== */
async function api(url, { method = "GET", headers = {}, body, token } = {}) {
  const isForm = body instanceof URLSearchParams;
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const e = data && data.error;
    const err = new Error((e && (e.message || (typeof e === "string" ? e : ""))) || data?.error_description || data?.message || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ===== OAuth con PKCE (Microsoft y Spotify) ===== */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function randStr(n = 64) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }
async function pkce() {
  const verifier = randStr(64);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

const OAUTH = {
  microsoft: {
    auth: (c) => `https://login.microsoftonline.com/${c.tenant || "common"}/oauth2/v2.0/authorize`,
    token: (c) => `https://login.microsoftonline.com/${c.tenant || "common"}/oauth2/v2.0/token`,
    scope: "offline_access User.Read Calendars.ReadWrite Mail.Read",
    extra: { response_mode: "query", prompt: "select_account" },
  },
  spotify: {
    auth: () => "https://accounts.spotify.com/authorize",
    token: () => "https://accounts.spotify.com/api/token",
    scope: "user-read-email user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private",
    extra: {},
  },
};

function secureOk() {
  if (location.protocol === "file:") { showToast("Abre TaskFlow desde un servidor local (http://localhost) para conectar cuentas. Mira la ayuda."); return false; }
  if (!crypto.subtle) { showToast("Necesitas https o http://localhost para conectar cuentas."); return false; }
  return true;
}

async function oauthStart(provider) {
  const c = conn[provider];
  if (!c.clientId.trim()) { showToast("Pega primero el Client ID."); return; }
  if (!secureOk()) return;
  const { verifier, challenge } = await pkce();
  const state = randStr(24);
  sessionStorage.setItem("tf.oauth." + state, JSON.stringify({ provider, verifier }));
  const cfg = OAUTH[provider];
  const p = new URLSearchParams({
    client_id: c.clientId.trim(), response_type: "code", redirect_uri: REDIRECT,
    scope: cfg.scope, code_challenge: challenge, code_challenge_method: "S256", state, ...cfg.extra,
  });
  const hint = accountEmail();
  if (hint && provider === "microsoft") p.set("login_hint", hint);
  location.href = cfg.auth(c) + "?" + p;
}

async function tokenRequest(provider, params) {
  const c = conn[provider], cfg = OAUTH[provider];
  return api(cfg.token(c), { method: "POST", body: new URLSearchParams({ client_id: c.clientId.trim(), ...params }) });
}
function saveTokens(provider, tok) {
  const c = conn[provider];
  c.access = tok.access_token;
  if (tok.refresh_token) c.refresh = tok.refresh_token;
  c.exp = Date.now() + Math.max(60, (tok.expires_in || 3600) - 60) * 1000;
  c.connected = true;
  saveConn();
}

async function handleOAuthReturn() {
  const q = new URLSearchParams(location.search);
  const st = q.get("state");
  if (!st) return;
  const raw = sessionStorage.getItem("tf.oauth." + st);
  if (!raw) return;
  sessionStorage.removeItem("tf.oauth." + st);
  history.replaceState(null, "", location.pathname);
  const { provider, verifier } = JSON.parse(raw);
  const code = q.get("code");
  if (!code) { showToast("Conexión cancelada" + (q.get("error_description") ? ": " + q.get("error_description") : "")); return; }
  try {
    const tok = await tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier });
    saveTokens(provider, tok);
    if (!(await verifyLinked(provider))) return;
    showToast(`${provider === "spotify" ? "Spotify" : "Outlook"} conectado`);
    refreshAll(true);
    openConn("accounts");
  } catch (e) { showToast("No se pudo conectar: " + e.message); }
}

/* ===== Google (Google Identity Services, flujo de token) ===== */
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly";
function loadGIS() {
  return new Promise((res, rej) => {
    if (window.google?.accounts?.oauth2) return res();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar Google (¿sin conexión?)"));
    document.head.append(s);
  });
}
function googleRequest(prompt = "consent") {
  return new Promise(async (res, rej) => {
    try {
      await loadGIS();
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: conn.google.clientId.trim(), scope: GOOGLE_SCOPE, hint: accountEmail() || undefined,
        callback: (r) => {
          if (r.error) return rej(new Error(r.error_description || r.error));
          const g = conn.google;
          g.access = r.access_token; g.exp = Date.now() + Math.max(60, (r.expires_in || 3600) - 60) * 1000;
          g.scope = r.scope || ""; g.connected = true; saveConn();
          res(r.access_token);
        },
        error_callback: (e) => rej(new Error(e.type === "popup_closed" ? "Ventana cerrada" : e.type || "cancelado")),
      });
      tc.requestAccessToken({ prompt });
    } catch (e) { rej(e); }
  });
}

/* ===== Tokens ===== */
async function getToken(provider) {
  const c = conn[provider];
  if (!c.connected) throw new Error("No conectado");
  if (c.access && Date.now() < c.exp) return c.access;
  if (provider === "google") {
    try { return await googleRequest(""); }
    catch { c.expired = true; saveConn(); renderIntegrations(); throw new Error("La sesión de Google caducó. Vuelve a conectar."); }
  }
  if (c.refresh) {
    try {
      const tok = await tokenRequest(provider, { grant_type: "refresh_token", refresh_token: c.refresh });
      saveTokens(provider, tok);
      return conn[provider].access;
    } catch { /* cae abajo */ }
  }
  c.connected = false; c.expired = true; saveConn(); renderIntegrations();
  throw new Error("La sesión caducó. Vuelve a conectar.");
}

function disconnect(provider) {
  const c = conn[provider];
  if (conn.links && conn.links[provider]) { delete conn.links[provider]; if (typeof cloudRecordLink === "function") cloudRecordLink(provider, null); }
  if (provider === "google" && c.access && window.google?.accounts?.oauth2) { try { google.accounts.oauth2.revoke(c.access, () => {}); } catch { /* ignorar */ } }
  Object.assign(c, { access: "", refresh: "", exp: 0, connected: false, scope: "", expired: false });
  saveConn();
  if (provider === "spotify") { sp.now = null; sp.playlists = []; }
  if (provider !== "spotify") { extEvents = extEvents.filter((e) => e.src !== provider); mails = mails.filter((m) => m.src !== provider); }
  render(); renderConn();
}

/* ===== Vinculación solo por correo (requiere cuenta TaskFlow si cloud.js está activo) ===== */
const accountEmail = () => (typeof cloudRequired === "function" && cloudRequired() && cloudUser() ? cloudUser().email || "" : "");
function linkGate() {
  if (typeof cloudRequired !== "function" || !cloudRequired()) return true;
  const u = cloudUser();
  if (!u) { showToast("Inicia sesión en TaskFlow para vincular conectores."); typeof openAccount === "function" && openAccount(); return false; }
  if (/privaterelay\.appleid\.com$/i.test(u.email || "")) { showToast("Tu cuenta usa un correo privado de Apple: no puede coincidir con Google u Outlook. Entra con otro método."); return false; }
  if (!u.emailVerified) { showToast("Verifica primero tu correo (te lo enviamos al registrarte)."); typeof openAccount === "function" && openAccount(); return false; }
  if ((conn.linkEmail || "").trim().toLowerCase() !== (u.email || "").toLowerCase()) { showToast(`Escribe ${u.email} como correo de vinculación.`); return false; }
  return true;
}
async function linkedEmailOf(provider) {
  const t = await getToken(provider);
  if (provider === "google") return (await api("https://gmail.googleapis.com/gmail/v1/users/me/profile", { token: t })).emailAddress;
  if (provider === "microsoft") { const d = await api("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", { token: t }); return d.mail || d.userPrincipalName; }
  return (await api("https://api.spotify.com/v1/me", { token: t })).email;
}
async function verifyLinked(provider) {
  if (typeof cloudRequired !== "function" || !cloudRequired()) return true;
  await cloudReady();
  const u = cloudUser();
  const fail = (msg) => { disconnect(provider); showToast(msg); return false; };
  if (!u) return fail("Inicia sesión en TaskFlow para vincular conectores.");
  let em = "";
  try { em = String((await linkedEmailOf(provider)) || "").trim().toLowerCase(); } catch (e) { return fail("No se pudo comprobar el correo de esa cuenta: " + e.message); }
  const mine = (u.email || "").toLowerCase();
  if (!em || em !== mine) return fail(`Esa cuenta (${em || "sin correo"}) no coincide con tu correo de TaskFlow (${mine}). Solo se vinculan cuentas con el mismo correo.`);
  conn.links = { ...conn.links, [provider]: em }; saveConn();
  if (typeof cloudRecordLink === "function") cloudRecordLink(provider, em);
  return true;
}
function linkCard() {
  if (typeof cloudRequired !== "function" || !cloudRequired()) return "";
  const u = cloudUser();
  if (!u) return `<div class="notice is-warn"><p><strong>Inicia sesión para vincular conectores.</strong> Solo se pueden vincular cuentas de Google, Outlook o Spotify cuyo correo coincida con el de tu cuenta TaskFlow.</p>
    <div class="conn-actions"><button type="button" class="btn btn--primary btn--sm" data-action="open-account">Iniciar sesión</button></div></div>`;
  return `<section class="conn-card"><header class="conn-card__head"><span class="conn-logo" style="--c:var(--accent)">${icon("link")}</span><div><h3>Correo de vinculación</h3><p>Debe ser el de tu cuenta: ${esc(u.email || "")}</p></div></header>
    <div class="field"><label for="link-email">Escribe tu correo para poder vincular</label><input type="email" id="link-email" data-conn-field="linkEmail" value="${esc(conn.linkEmail || "")}" placeholder="${esc(u.email || "")}" autocomplete="off" spellcheck="false"></div>
    <p class="muted">Al conectar Google, Outlook o Spotify comprobamos que la cuenta elegida tenga exactamente este correo; si no coincide se desconecta.</p></section>`;
}

const isOn = (p) => !!conn[p].connected;
const googleHas = (what) => isOn("google") && (conn.google.scope || "").includes(what);
const calSources = () => [googleHas("calendar") && "google", isOn("microsoft") && "microsoft"].filter(Boolean);
const pushTarget = () => { const s = calSources(); return s.includes(conn.prefs.calTarget) ? conn.prefs.calTarget : s[0] || null; };
function canPushCalendar() { return !!pushTarget(); }

/* ===== Eventos de calendario (lectura) ===== */
function spread(src, id, title, { start, end, allDay, url }) {
  const out = [];
  const mk = (day, time, endT) => ({ id: `${src}:${id}:${day}`, src, title, day, time, end: endT, allDay, url: /^https:\/\//.test(url || "") ? url : "" });
  if (allDay) {
    let d = fromISO(start), n = 0;
    const stop = fromISO(end);
    while (d < stop && n++ < 31) { out.push(mk(iso(d), "", "")); d = addDays(d, 1); }
    if (!out.length) out.push(mk(start, "", ""));
  } else {
    const s = new Date(start), e = new Date(end);
    out.push(mk(iso(s), `${pad(s.getHours())}:${pad(s.getMinutes())}`, iso(s) === iso(e) ? `${pad(e.getHours())}:${pad(e.getMinutes())}` : ""));
  }
  return out;
}

async function fetchGoogleEvents(from, to) {
  const token = await getToken("google");
  const p = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const d = await api("https://www.googleapis.com/calendar/v3/calendars/primary/events?" + p, { token });
  return (d.items || []).filter((e) => e.status !== "cancelled" && !e.extendedProperties?.private?.taskflowId).flatMap((e) =>
    spread("google", e.id, e.summary || "(Sin título)", e.start.date
      ? { start: e.start.date, end: e.end.date, allDay: true, url: e.htmlLink }
      : { start: e.start.dateTime, end: e.end.dateTime, allDay: false, url: e.htmlLink }));
}

async function fetchMicrosoftEvents(from, to) {
  const token = await getToken("microsoft");
  const p = new URLSearchParams({ startDateTime: from.toISOString(), endDateTime: to.toISOString(), $top: "250", $select: "id,subject,start,end,isAllDay,webLink,categories" });
  const d = await api("https://graph.microsoft.com/v1.0/me/calendarView?" + p, { token, headers: { Prefer: 'outlook.timezone="UTC"' } });
  const utc = (s) => new Date(s.replace(/(\.\d{3})\d+/, "$1") + "Z");
  return (d.value || []).filter((e) => !(e.categories || []).includes("TaskFlow")).flatMap((e) =>
    spread("microsoft", e.id, e.subject || "(Sin título)", e.isAllDay
      ? { start: e.start.dateTime.slice(0, 10), end: e.end.dateTime.slice(0, 10), allDay: true, url: e.webLink }
      : { start: utc(e.start.dateTime), end: utc(e.end.dateTime), allDay: false, url: e.webLink }));
}

async function fetchRange(from, to, only) {
  const jobs = [];
  if (googleHas("calendar") && (!only || only === "google")) jobs.push(fetchGoogleEvents(from, to).then((r) => ["google", r]));
  if (isOn("microsoft") && (!only || only === "microsoft")) jobs.push(fetchMicrosoftEvents(from, to).then((r) => ["microsoft", r]));
  const res = await Promise.allSettled(jobs);
  const out = { events: [], errors: [] };
  res.forEach((r) => (r.status === "fulfilled" ? out.events.push(...r.value[1]) : out.errors.push(r.reason.message)));
  return out;
}

let extWindow = "", extTimer = null, extBusy = false;
function windowFor(month) {
  return [new Date(month.getFullYear(), month.getMonth() - 1, 1), new Date(month.getFullYear(), month.getMonth() + 2, 1)];
}
async function refreshExternal(force) {
  if (!calSources().length) { if (extEvents.length) { extEvents = []; } return; }
  const [from, to] = windowFor(typeof calMonth !== "undefined" ? calMonth : new Date());
  const key = iso(from) + iso(to);
  if (!force && key === extWindow || extBusy) return;
  extBusy = true;
  try {
    const { events, errors } = await fetchRange(from, to);
    extEvents = events;
    extWindow = key;
    if (errors.length) showToast("Calendario: " + errors[0]);
  } finally { extBusy = false; }
  render();
}
function refreshExternalSoon() { clearTimeout(extTimer); extTimer = setTimeout(() => refreshExternal(false), 250); }

/* ===== Correo ===== */
let mails = [];
async function fetchGmail() {
  const token = await getToken("google");
  const list = await api(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent("is:unread in:inbox")}&maxResults=6`, { token });
  const msgs = await Promise.all((list.messages || []).map((m) =>
    api(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, { token })));
  return msgs.map((m) => {
    const h = (n) => (m.payload?.headers || []).find((x) => x.name.toLowerCase() === n)?.value || "";
    return { id: "g:" + m.id, src: "google", subject: h("subject") || "(Sin asunto)", from: cleanFrom(h("from")), snippet: m.snippet || "", url: `https://mail.google.com/mail/u/0/#inbox/${m.id}`, ts: Number(m.internalDate) || 0 };
  });
}
async function fetchOutlookMail() {
  const token = await getToken("microsoft");
  const p = new URLSearchParams({ $filter: "isRead eq false", $top: "6", $select: "id,subject,from,receivedDateTime,webLink,bodyPreview" });
  const d = await api("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?" + p, { token });
  return (d.value || []).map((m) => ({
    id: "m:" + m.id, src: "microsoft", subject: m.subject || "(Sin asunto)",
    from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "", snippet: m.bodyPreview || "",
    url: m.webLink, ts: Date.parse(m.receivedDateTime) || 0,
  }));
}
function cleanFrom(s) { const m = s.match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/); return (m ? m[1] : s).trim(); }

async function refreshMail() {
  const jobs = [];
  if (googleHas("gmail")) jobs.push(fetchGmail());
  if (isOn("microsoft")) jobs.push(fetchOutlookMail());
  if (!jobs.length) { mails = []; return; }
  const res = await Promise.allSettled(jobs);
  mails = res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).sort((a, b) => b.ts - a.ts).slice(0, 8);
  const err = res.find((r) => r.status === "rejected");
  if (err) showToast("Correo: " + err.reason.message);
  renderIntegrations();
}

function mailToTask(id) {
  const m = mails.find((x) => x.id === id);
  if (!m) return;
  addTask({ title: m.subject.slice(0, 100), description: `De ${m.from}\n${m.snippet.slice(0, 200)}\n${m.url}`.slice(0, 400), due: todayISO() });
  showToast("Tarea creada desde el correo");
}

/* ===== Enviar tareas al calendario ===== */
const RRULE = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };
const localDT = (ms) => { const d = new Date(ms); return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`; };

async function upsertGoogle(t) {
  const token = await getToken("google");
  const ev = { summary: t.title, description: t.description || "", extendedProperties: { private: { taskflowId: t.id } } };
  if (t.time) { ev.start = { dateTime: localDT(baseTs(t)), timeZone: TZ }; ev.end = { dateTime: localDT(baseTs(t) + (t.durMin || 60) * 60000), timeZone: TZ }; }
  else { ev.start = { date: t.due }; ev.end = { date: iso(addDays(fromISO(t.due), 1)) }; }
  if (RRULE[t.repeat]) ev.recurrence = ["RRULE:FREQ=" + RRULE[t.repeat]];
  if (t.reminder !== "" && t.reminder != null) ev.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: Math.min(Number(t.reminder), 40320) }] };
  const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const r = t.ext?.google ? await api(`${base}/${t.ext.google}`, { method: "PATCH", token, body: ev }) : await api(base, { method: "POST", token, body: ev });
  return r.id;
}
async function upsertMicrosoft(t) {
  const token = await getToken("microsoft");
  const ev = { subject: t.title, body: { contentType: "text", content: t.description || "" }, categories: ["TaskFlow"], isReminderOn: t.reminder !== "" && t.reminder != null };
  if (ev.isReminderOn) ev.reminderMinutesBeforeStart = Number(t.reminder);
  if (t.time) { ev.start = { dateTime: localDT(baseTs(t)), timeZone: TZ }; ev.end = { dateTime: localDT(baseTs(t) + (t.durMin || 60) * 60000), timeZone: TZ }; ev.isAllDay = false; }
  else { ev.start = { dateTime: t.due + "T00:00:00", timeZone: TZ }; ev.end = { dateTime: iso(addDays(fromISO(t.due), 1)) + "T00:00:00", timeZone: TZ }; ev.isAllDay = true; }
  if (t.repeat !== "none") {
    const day = fromISO(t.due);
    ev.recurrence = {
      pattern: t.repeat === "daily" ? { type: "daily", interval: 1 }
        : t.repeat === "weekly" ? { type: "weekly", interval: 1, daysOfWeek: [["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day.getDay()]] }
          : { type: "absoluteMonthly", interval: 1, dayOfMonth: day.getDate() },
      range: { type: "noEnd", startDate: t.due },
    };
  }
  const base = "https://graph.microsoft.com/v1.0/me/events";
  const r = t.ext?.microsoft ? await api(`${base}/${t.ext.microsoft}`, { method: "PATCH", token, body: ev }) : await api(base, { method: "POST", token, body: ev });
  return r.id;
}

async function pushTaskToCalendar(id, target = pushTarget(), silent = false) {
  const t = get(id);
  if (!t || !t.due || !target) { if (!silent) showToast("La tarea necesita una fecha y una cuenta de calendario conectada."); return false; }
  try {
    const eid = target === "google" ? await upsertGoogle(t) : await upsertMicrosoft(t);
    (t.ext ||= {})[target] = eid;
    save();
    if (!silent) showToast(`Enviada a ${SRC_LABEL[target]} Calendar`.replace("Outlook Calendar", "Outlook"));
    render();
    return true;
  } catch (e) {
    if (!silent) showToast("No se pudo enviar: " + e.message);
    return false;
  }
}
function autoSyncTask(t) {
  if (conn.prefs.autoSync && t.due && !t.done && pushTarget()) pushTaskToCalendar(t.id, pushTarget(), true);
}

/* ===== Spotify ===== */
const sp = { now: null, playlists: [], err: "", poll: null };
async function spApi(path, opts = {}) { return api("https://api.spotify.com/v1" + path, { token: await getToken("spotify"), ...opts }); }

async function spRefresh() {
  if (!isOn("spotify")) return;
  try { sp.now = await spApi("/me/player"); sp.err = ""; }
  catch (e) { sp.err = e.message; }
  renderMusic();
}
async function spLoadPlaylists() {
  if (!isOn("spotify")) return;
  try { sp.playlists = (await spApi("/me/playlists?limit=30")).items.filter(Boolean); } catch { /* ignorar */ }
  renderMusic();
}
async function spCmd(cmd, body) {
  const map = { play: ["PUT", "/me/player/play"], pause: ["PUT", "/me/player/pause"], next: ["POST", "/me/player/next"], previous: ["POST", "/me/player/previous"] };
  try {
    await spApi(map[cmd][1], { method: map[cmd][0], body });
    setTimeout(spRefresh, 450);
  } catch (e) {
    showToast(e.status === 404 ? "Abre Spotify en algún dispositivo y vuelve a intentarlo." : e.status === 403 ? "Spotify solo permite controlar la reproducción con cuenta Premium." : "Spotify: " + e.message);
  }
}
function onFocusTimer(running, mode) {
  if (!conn.prefs.musicOnFocus || !isOn("spotify")) return;
  if (running && mode === "focus") spCmd("play", conn.prefs.playlist ? { context_uri: conn.prefs.playlist } : undefined);
  else spCmd("pause");
}

/* ===== Widgets del panel derecho ===== */
function agendaHTML() {
  const td = todayISO();
  const upcoming = extEvents.filter((e) => e.day >= td).sort((a, b) => a.day.localeCompare(b.day) || (a.time || "").localeCompare(b.time || "")).slice(0, 5);
  return upcoming.length
    ? upcoming.map((e) => `<li><div class="mini-item" style="--c:${EXT_COLORS[e.src]}"><span class="mini-item__ic" style="background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c)">${icon("calendar")}</span>
      <span><span class="mini-item__t">${esc(e.title)}</span><span class="mini-item__s">${relDay(e.day)}${e.allDay ? " · Todo el día" : " · " + e.time} · ${SRC_LABEL[e.src]}</span></span></div></li>`).join("")
    : `<li class="mini-empty">Sin eventos próximos.</li>`;
}

function renderIntegrations() {
  const hasCal = calSources().length > 0;
  const w = $("#w-agenda");
  if (w) { w.hidden = !hasCal; if (hasCal) $("#agenda-list").innerHTML = agendaHTML(); }
  const wm = $("#w-mail");
  if (wm) {
    const hasMail = googleHas("gmail") || isOn("microsoft");
    wm.hidden = !hasMail;
    if (hasMail) {
      $("#mail-count").textContent = mails.length ? `${mails.length} sin leer` : "";
      $("#mail-list").innerHTML = mails.length
        ? mails.map((m) => `<li class="mail-item" style="--c:${EXT_COLORS[m.src]}">
            <span class="mail-av">${esc((m.from || "?").charAt(0).toUpperCase())}</span>
            <div class="mail-body"><p class="mail-from">${esc(m.from)}</p><p class="mail-subj">${esc(m.subject)}</p></div>
            <div class="mail-act">${/^https:\/\//.test(m.url || "") ? `<a class="icon-btn icon-btn--sm" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir correo">${icon("link")}</a>` : ""}
            <button type="button" class="icon-btn icon-btn--sm" data-int="mail-task" data-id="${esc(m.id)}" aria-label="Convertir en tarea" title="Convertir en tarea">${icon("plus")}</button></div></li>`).join("")
        : `<li class="mini-empty">Bandeja al día. No hay correos sin leer.</li>`;
    }
  }
  renderMusic();
  renderDock();
  syncInstall();
  if ($("#conn-dialog").open) renderConn();
}

function renderMusic() {
  const w = $("#w-music");
  if (!w) return;
  w.hidden = !isOn("spotify");
  if (!isOn("spotify")) return;
  const it = sp.now?.item;
  const playing = !!sp.now?.is_playing;
  const art = it?.album?.images?.[1]?.url || it?.album?.images?.[0]?.url || "";
  $("#music-art").style.backgroundImage = art && /^https:\/\//.test(art) ? `url("${art}")` : "";
  $("#music-title").textContent = it ? it.name : sp.err ? "No se pudo leer Spotify" : "Nada en reproducción";
  $("#music-artist").textContent = it ? (it.artists || []).map((a) => a.name).join(", ") : sp.err || "Abre Spotify en un dispositivo";
  $("#music-play").innerHTML = icon(playing ? "pause" : "play");
  $("#music-play").setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  w.classList.toggle("is-playing", playing);
  const pct = it && it.duration_ms ? (sp.now.progress_ms / it.duration_ms) * 100 : 0;
  $("#music-bar").style.width = pct + "%";
  sp.t0 = Date.now();
  const sel = $("#music-list");
  sel.innerHTML = `<option value="">Mis listas…</option>` + sp.playlists.map((p) => `<option value="${esc(p.uri)}" ${p.uri === conn.prefs.playlist ? "selected" : ""}>${esc(p.name)}</option>`).join("");
}
setInterval(() => { // avanza la barra de progreso entre sondeos
  if (!sp.now?.is_playing || !sp.now.item || document.hidden) return;
  const p = (sp.now.progress_ms + (Date.now() - (sp.t0 || Date.now()))) / sp.now.item.duration_ms;
  const bar = $("#music-bar"); if (bar) bar.style.width = Math.min(100, p * 100) + "%";
}, 1000);

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-int]");
  if (!b) return;
  const a = b.dataset.int;
  if (a === "mail-task") mailToTask(b.dataset.id);
  else if (a === "mail-refresh") refreshMail();
  else if (a === "music-toggle") spCmd(sp.now?.is_playing ? "pause" : "play");
  else if (a === "music-next") spCmd("next");
  else if (a === "music-prev") spCmd("previous");
  else if (a === "music-start") { const u = $("#music-list").value; if (u) { conn.prefs.playlist = u; saveConn(); spCmd("play", { context_uri: u }); } else showToast("Elige primero una lista."); }
});
document.addEventListener("change", (e) => { if (e.target.id === "music-list") { conn.prefs.playlist = e.target.value; saveConn(); } });

/* ===== Diálogo de conexiones ===== */
const connDlg = $("#conn-dialog");
let connTab = "accounts";
const TABS = [["accounts", "Cuentas"], ["ai", "Inteligencia artificial"], ["mcp", "MCP"]];

function openConn(tab) {
  if (tab) connTab = tab;
  renderConn();
  openDialog(connDlg);
}
function statusChip(ok, expired) {
  return `<span class="status ${ok ? "is-on" : expired ? "is-warn" : ""}">${ok ? "Conectado" : expired ? "Caducada" : "Sin conectar"}</span>`;
}
function providerCard({ id, name, desc, color, letter, fields, help, extra = "" }) {
  const c = conn[id], on = !!c.connected;
  return `<section class="conn-card" data-prov="${id}">
    <header class="conn-card__head">
      <span class="conn-logo conn-logo--brand" style="--c:${color}">${LOGOS[id] || letter}</span>
      <div><h3>${name}</h3><p>${desc}</p></div>${statusChip(on, c.expired)}
    </header>
    ${fields}
    ${extra}
    <div class="conn-actions">
      ${on ? `<button type="button" class="btn btn--soft btn--sm" data-conn="disconnect" data-prov="${id}">Desconectar</button>` : ""}
      <button type="button" class="btn btn--primary btn--sm" data-conn="connect" data-prov="${id}">${on ? "Volver a autorizar" : "Conectar"}</button>
    </div>
    <details class="conn-help"><summary>Cómo conseguir el Client ID</summary>${help}</details>
  </section>`;
}
const idField = (id, label = "Client ID") => `<div class="field"><label for="cid-${id}">${label}</label><input type="text" id="cid-${id}" data-conn-field="${id}.clientId" value="${esc(conn[id].clientId)}" placeholder="Pega aquí tu Client ID" autocomplete="off" spellcheck="false"></div>`;

function accountsTab() {
  const local = location.protocol === "file:";
  const sandbox = !!window.TF_SANDBOX;
  const calOpts = calSources().map((s) => `<option value="${s}" ${pushTarget() === s ? "selected" : ""}>${SRC_LABEL[s]}</option>`).join("");
  return `
    ${sandbox ? `<div class="notice is-warn"><p><strong>Estás en la versión alojada dentro de Claude.</strong> Este entorno bloquea por seguridad las conexiones a Google, Outlook, Spotify, otras IAs y servidores MCP: los botones de conectar no pueden funcionar aquí. Para usarlos, abre la versión completa de TaskFlow desde tu propio servidor (carpeta <code>taskflow</code>, ver README). La IA <b>Claude integrado</b> sí funciona aquí sin claves.</p></div>` : ""}
    ${local ? `<div class="notice is-warn"><strong>Estás abriendo TaskFlow como archivo (file://).</strong> Para conectar cuentas necesita servirse por HTTP: en la carpeta de la app ejecuta <code>python3 -m http.server 5173</code> y abre <code>http://localhost:5173</code>.</div>` : ""}
    ${linkCard()}
    <div class="notice">
      <p>Dirección de esta app (regístrala como <em>redirect URI</em> / origen autorizado):</p>
      <div class="copy-row"><code id="redirect-uri">${esc(REDIRECT)}</code><button type="button" class="btn btn--soft btn--sm" data-conn="copy-redirect">${icon("copy")} Copiar</button></div>
      <p class="muted">Tus Client ID y tokens se guardan solo en este dispositivo. Nunca se envían a ningún servidor de TaskFlow.</p>
    </div>

    ${providerCard({
      id: "google", name: "Google", desc: "Calendar y Gmail", color: "#4285F4", letter: "G",
      fields: idField("google", "Client ID de OAuth (aplicación web)"),
      help: `<ol><li>Entra en <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console → Credenciales</a> y crea un proyecto.</li>
        <li>Activa las APIs <b>Google Calendar API</b> y <b>Gmail API</b>.</li>
        <li>Pantalla de consentimiento: tipo Externo; añade tu correo como usuario de prueba.</li>
        <li>Crea credenciales → <b>ID de cliente de OAuth</b> → Aplicación web.</li>
        <li>En <b>Orígenes de JavaScript autorizados</b> añade <code>${esc(location.origin)}</code>.</li>
        <li>Copia el Client ID aquí. (No hace falta el secreto.)</li></ol>`,
    })}

    ${providerCard({
      id: "microsoft", name: "Outlook / Microsoft 365", desc: "Calendario y correo", color: "#0A84D0", letter: "O",
      fields: idField("microsoft", "Id. de aplicación (cliente)") + `<div class="field"><label for="cid-tenant">Inquilino <span class="muted">(opcional)</span></label><input type="text" id="cid-tenant" data-conn-field="microsoft.tenant" value="${esc(conn.microsoft.tenant)}" placeholder="common"></div>`,
      help: `<ol><li>Entra en <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener">Microsoft Entra → Registros de aplicaciones</a> → Nuevo registro.</li>
        <li>Tipos de cuenta: “Cuentas en cualquier directorio y cuentas personales”.</li>
        <li>URI de redirección: plataforma <b>Aplicación de página única (SPA)</b> con <code>${esc(REDIRECT)}</code>.</li>
        <li>Permisos de API (Microsoft Graph, delegados): <code>Calendars.ReadWrite</code>, <code>Mail.Read</code>, <code>User.Read</code>.</li>
        <li>Copia el <b>Id. de aplicación (cliente)</b> aquí.</li></ol>`,
    })}

    ${providerCard({
      id: "spotify", name: "Spotify", desc: "Controla tu música mientras trabajas", color: "#1DB954", letter: "S",
      fields: idField("spotify"),
      help: `<ol><li>Entra en <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">Spotify for Developers → Dashboard</a> y crea una app.</li>
        <li>Redirect URI: <code>${esc(REDIRECT)}</code> (Spotify exige <code>http://127.0.0.1:PUERTO</code> en local; usa esa dirección para abrir TaskFlow).</li>
        <li>API: marca <b>Web API</b>. Copia el Client ID aquí.</li>
        <li>Para controlar la reproducción se necesita cuenta <b>Premium</b> y la app de Spotify abierta en algún dispositivo.</li></ol>`,
    })}

    <section class="conn-card">
      <header class="conn-card__head"><span class="conn-logo" style="--c:var(--accent)">${icon("sliders")}</span><div><h3>Preferencias</h3><p>Cómo se comportan las conexiones</p></div></header>
      <div class="pop__row"><span>Enviar tareas con fecha al calendario automáticamente</span>
        <button type="button" class="switch" role="switch" aria-checked="${conn.prefs.autoSync}" data-conn="pref-autosync" aria-label="Sincronizar automáticamente"><i></i></button></div>
      <div class="pop__row"><span>Calendario de destino</span>
        ${calOpts ? `<select class="mini-select" data-conn-pref="calTarget">${calOpts}</select>` : `<span class="muted">Conecta un calendario</span>`}</div>
      <div class="pop__row"><span>Música al iniciar un bloque de enfoque</span>
        <button type="button" class="switch" role="switch" aria-checked="${conn.prefs.musicOnFocus}" data-conn="pref-music" aria-label="Música al enfocar"><i></i></button></div>
    </section>`;
}

function renderConn() {
  const body = $("#conn-body");
  if (!body) return;
  const scroll = body.scrollTop;
  const idx = TABS.findIndex((t) => t[0] === connTab);
  $("#conn-tabs").style.setProperty("--i", idx);
  $$("#conn-tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === connTab));
  const focused = document.activeElement?.dataset?.connField;
  const html = connTab === "accounts" ? accountsTab() : connTab === "ai" ? (typeof aiTab === "function" ? aiTab() : "") : (typeof mcpTab === "function" ? mcpTab() : "");
  if (document.activeElement?.closest?.("#conn-body") && document.activeElement.tagName === "INPUT") return; // no pisar lo que se escribe
  body.innerHTML = html;
  body.scrollTop = scroll;
  if (focused) $(`[data-conn-field="${focused}"]`)?.focus();
}

connDlg.addEventListener("click", async (e) => {
  const tab = e.target.closest("#conn-tabs [data-tab]");
  if (tab) { connTab = tab.dataset.tab; renderConn(); return; }
  const b = e.target.closest("[data-conn]");
  if (!b) return;
  const act = b.dataset.conn, prov = b.dataset.prov;
  if (act === "connect" && window.TF_SANDBOX) return showToast("Aquí las conexiones externas están bloqueadas. Usa la versión completa alojada por ti.");
  if (act === "connect" && !linkGate()) return;
  if (act === "connect") {
    if (prov === "google") {
      if (!conn.google.clientId.trim()) return showToast("Pega primero el Client ID.");
      if (!secureOk()) return;
      try { await googleRequest("consent"); if (!(await verifyLinked("google"))) return; showToast("Google conectado"); refreshAll(true); renderConn(); }
      catch (err) { showToast("Google: " + err.message); }
    } else oauthStart(prov);
  } else if (act === "disconnect") disconnect(prov);
  else if (act === "copy-redirect") { try { await navigator.clipboard.writeText(REDIRECT); showToast("Dirección copiada"); } catch { showToast("Cópiala manualmente."); } }
  else if (act === "pref-autosync") { conn.prefs.autoSync = !conn.prefs.autoSync; saveConn(); renderConn(); }
  else if (act === "pref-music") { conn.prefs.musicOnFocus = !conn.prefs.musicOnFocus; saveConn(); renderConn(); }
  else if (typeof aiConnClick === "function") aiConnClick(act, b);
});
connDlg.addEventListener("input", (e) => {
  const f = e.target.dataset.connField;
  if (!f) return;
  const ks = f.split("."), last = ks.pop();
  let o = conn;
  for (const k of ks) o = o[k] ||= {};
  o[last] = e.target.value;
  saveConn();
  if (typeof aiConnInput === "function") aiConnInput(f, e.target);
});
connDlg.addEventListener("change", (e) => {
  if (e.target.dataset.connPref) { conn.prefs[e.target.dataset.connPref] = e.target.value; saveConn(); }
  if (typeof aiConnChange === "function") aiConnChange(e.target);
});


/* ===== Dock de conectores con logotipos ===== */
const LOGOS = {
  google: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`,
  microsoft: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="14" y="10" width="30" height="28" rx="4" fill="#0A84D0"/><path d="M14 16l15 10 15-10" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linejoin="round"/><rect x="2" y="13" width="22" height="22" rx="4" fill="#0364B8"/><ellipse cx="13" cy="24" rx="5.2" ry="6.4" fill="none" stroke="#fff" stroke-width="3"/></svg>`,
  spotify: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#1DB954"/><g fill="none" stroke="#fff" stroke-linecap="round"><path d="M11.5 18.2c8.6-2.5 18.5-1.8 26 2.7" stroke-width="3.6"/><path d="M13 25.6c7.3-2 15.3-1.4 21.5 2.3" stroke-width="3"/><path d="M14.6 32.4c5.8-1.5 11.6-1 16.6 1.8" stroke-width="2.5"/></g></svg>`,
  anthropic: `<svg viewBox="0 0 48 48" aria-hidden="true"><g stroke="#D97757" stroke-width="4.2" stroke-linecap="round"><path d="M24 6v36"/><path d="M6 24h36"/><path d="M11.3 11.3l25.4 25.4"/><path d="M36.7 11.3L11.3 36.7"/><path d="M16 7.6l16 32.8" stroke-width="3.4"/><path d="M32 7.6L16 40.4" stroke-width="3.4"/><path d="M7.6 16l32.8 16" stroke-width="3.4"/><path d="M7.6 32l32.8-16" stroke-width="3.4"/></g></svg>`,
  openai: `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#10A37F" stroke-width="3.2" stroke-linejoin="round"><path id="p" d="M24 5.5l8.2 4.7v9.4"/><use href="#p" transform="rotate(60 24 24)"/><use href="#p" transform="rotate(120 24 24)"/><use href="#p" transform="rotate(180 24 24)"/><use href="#p" transform="rotate(240 24 24)"/><use href="#p" transform="rotate(300 24 24)"/></g></svg>`,
  gemini: `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="gmg" x1="6" y1="40" x2="42" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#4285F4"/><stop offset=".55" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path fill="url(#gmg)" d="M24 2c1.2 11.4 10.6 20.8 22 22-11.4 1.2-20.8 10.6-22 22C22.8 34.6 13.4 25.2 2 24 13.4 22.8 22.8 13.4 24 2z"/></svg>`,
  mcp: `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="#3B4262" stroke-width="3.6" stroke-linecap="round"><path d="M8 26.5l15.6-15.6a6 6 0 0 1 8.5 8.5L16 35.5"/><path d="M16.8 27.7l15.4-15.4a6 6 0 0 1 8.5 8.5L25 36.4a6 6 0 0 1-8.5 0"/></g></svg>`,
};

/* Cada tile: qué muestra, si está conectado y a qué pestaña lleva */
function dockItems() {
  const embedded = typeof AI_PROVIDERS !== "undefined" && AI_PROVIDERS.embedded;
  const ai = (id) => (typeof aiReady === "function" ? aiReady(id) : false);
  const act = typeof aiActive === "function" ? aiActive() : "";
  const claudeId = embedded ? "embedded" : "anthropic";
  return [
    { id: "google", name: "Google", on: isOn("google"), warn: !!conn.google.expired, tab: "accounts", card: "google", tip: "Google Calendar y Gmail" },
    { id: "microsoft", name: "Outlook", on: isOn("microsoft"), warn: !!conn.microsoft.expired, tab: "accounts", card: "microsoft", tip: "Outlook: calendario y correo" },
    { id: "spotify", name: "Spotify", on: isOn("spotify"), warn: !!conn.spotify.expired, tab: "accounts", card: "spotify", tip: "Spotify: música mientras trabajas" },
    "sep",
    { id: "anthropic", logo: "anthropic", name: "Claude", on: ai(claudeId), main: act === claudeId, tab: "ai", card: claudeId, ai: claudeId, tip: embedded ? "Claude integrado en esta página" : "Claude (Anthropic)" },
    { id: "openai", name: "OpenAI", on: ai("openai"), main: act === "openai", tab: "ai", card: "openai", ai: "openai", tip: "OpenAI (ChatGPT)" },
    { id: "gemini", name: "Gemini", on: ai("gemini"), main: act === "gemini", tab: "ai", card: "gemini", ai: "gemini", tip: "Google Gemini" },
    { id: "mcp", name: "MCP", on: conn.mcp.some((s) => s.enabled && /^https?:\/\//i.test((s.url || "").trim())), tab: "mcp", tip: "Servidores MCP" },
    "sep",
    { id: "assistant", name: "Asistente", assistant: true, tip: "Abrir el asistente de IA" },
  ];
}
function renderDock() {
  const el = $("#dock");
  if (!el) return;
  el.innerHTML = `<span class="dock__label">Conectores</span>` + dockItems().map((d) => {
    if (d === "sep") return `<i class="dock__sep" aria-hidden="true"></i>`;
    if (d.assistant) return `<button type="button" class="dock-btn dock-btn--ai" data-dock="assistant" title="${d.tip}" aria-label="${d.tip}"><span class="dock-btn__logo">${icon("sparkle")}</span><span class="dock-btn__name">${d.name}</span></button>`;
    const state = d.on ? "Conectado" : d.warn ? "Sesión caducada" : "Sin conectar";
    return `<button type="button" class="dock-btn${d.on ? " is-on" : ""}${d.warn ? " is-warn" : ""}${d.main ? " is-main" : ""}" data-dock="${d.id}" title="${d.tip} · ${state}" aria-label="${d.name}: ${state}">
      <span class="dock-btn__logo">${LOGOS[d.logo || d.id]}</span>${d.on || d.warn ? `<i class="dock-btn__dot"></i>` : ""}<span class="dock-btn__name">${d.name}</span></button>`;
  }).join("");
}
function focusCard(id) {
  const c = $(`#conn-body section[data-prov="${id}"]`) || $(`#conn-body section[data-card="${id}"]`);
  if (!c) return;
  if (!window.TF_SANDBOX) c.scrollIntoView({ block: "start", behavior: "smooth" });
  c.classList.add("is-flash");
  setTimeout(() => c.classList.remove("is-flash"), 1500);
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-dock]");
  if (!b) return;
  const d = dockItems().find((x) => x.id === b.dataset.dock);
  if (b.dataset.dock === "assistant") { typeof openAi === "function" && openAi(); return; }
  if (!d) return;
  // IA ya lista y no es la principal → la convierte en principal y abre el chat; si ya lo es, abre el chat
  if (d.ai && d.on) {
    if (conn.ai.active !== d.ai) { conn.ai.active = d.ai; saveConn(); typeof syncAiSelect === "function" && syncAiSelect(); renderDock(); showToast(`${d.name} es ahora tu asistente.`); }
    typeof openAi === "function" && openAi();
    return;
  }
  openConn(d.tab);
  if (d.card) requestAnimationFrame(() => focusCard(d.card));
});

/* ===== Orquestación ===== */
function refreshAll(force) {
  refreshExternal(force);
  refreshMail();
  if (isOn("spotify")) { spRefresh(); spLoadPlaylists(); }
}
setInterval(() => { if (!document.hidden) { refreshExternal(true); refreshMail(); } }, 10 * 60 * 1000);
setInterval(() => { if (!document.hidden && isOn("spotify")) spRefresh(); }, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && isOn("spotify")) spRefresh(); });

function integrationCommands() {
  return [
    { g: "Conexiones", l: "Abrir asistente de IA", ic: "sparkle", run: () => openAi() },
    { g: "Conexiones", l: "Conexiones y cuentas…", ic: "plug", run: () => openConn("accounts") },
    { g: "Conexiones", l: "Configurar proveedores de IA…", ic: "sparkle", run: () => openConn("ai") },
    { g: "Conexiones", l: "Servidores MCP…", ic: "plug", run: () => openConn("mcp") },
    ...(calSources().length ? [{ g: "Conexiones", l: "Actualizar calendarios y correo", ic: "reset", run: () => refreshAll(true) }] : []),
    ...(isOn("spotify") ? [{ g: "Conexiones", l: sp.now?.is_playing ? "Pausar Spotify" : "Reproducir Spotify", ic: "music", run: () => spCmd(sp.now?.is_playing ? "pause" : "play") }] : []),
  ];
}

/* ===== PWA: instalación y service worker ===== */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; syncInstall(); });
window.addEventListener("appinstalled", () => { deferredInstall = null; syncInstall(); showToast("TaskFlow instalada"); });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function syncInstall() {
  const b = $("#install-row");
  if (b) b.hidden = !!standalone() || (!deferredInstall && !isIOS());
}
async function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; syncInstall(); }
  else if (isIOS()) showToast("En Safari: Compartir → “Añadir a pantalla de inicio”.");
  else showToast("Usa el menú del navegador → Instalar aplicación.");
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.TF_SANDBOX) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sin SW: la app funciona igual */ });
}

/* ===== Inicio ===== */
renderDock();
hydrateIcons($("#w-agenda") || document);
handleOAuthReturn().finally(() => { renderIntegrations(); refreshAll(false); });
