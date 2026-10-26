"use strict";

/* =====================================================================
   TaskFlow · Grupos colaborativos (estilo WhatsApp)
   - Cualquier persona con cuenta puede crear grupos e invitar por enlace,
     código o correo.
   - Dentro del grupo todos los miembros ven y editan LO MISMO EN TIEMPO REAL:
     tareas, plazos, reparto de trabajo y chat. Cada tarea es un documento
     independiente, así que dos personas pueden editar a la vez sin pisarse.
   - "Repartir": divide un trabajo en partes con responsable y plazo.
   Requiere cloud.js (Firebase) y las reglas de firestore.rules.
   ===================================================================== */

const G_COLORS = ["#6B74F5", "#9B5CF6", "#F0566B", "#14A38B", "#2D8CF0", "#F59E0B", "#EC4899", "#10B981"];
const G_EMOJI = ["👥", "🚀", "🎓", "🏠", "💼", "🎨", "🌱", "⚽", "🎉", "📚", "🛠️", "✈️"];
const G_PRIO = { alta: "Alta", media: "Media", baja: "Baja" };
const GR = {
  groups: new Map(), invites: [], active: null, tab: "tasks", filter: "all",
  tasks: [], msgs: [], lastMsg: new Map(), subs: [], msgSubs: new Map(), taskSubFor: null, firstTasks: true,
  seen: (() => { try { return JSON.parse(localStorage.getItem("taskflow.seen")) || {}; } catch { return {}; } })(),
  draft: {},
};
const gArrayUnion = (...a) => firebase.firestore.FieldValue.arrayUnion(...a);
const gArrayRemove = (...a) => firebase.firestore.FieldValue.arrayRemove(...a);
const gOk = () => typeof cloudRequired === "function" && cloudRequired() && !!cloudUser() && !!fbDb;
const gMe = () => cloudUser();
const gMeInfo = () => ({ name: gMe().displayName || (gMe().email || "").split("@")[0] || "Yo", email: gMe().email || "" });
const gEmail = () => (gMe()?.email || "").toLowerCase();
const gGroup = () => GR.groups.get(GR.active);
const gRole = (g = gGroup()) => g?.members?.[gMe()?.uid] || "";
const gIsAdmin = (g = gGroup()) => ["owner", "admin"].includes(gRole(g));
const gName = (uidv, g = gGroup()) => g?.memberInfo?.[uidv]?.name || "Alguien";
const gColorOf = (uidv) => { let h = 0; for (const c of String(uidv)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return G_COLORS[h % G_COLORS.length]; };
const gAva = (uidv, g = gGroup(), cls = "") => `<span class="g-av ${cls}" style="--c:${gColorOf(uidv)}" title="${esc(gName(uidv, g))}">${esc(gName(uidv, g).charAt(0).toUpperCase())}</span>`;
const gCode = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); return [...a].map((n) => "abcdefghjkmnpqrstuvwxyz23456789"[n % 31]).join(""); };
const gSaveSeen = () => { try { localStorage.setItem("taskflow.seen", JSON.stringify(GR.seen)); } catch { /* ignorar */ } };
const gErr = (e) => ({ "permission-denied": "No tienes permiso para hacer eso (¿enlace caducado o reglas de Firestore sin publicar?).", "not-found": "Ese grupo ya no existe.", unavailable: "Sin conexión con el servidor." }[e?.code] || e?.message || "Algo salió mal.");

/* ===================== Suscripciones ===================== */
function gStopAll() {
  GR.subs.forEach((u) => u()); GR.subs = [];
  GR.msgSubs.forEach((u) => u()); GR.msgSubs.clear();
  GR.lastMsg.clear(); GR.taskSubFor = null;
}
function groupsOnAuth(user) {
  gStopAll(); GR.groups.clear(); GR.invites = []; GR.tasks = []; GR.msgs = [];
  if (user && gOk()) {
    GR.subs.push(fbDb.collection("groups").where("memberIds", "array-contains", user.uid).onSnapshot((snap) => {
      GR.groups = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
      gSyncMsgSubs(); renderGroupNav();
      if (view.startsWith("grp:")) {
        if (!GR.groups.has(view.slice(4)) && GR.groups.size >= 0 && GR.ready) { showToast("Ya no formas parte de ese grupo."); setView("today"); }
        else groupsRender();
      }
      GR.ready = true;
    }, (e) => showToast("Grupos: " + gErr(e))));
    if (user.emailVerified && user.email) {
      GR.subs.push(fbDb.collection("groups").where("pendingEmails", "array-contains", gEmail()).onSnapshot((snap) => {
        GR.invites = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => !g.memberIds.includes(user.uid));
        renderGroupNav();
      }, () => { /* sin invitaciones */ }));
    }
  } else { GR.ready = false; if (view.startsWith("grp:")) setView("today"); }
  renderGroupNav();
  gProcessJoinParam();
}
function gSyncMsgSubs() { // último mensaje de cada grupo → punto de "sin leer"
  for (const [id, u] of GR.msgSubs) if (!GR.groups.has(id)) { u(); GR.msgSubs.delete(id); GR.lastMsg.delete(id); }
  for (const id of GR.groups.keys()) {
    if (GR.msgSubs.has(id)) continue;
    GR.msgSubs.set(id, fbDb.collection(`groups/${id}/messages`).orderBy("at", "desc").limit(1).onSnapshot((s) => {
      const m = s.docs[0]?.data();
      const prev = GR.lastMsg.get(id);
      GR.lastMsg.set(id, m || null);
      if (m && prev !== undefined && m.uid !== gMe().uid && !(GR.active === id && GR.tab === "chat" && view === "grp:" + id)) {
        if (!prev || m.at > prev.at) showToast(`${GR.groups.get(id)?.name || "Grupo"} · ${m.name}: ${String(m.text).slice(0, 60)}`);
      }
      renderGroupNav();
    }, () => {}));
  }
}
function gOpenActive(id) {
  if (GR.taskSubFor === id) return;
  gCloseActive();
  GR.taskSubFor = id; GR.firstTasks = true; GR.tasks = []; GR.msgs = [];
  GR.activeSubs = [
    fbDb.collection(`groups/${id}/tasks`).onSnapshot((snap) => {
      if (!GR.firstTasks) snap.docChanges().forEach((c) => {
        const t = c.doc.data();
        if (c.type !== "removed" && t.assigneeId === gMe().uid && t.updatedBy !== gMe().uid && !c.doc.metadata.hasPendingWrites) showToast(`${gName(t.updatedBy)} te asignó «${t.title}»`);
      });
      GR.firstTasks = false;
      GR.tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (GR.active === id) { gRenderTasks(); gRenderHead(); }
    }, (e) => showToast("Tareas del grupo: " + gErr(e))),
    fbDb.collection(`groups/${id}/messages`).orderBy("at", "desc").limit(150).onSnapshot((snap) => {
      GR.msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      if (GR.active === id) { gRenderChat(); if (GR.tab === "chat") gMarkSeen(); }
    }, () => {}),
  ];
}
function gCloseActive() { (GR.activeSubs || []).forEach((u) => u()); GR.activeSubs = []; GR.taskSubFor = null; }
function gMarkSeen() { if (!GR.active) return; GR.seen[GR.active] = Date.now(); gSaveSeen(); renderGroupNav(); }
const gUnread = (id) => { const m = GR.lastMsg.get(id); return !!(m && m.uid !== gMe()?.uid && m.at > (GR.seen[id] || 0)); };

/* ===================== Barra lateral ===================== */
function renderGroupNav() {
  const nav = $("#nav-groups");
  if (!nav) return;
  if (!(typeof cloudRequired === "function" && cloudRequired())) { nav.innerHTML = `<p class="nav-hint">Activa las cuentas (README) para crear grupos.</p>`; return; }
  if (!gMe()) { nav.innerHTML = `<button type="button" class="nav-item" data-action="open-account">${icon("users")}<span>Inicia sesión para usar grupos</span></button>`; return; }
  const inv = GR.invites.map((g) => `<div class="g-invite"><span>${esc(g.emoji || "👥")} <b>${esc(g.name)}</b> te invita</span>
    <button type="button" class="icon-btn icon-btn--sm" data-g="accept" data-gid="${g.id}" aria-label="Aceptar invitación" title="Aceptar">${icon("check")}</button>
    <button type="button" class="icon-btn icon-btn--sm" data-g="decline" data-gid="${g.id}" aria-label="Rechazar invitación" title="Rechazar">${icon("x")}</button></div>`).join("");
  const items = [...GR.groups.values()].sort((a, b) => a.name.localeCompare(b.name)).map((g) => {
    const id = "grp:" + g.id;
    return `<div class="nav-row"><button type="button" class="nav-item ${view === id ? "is-active" : ""}" data-action="view" data-view="${id}" ${view === id ? 'aria-current="page"' : ""}>
      <span class="g-ava g-ava--sm" style="--c:${g.color || G_COLORS[0]}">${esc(g.emoji || "👥")}</span><span class="nav-name">${esc(g.name)}</span>${gUnread(g.id) ? `<em class="nav-count g-dot" aria-label="Mensajes nuevos"></em>` : ""}</button></div>`;
  }).join("");
  nav.innerHTML = inv + items + (!items && !inv ? `<p class="nav-hint">Crea un grupo para trabajar con otras personas en tiempo real.</p>` : "");
}
$("#add-group").innerHTML = icon("plus");
$("#add-group").addEventListener("click", () => { if (!gOk()) { typeof openAccount === "function" && openAccount(); return; } gOpenCreate(); });

/* ===================== Vista del grupo ===================== */
function groupsRender() {
  const area = $("#group-area");
  const id = view.slice(4), g = GR.groups.get(id);
  if (!g) { area.innerHTML = `<div class="empty"><div class="empty__ic">${icon("users")}</div><h3>${gOk() ? "Cargando grupo…" : "Inicia sesión para ver este grupo"}</h3></div>`; area.dataset.gid = ""; return; }
  if (GR.active !== id) { GR.active = id; GR.tab = "tasks"; GR.filter = "all"; area.dataset.gid = ""; }
  gOpenActive(id);
  if (area.dataset.gid !== id) {
    area.dataset.gid = id;
    area.innerHTML = `
      <header class="g-head glass spot" id="g-head"></header>
      <div class="g-tabs"><div class="seg" id="g-tabs" style="--n:3;--i:0" role="tablist">
        <button type="button" data-g="tab" data-tab="tasks" aria-pressed="true">Tareas</button>
        <button type="button" data-g="tab" data-tab="chat" aria-pressed="false">Chat</button>
        <button type="button" data-g="tab" data-tab="members" aria-pressed="false">Miembros</button></div></div>
      <div id="g-pane-tasks"></div>
      <div id="g-pane-chat" hidden></div>
      <div id="g-pane-members" hidden></div>`;
    gShell();
  }
  gRenderHead(); gRenderTabs(); gRenderTasks(); gRenderChat(); gRenderMembers();
}
function gRenderTabs() {
  const tabs = ["tasks", "chat", "members"];
  $("#g-tabs")?.style.setProperty("--i", tabs.indexOf(GR.tab));
  $$("#g-tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.tab === GR.tab));
  tabs.forEach((t) => { const p = $("#g-pane-" + t); if (p) p.hidden = t !== GR.tab; });
}
function gStats() {
  const leaf = GR.tasks.filter((t) => !t.isParent), td = todayISO(), me = gMe().uid;
  return { total: leaf.length, done: leaf.filter((t) => t.done).length, mine: leaf.filter((t) => t.assigneeId === me && !t.done).length, over: leaf.filter((t) => !t.done && t.due && t.due < td).length };
}
function gRenderHead() {
  const g = gGroup(), el = $("#g-head");
  if (!g || !el) return;
  const s = gStats(), pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
  el.style.setProperty("--c", g.color || G_COLORS[0]);
  el.innerHTML = `<div class="g-head__main">
      <span class="g-ava g-ava--lg" style="--c:${g.color || G_COLORS[0]}">${esc(g.emoji || "👥")}</span>
      <div class="g-head__txt"><h1>${esc(g.name)}</h1>
        <div class="g-members">${g.memberIds.slice(0, 6).map((u) => gAva(u, g, "g-av--stack")).join("")}<span class="muted">${g.memberIds.length} ${g.memberIds.length === 1 ? "miembro" : "miembros"}</span></div></div>
      <div class="g-head__act"><button type="button" class="btn btn--soft btn--sm" data-g="invite">${icon("link")} Invitar</button>
        <button type="button" class="icon-btn" data-g="settings" aria-label="Ajustes del grupo" title="Ajustes del grupo">${icon("sliders")}</button></div></div>
    <div class="g-stats"><span><b>${s.mine}</b> mías pendientes</span><span><b>${s.total - s.done}</b> por hacer</span><span class="${s.over ? "is-alert" : ""}"><b>${s.over}</b> vencidas</span><span><b>${pct}%</b> completado</span></div>
    <div class="proj-bar"><i style="width:${pct}%"></i></div>`;
}
const gDueChip = (t) => {
  if (!t.due) return "";
  const over = !t.done && t.due < todayISO();
  return `<span class="gt-chip ${over ? "is-over" : t.due === todayISO() ? "is-today" : ""}">${icon("calendar")}${esc(relDay(t.due))}${t.time ? " · " + t.time : ""}</span>`;
};
function gTaskRow(t, child) {
  return `<div class="gt ${t.done ? "is-done" : ""} ${child ? "gt--child" : ""}" data-id="${t.id}">
    <button type="button" class="gt-check" data-g="toggle" data-id="${t.id}" role="checkbox" aria-checked="${!!t.done}" aria-label="Marcar como hecha">${t.done ? icon("check") : ""}</button>
    <div class="gt-main" data-g="edit" data-id="${t.id}" tabindex="0" role="button">
      <p class="gt-title">${esc(t.title)}</p>
      <div class="gt-meta">
        ${t.assigneeId ? `<span class="gt-chip gt-chip--who">${gAva(t.assigneeId, undefined, "g-av--xs")}${esc(gName(t.assigneeId).split(" ")[0])}</span>` : `<span class="gt-chip gt-chip--none">Sin asignar</span>`}
        ${gDueChip(t)}${t.priority && t.priority !== "media" ? `<span class="gt-chip gt-chip--${t.priority}">${G_PRIO[t.priority]}</span>` : ""}
        ${t.updatedBy && t.updatedBy !== gMe().uid ? `<span class="gt-edit">editado por ${esc(gName(t.updatedBy).split(" ")[0])}</span>` : ""}
      </div></div></div>`;
}
const gSortTasks = (a, b) => (a.done - b.done) || ((a.due || "9999") + (a.time || "")).localeCompare((b.due || "9999") + (b.time || "")) || (a.createdAt - b.createdAt);
function gRenderTasks() {
  const pane = $("#g-pane-tasks");
  if (!pane || !gGroup()) return;
  const focus = document.activeElement?.id === "g-quick-input";
  const val = $("#g-quick-input")?.value || "";
  const me = gMe().uid, f = GR.filter;
  const pass = (t) => f === "all" ? true : f === "mine" ? t.assigneeId === me : f === "pending" ? !t.done : t.done;
  const parents = GR.tasks.filter((t) => t.isParent).sort(gSortTasks);
  const kids = (p) => GR.tasks.filter((t) => t.parentId === p).sort(gSortTasks);
  const orphans = GR.tasks.filter((t) => !t.isParent && !GR.tasks.some((p) => p.id === t.parentId)).filter(pass).sort(gSortTasks);
  let html = parents.map((p) => {
    const ks = kids(p.id), shown = ks.filter(pass);
    if (!shown.length && f !== "all") return "";
    const d = ks.filter((k) => k.done).length, pct = ks.length ? Math.round((d / ks.length) * 100) : 0;
    return `<section class="g-parent glass"><header><div><h3 data-g="edit" data-id="${p.id}" tabindex="0" role="button">${icon("subs")} ${esc(p.title)}</h3>
      <p class="muted">${d}/${ks.length} partes · ${p.due ? "plazo " + esc(relDay(p.due)) : "sin plazo"}</p></div>
      <button type="button" class="icon-btn icon-btn--sm" data-g="add-child" data-id="${p.id}" aria-label="Añadir parte" title="Añadir parte">${icon("plus")}</button></header>
      <div class="proj-bar proj-bar--sm"><i style="width:${pct}%"></i></div>${shown.map((k) => gTaskRow(k, true)).join("") || `<p class="muted g-none">Sin partes todavía.</p>`}</section>`;
  }).join("");
  if (orphans.length) html += `<section class="g-list">${orphans.map((t) => gTaskRow(t)).join("")}</section>`;
  if (!html) html = `<div class="empty"><div class="empty__ic">${icon("inbox")}</div><h3>${GR.tasks.length ? "Nada con ese filtro" : "El grupo está vacío"}</h3><p>${GR.tasks.length ? "Prueba con otro filtro." : "Añade una tarea o usa «Repartir» para dividir un trabajo entre todos."}</p></div>`;
  pane.innerHTML = `<form class="quick glass" id="g-quick" autocomplete="off"><span class="quick__ic">${icon("plus")}</span>
      <input type="text" id="g-quick-input" maxlength="140" aria-label="Nueva tarea del grupo" placeholder="Añade una tarea para el grupo…"><button type="submit" class="btn btn--primary btn--sm">Añadir</button></form>
    <div class="g-bar"><div class="g-chips" role="tablist">${[["all", "Todas"], ["mine", "Mías"], ["pending", "Pendientes"], ["done", "Hechas"]].map(([k, n]) => `<button type="button" data-g="filter" data-f="${k}" aria-pressed="${f === k}">${n}</button>`).join("")}</div>
      <button type="button" class="btn btn--soft btn--sm" data-g="split">${icon("subs")} Repartir trabajo</button></div>${html}`;
  const qi = $("#g-quick-input"); qi.value = val; if (focus) { qi.focus(); }
}
function gRenderMembers() {
  const pane = $("#g-pane-members"), g = gGroup();
  if (!pane || !g) return;
  const order = { owner: 0, admin: 1, member: 2 };
  const rows = g.memberIds.slice().sort((a, b) => (order[g.members[a]] - order[g.members[b]]) || gName(a).localeCompare(gName(b))).map((u) => {
    const r = g.members[u], mine = u === gMe().uid, canManage = gIsAdmin(g) && !mine && r !== "owner" && (gRole(g) === "owner" || r === "member");
    return `<div class="g-member">${gAva(u, g)}<div><p><b>${esc(gName(u, g))}</b>${mine ? " (tú)" : ""}</p><p class="muted">${esc(g.memberInfo?.[u]?.email || "")}</p></div>
      <span class="status ${r !== "member" ? "is-on" : ""}">${{ owner: "Creador", admin: "Admin", member: "Miembro" }[r]}</span>
      ${canManage ? `<button type="button" class="btn btn--ghost btn--sm" data-g="role" data-uid="${u}">${r === "admin" ? "Quitar admin" : "Hacer admin"}</button><button type="button" class="btn btn--ghost btn--sm" data-g="kick" data-uid="${u}" data-confirm="0">Quitar</button>` : ""}</div>`;
  }).join("");
  const pend = (g.pendingEmails || []).map((e) => `<div class="g-member"><span class="g-av" style="--c:#8E97B8">✉</span><div><p>${esc(e)}</p><p class="muted">Invitación pendiente</p></div>${gIsAdmin(g) ? `<button type="button" class="btn btn--ghost btn--sm" data-g="unpend" data-email="${esc(e)}">Cancelar</button>` : ""}</div>`).join("");
  pane.innerHTML = `<section class="conn-card g-card">${rows}${pend}<div class="conn-actions"><button type="button" class="btn btn--primary btn--sm" data-g="invite">${icon("plus")} Invitar personas</button></div></section>`;
}

/* ===================== Chat ===================== */
const gDayLabel = (ts) => { const d = iso(new Date(ts)); return d === todayISO() ? "Hoy" : d === iso(addDays(new Date(), -1)) ? "Ayer" : relDay(d); };
function gShell() { /* el chat se construye una vez para no perder el texto que se está escribiendo */
  $("#g-pane-chat").innerHTML = `<div class="g-chat glass"><div class="g-msgs" id="g-msgs" aria-live="polite"></div>
    <form id="g-chat-form" autocomplete="off"><textarea id="g-chat-input" rows="1" maxlength="2000" placeholder="Escribe un mensaje…" aria-label="Mensaje"></textarea>
    <button type="submit" class="btn btn--primary btn--icon" aria-label="Enviar">${icon("send")}</button></form></div>`;
}
function gRenderChat() {
  const box = $("#g-msgs");
  if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 120 || !box.childElementCount;
  let last = "", lastUid = "", html = "";
  GR.msgs.forEach((m) => {
    const day = gDayLabel(m.at), me = m.uid === gMe().uid;
    if (day !== last) { html += `<div class="g-day"><span>${esc(day)}</span></div>`; last = day; lastUid = ""; }
    const time = new Date(m.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    html += `<div class="g-msg ${me ? "is-me" : ""}">${!me && lastUid !== m.uid ? `<p class="g-msg__who" style="color:${gColorOf(m.uid)}">${esc(m.name || gName(m.uid))}</p>` : ""}<p class="g-msg__t">${esc(m.text)}</p><span class="g-msg__time">${time}</span>${me ? `<button type="button" class="g-msg__del" data-g="del-msg" data-id="${m.id}" aria-label="Borrar mensaje" title="Borrar">${icon("x")}</button>` : ""}</div>`;
    lastUid = m.uid;
  });
  box.innerHTML = html || `<p class="muted g-none">Aún no hay mensajes. ¡Saluda al grupo!</p>`;
  if (near) box.scrollTop = box.scrollHeight;
}

/* ===================== Diálogos ===================== */
function gDialog(id, cls, inner) {
  const d = document.createElement("dialog");
  d.className = `sheet ${cls} glass`; d.id = id; d.innerHTML = inner;
  document.body.append(d);
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
  d.addEventListener("mousedown", (e) => { if (e.target === d) closeDialog(d); });
  d.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeDialog(d); });
  return d;
}
const head = (t) => `<header class="sheet__head"><h2>${t}</h2><button type="button" class="icon-btn icon-btn--sm" data-close aria-label="Cerrar">${icon("x")}</button></header>`;
const swatches = (name, cur) => G_COLORS.map((c) => `<label class="sw"><input type="radio" name="${name}" value="${c}" ${c === cur ? "checked" : ""}><i style="--c:${c}"></i></label>`).join("");
const emojis = (name, cur) => G_EMOJI.map((e) => `<label class="em"><input type="radio" name="${name}" value="${e}" ${e === cur ? "checked" : ""}><span>${e}</span></label>`).join("");

/* --- Crear / unirse --- */
const gCreateDlg = gDialog("g-create-dialog", "sheet--sm", `${head("Grupos")}
  <div class="sheet__body g-form">
    <div class="seg" id="gc-tabs" style="--n:2;--i:0"><button type="button" data-gc="create" aria-pressed="true">Crear grupo</button><button type="button" data-gc="join" aria-pressed="false">Unirme con enlace</button></div>
    <form id="gc-create" novalidate>
      <div class="field"><label for="gc-name">Nombre del grupo</label><input type="text" id="gc-name" maxlength="40" placeholder="Ej: Trabajo de Historia, Reforma casa"></div>
      <fieldset class="field fieldset"><legend>Icono</legend><div class="emojis">${emojis("gc-emoji", G_EMOJI[0])}</div></fieldset>
      <fieldset class="field fieldset"><legend>Color</legend><div class="swatches swatches--lg">${swatches("gc-color", G_COLORS[0])}</div></fieldset>
      <p class="conn-result is-err" id="gc-err" role="status"></p>
      <div class="conn-actions"><button type="submit" class="btn btn--primary">Crear grupo</button></div>
    </form>
    <form id="gc-join" novalidate hidden>
      <div class="field"><label for="gc-link">Enlace o código de invitación</label><input type="text" id="gc-link" placeholder="Pega aquí el enlace que te enviaron" spellcheck="false" autocomplete="off"></div>
      <p class="conn-result is-err" id="gj-err" role="status"></p>
      <div class="conn-actions"><button type="submit" class="btn btn--primary">Unirme</button></div>
    </form>
  </div>`);
function gOpenCreate(tab = "create") {
  $("#gc-err").textContent = ""; $("#gj-err").textContent = "";
  gcTab(tab); openDialog(gCreateDlg);
}
function gcTab(t) {
  $("#gc-tabs").style.setProperty("--i", t === "join" ? 1 : 0);
  $$("#gc-tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.gc === t));
  $("#gc-create").hidden = t !== "create"; $("#gc-join").hidden = t !== "join";
}
gCreateDlg.addEventListener("click", (e) => { const b = e.target.closest("[data-gc]"); if (b) gcTab(b.dataset.gc); });
$("#gc-create").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#gc-name").value.trim();
  if (!name) return ($("#gc-err").textContent = "Ponle un nombre al grupo.");
  const me = gMe(), ref = fbDb.collection("groups").doc();
  try {
    await ref.set({ name, emoji: $("input[name=gc-emoji]:checked").value, color: $("input[name=gc-color]:checked").value, ownerId: me.uid, createdAt: Date.now(),
      inviteCode: gCode(), memberIds: [me.uid], members: { [me.uid]: "owner" }, memberInfo: { [me.uid]: gMeInfo() }, pendingEmails: [] });
    $("#gc-name").value = ""; closeDialog(gCreateDlg); showToast("Grupo creado"); setView("grp:" + ref.id);
  } catch (er) { $("#gc-err").textContent = gErr(er); }
});
function gParseJoin(txt) {
  const m = String(txt).match(/join=([A-Za-z0-9]+)\.([a-z0-9]+)/) || String(txt).trim().match(/^([A-Za-z0-9]{15,})\.([a-z0-9]{6,})$/);
  return m ? { gid: m[1], code: m[2] } : null;
}
$("#gc-join").addEventListener("submit", async (e) => {
  e.preventDefault();
  const p = gParseJoin($("#gc-link").value);
  if (!p) return ($("#gj-err").textContent = "Ese enlace no es válido. Pide uno nuevo a quien te invitó.");
  try { await gJoin(p.gid, p.code); closeDialog(gCreateDlg); } catch (er) { $("#gj-err").textContent = gErr(er); }
});
async function gJoin(gid, code) {
  const me = gMe();
  if (GR.groups.has(gid)) { setView("grp:" + gid); return; }
  await fbDb.collection("groups").doc(gid).update({ memberIds: gArrayUnion(me.uid), [`members.${me.uid}`]: "member", [`memberInfo.${me.uid}`]: gMeInfo(), joinCode: code });
  showToast("Te uniste al grupo"); setView("grp:" + gid);
}
async function gProcessJoinParam() {
  const q = new URLSearchParams(location.search).get("join");
  const stored = sessionStorage.getItem("tf.join");
  const raw = q || stored;
  if (!raw) return;
  const p = gParseJoin("join=" + raw);
  if (q) history.replaceState(null, "", location.pathname);
  if (!p) return showToast("Enlace de invitación no válido.");
  if (!gOk()) { sessionStorage.setItem("tf.join", raw); showToast("Inicia sesión para unirte al grupo."); typeof openAccount === "function" && openAccount(); return; }
  sessionStorage.removeItem("tf.join");
  try { await gJoin(p.gid, p.code); } catch (er) { showToast("No se pudo unir: " + gErr(er)); }
}
async function gAcceptInvite(gid) {
  const me = gMe();
  try { await fbDb.collection("groups").doc(gid).update({ memberIds: gArrayUnion(me.uid), [`members.${me.uid}`]: "member", [`memberInfo.${me.uid}`]: gMeInfo(), pendingEmails: gArrayRemove(gEmail()) }); showToast("Te uniste al grupo"); setView("grp:" + gid); }
  catch (er) { showToast(gErr(er)); }
}
const gDeclineInvite = (gid) => fbDb.collection("groups").doc(gid).update({ pendingEmails: gArrayRemove(gEmail()) }).catch((er) => showToast(gErr(er)));

/* --- Tarea del grupo --- */
const gTaskDlg = gDialog("g-task-dialog", "", `<form id="gt-form" novalidate>${head('<span id="gt-title-h">Tarea</span>')}
  <div class="sheet__body g-form">
    <div class="field"><label for="gt-title">Título</label><input type="text" id="gt-title" maxlength="120"></div>
    <div class="field"><label for="gt-desc">Notas</label><textarea id="gt-desc" rows="3" maxlength="600" placeholder="Detalles para el grupo…"></textarea></div>
    <div class="g-grid2">
      <div class="field"><label for="gt-who">Responsable</label><select id="gt-who"></select></div>
      <div class="field"><label for="gt-prio">Prioridad</label><select id="gt-prio"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
      <div class="field"><label for="gt-due">Plazo</label><input type="date" id="gt-due"></div>
      <div class="field"><label for="gt-time">Hora</label><input type="time" id="gt-time"></div>
    </div>
    <div class="field" id="gt-parent-wrap"><label for="gt-parent">Parte de</label><select id="gt-parent"></select></div>
    <p class="muted" id="gt-info"></p>
    <p class="conn-result is-err" id="gt-err" role="status"></p>
  </div>
  <footer class="sheet__foot"><button type="button" class="btn btn--danger" id="gt-del" hidden>Eliminar</button><span class="spacer"></span><button type="button" class="btn btn--soft" data-close>Cancelar</button><button type="submit" class="btn btn--primary">Guardar</button></footer></form>`);
let gtEditing = null, gtBase = null, gtDelArmed = false;
function gOpenTask(id, preset = {}) {
  const g = gGroup(); if (!g) return;
  const t = id ? GR.tasks.find((x) => x.id === id) : null;
  gtEditing = id; gtDelArmed = false;
  gtBase = { title: t?.title || preset.title || "", description: t?.description || "", assigneeId: t?.assigneeId || preset.assigneeId || "", priority: t?.priority || "media", due: t?.due || preset.due || "", time: t?.time || "", parentId: t?.parentId || preset.parentId || "" };
  $("#gt-title-h").textContent = t ? (t.isParent ? "Trabajo" : "Editar tarea") : "Nueva tarea del grupo";
  $("#gt-title").value = gtBase.title; $("#gt-desc").value = gtBase.description;
  $("#gt-who").innerHTML = `<option value="">Sin asignar</option>` + g.memberIds.map((u) => `<option value="${u}" ${u === gtBase.assigneeId ? "selected" : ""}>${esc(gName(u, g))}${u === gMe().uid ? " (yo)" : ""}</option>`).join("");
  $("#gt-prio").value = gtBase.priority; $("#gt-due").value = gtBase.due; $("#gt-time").value = gtBase.time;
  const parents = GR.tasks.filter((p) => p.isParent && p.id !== id);
  $("#gt-parent-wrap").hidden = !!t?.isParent || !parents.length;
  $("#gt-parent").innerHTML = `<option value="">— Tarea suelta —</option>` + parents.map((p) => `<option value="${p.id}" ${p.id === gtBase.parentId ? "selected" : ""}>${esc(p.title)}</option>`).join("");
  $("#gt-info").textContent = t ? `Creada por ${gName(t.createdBy)}${t.updatedBy ? " · última edición de " + gName(t.updatedBy) : ""}` : "";
  $("#gt-err").textContent = ""; $("#gt-del").hidden = !t; $("#gt-del").textContent = "Eliminar";
  openDialog(gTaskDlg); setTimeout(() => $("#gt-title").focus(), 80);
}
$("#gt-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#gt-title").value.trim();
  if (!title) return ($("#gt-err").textContent = "Escribe un título.");
  const now = { title, description: $("#gt-desc").value.trim(), assigneeId: $("#gt-who").value, priority: $("#gt-prio").value, due: $("#gt-due").value, time: $("#gt-due").value ? $("#gt-time").value : "", parentId: $("#gt-parent-wrap").hidden ? gtBase.parentId : $("#gt-parent").value };
  // Solo se envían los campos que ESTA persona cambió: así no se pisan las ediciones simultáneas de otros
  const diff = {}; Object.keys(now).forEach((k) => { if (now[k] !== gtBase[k]) diff[k] = now[k]; });
  try {
    if (gtEditing) { if (Object.keys(diff).length) await gSaveTask(gtEditing, diff); }
    else await gSaveTask(null, now);
    closeDialog(gTaskDlg);
  } catch (er) { $("#gt-err").textContent = gErr(er); }
});
$("#gt-del").addEventListener("click", async () => {
  if (!gtDelArmed) { gtDelArmed = true; $("#gt-del").textContent = "¿Seguro? Pulsa otra vez"; return; }
  try {
    const t = GR.tasks.find((x) => x.id === gtEditing);
    const b = fbDb.batch(); b.delete(fbDb.doc(`groups/${GR.active}/tasks/${gtEditing}`));
    if (t?.isParent) GR.tasks.filter((k) => k.parentId === t.id).forEach((k) => b.delete(fbDb.doc(`groups/${GR.active}/tasks/${k.id}`)));
    await b.commit(); closeDialog(gTaskDlg); showToast("Tarea eliminada");
  } catch (er) { $("#gt-err").textContent = gErr(er); }
});
async function gSaveTask(id, fields) {
  const now = Date.now(), base = { updatedAt: now, updatedBy: gMe().uid };
  if (fields.done !== undefined) fields.completedAt = fields.done ? now : null;
  const col = fbDb.collection(`groups/${GR.active}/tasks`);
  if (id) return col.doc(id).update({ ...fields, ...base });
  return col.doc().set({ title: "", description: "", assigneeId: "", priority: "media", due: "", time: "", parentId: "", done: false, completedAt: null, isParent: false, ...fields, ...base, createdBy: gMe().uid, createdAt: now });
}

/* --- Repartir trabajo --- */
const gSplitDlg = gDialog("g-split-dialog", "sheet--wide", `<form id="gs-form" novalidate>${head("Repartir trabajo")}
  <div class="sheet__body g-form">
    <p class="muted">Divide un trabajo en partes, asigna cada una a un miembro y se calculan plazos escalonados hasta la fecha final.</p>
    <div class="field"><label for="gs-title">Trabajo</label><input type="text" id="gs-title" maxlength="120" placeholder="Ej: Presentación de Historia"></div>
    <div class="g-grid2"><div class="field"><label for="gs-from">Empezar el</label><input type="date" id="gs-from"></div><div class="field"><label for="gs-due">Fecha límite final</label><input type="date" id="gs-due"></div></div>
    <fieldset class="field fieldset"><legend>¿Quién participa?</legend><div class="g-who" id="gs-who"></div></fieldset>
    <div class="field"><label for="gs-parts">Partes (una por línea)</label><textarea id="gs-parts" rows="5" placeholder="Investigar el contexto&#10;Redactar el guion&#10;Diseñar las diapositivas&#10;Ensayar la exposición"></textarea></div>
    <div id="gs-preview" class="g-preview" aria-live="polite"></div>
    <p class="conn-result is-err" id="gs-err" role="status"></p>
  </div>
  <footer class="sheet__foot"><span class="spacer"></span><button type="button" class="btn btn--soft" data-close>Cancelar</button><button type="submit" class="btn btn--primary">Crear reparto</button></footer></form>`);
function gOpenSplit() {
  const g = gGroup(); if (!g) return;
  $("#gs-title").value = ""; $("#gs-parts").value = ""; $("#gs-err").textContent = "";
  $("#gs-from").value = todayISO(); $("#gs-due").value = iso(addDays(new Date(), 14));
  $("#gs-who").innerHTML = g.memberIds.map((u) => `<label class="g-pick"><input type="checkbox" value="${u}" checked>${gAva(u, g, "g-av--xs")}<span>${esc(gName(u, g))}${u === gMe().uid ? " (yo)" : ""}</span></label>`).join("");
  gsPreview(); openDialog(gSplitDlg);
}
function gsPlan() {
  const parts = $("#gs-parts").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const who = $$("#gs-who input:checked").map((i) => i.value);
  const from = $("#gs-from").value, to = $("#gs-due").value;
  if (!parts.length || !who.length || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  const span = Math.max(1, Math.round((fromISO(to) - fromISO(from)) / 86400000));
  return parts.map((text, i) => ({ text, who: who[i % who.length], due: iso(addDays(fromISO(from), Math.max(i === parts.length - 1 ? span : 1, Math.round(((i + 1) * span) / parts.length)))) }));
}
function gsPreview() {
  const plan = gsPlan();
  $("#gs-preview").innerHTML = plan.length ? plan.map((p, i) => `<div class="g-prow"><span class="muted">${i + 1}</span><span>${esc(p.text)}</span>${gAva(p.who, undefined, "g-av--xs")}<span class="gt-chip">${icon("calendar")}${esc(relDay(p.due))}</span></div>`).join("") : `<p class="muted">Escribe las partes y verás aquí cómo se reparten.</p>`;
}
gSplitDlg.addEventListener("input", gsPreview); gSplitDlg.addEventListener("change", gsPreview);
$("#gs-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#gs-title").value.trim(), plan = gsPlan();
  if (!title) return ($("#gs-err").textContent = "Ponle un nombre al trabajo.");
  if (!plan.length) return ($("#gs-err").textContent = "Añade al menos una parte, un miembro y las dos fechas.");
  const now = Date.now(), col = fbDb.collection(`groups/${GR.active}/tasks`), b = fbDb.batch(), pRef = col.doc(), meId = gMe().uid;
  const common = { description: "", priority: "media", time: "", done: false, completedAt: null, createdBy: meId, createdAt: now, updatedAt: now, updatedBy: meId };
  b.set(pRef, { ...common, title, assigneeId: "", due: $("#gs-due").value, parentId: "", isParent: true });
  plan.forEach((p, i) => b.set(col.doc(), { ...common, title: p.text, assigneeId: p.who, due: p.due, parentId: pRef.id, isParent: false, createdAt: now + i }));
  try { await b.commit(); closeDialog(gSplitDlg); showToast(`Reparto creado: ${plan.length} partes`); } catch (er) { $("#gs-err").textContent = gErr(er); }
});

/* --- Ajustes e invitación --- */
const gInfoDlg = gDialog("g-info-dialog", "sheet--wide", `${head("Grupo")}<div class="sheet__body g-form" id="gi-body"></div>`);
function gOpenInfo() { gRenderInfo(); openDialog(gInfoDlg); }
function gRenderInfo() {
  const g = gGroup(); if (!g) return;
  const link = `${REDIRECT}?join=${g.id}.${g.inviteCode}`;
  $("#gi-body").innerHTML = `
    <section class="conn-card g-card"><header class="conn-card__head"><span class="conn-logo conn-logo--brand">${icon("link")}</span><div><h3>Invitar</h3><p>Cualquiera con este enlace puede unirse</p></div></header>
      <div class="copy-row"><code>${esc(link)}</code><button type="button" class="btn btn--soft btn--sm" data-g="copy" data-text="${esc(link)}">${icon("copy")} Copiar</button></div>
      <form id="gi-mail" class="g-mail" novalidate><div class="field"><label for="gi-email">O invita por correo</label><input type="email" id="gi-email" placeholder="amigo@correo.com" spellcheck="false"></div><button type="submit" class="btn btn--primary btn--sm">Invitar</button></form>
      <p class="muted">La persona verá la invitación al iniciar sesión con ese correo (verificado). Para avisarla, envíale también el enlace.</p><p class="conn-result is-err" id="gi-err"></p></section>
    <section class="conn-card g-card"><header class="conn-card__head"><span class="conn-logo conn-logo--brand">${esc(g.emoji || "👥")}</span><div><h3>Ajustes</h3><p>Cualquier miembro puede cambiarlos</p></div></header>
      <form id="gi-set" novalidate><div class="field"><label for="gi-name">Nombre</label><input type="text" id="gi-name" maxlength="40" value="${esc(g.name)}"></div>
      <fieldset class="field fieldset"><legend>Icono</legend><div class="emojis">${emojis("gi-emoji", g.emoji || G_EMOJI[0])}</div></fieldset>
      <fieldset class="field fieldset"><legend>Color</legend><div class="swatches swatches--lg">${swatches("gi-color", g.color || G_COLORS[0])}</div></fieldset>
      <div class="conn-actions"><button type="submit" class="btn btn--primary btn--sm">Guardar</button></div></form></section>
    <section class="conn-card g-card"><div class="conn-actions">
      ${gRole(g) === "owner"
        ? `<button type="button" class="btn btn--danger btn--sm" data-g="delete-group" data-confirm="0">Eliminar grupo para todos</button>`
        : `<button type="button" class="btn btn--danger btn--sm" data-g="leave" data-confirm="0">Salir del grupo</button>`}</div></section>`;
}
gInfoDlg.addEventListener("submit", async (e) => {
  e.preventDefault();
  const g = gGroup(); if (!g) return;
  try {
    if (e.target.id === "gi-set") {
      const name = $("#gi-name").value.trim(); if (!name) return;
      await fbDb.collection("groups").doc(g.id).update({ name, emoji: $("input[name=gi-emoji]:checked").value, color: $("input[name=gi-color]:checked").value });
      showToast("Ajustes guardados");
    } else if (e.target.id === "gi-mail") {
      const em = $("#gi-email").value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(em)) return ($("#gi-err").textContent = "Escribe un correo válido.");
      if (!gIsAdmin(g)) return ($("#gi-err").textContent = "Solo los administradores pueden invitar por correo. Comparte el enlace.");
      if (Object.values(g.memberInfo || {}).some((m) => (m.email || "").toLowerCase() === em)) return ($("#gi-err").textContent = "Esa persona ya está en el grupo.");
      await fbDb.collection("groups").doc(g.id).update({ pendingEmails: gArrayUnion(em) });
      $("#gi-email").value = ""; $("#gi-err").textContent = ""; showToast("Invitación creada");
    }
  } catch (er) { $("#gi-err") && ($("#gi-err").textContent = gErr(er)); showToast(gErr(er)); }
});

/* ===================== Acciones ===================== */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-g]");
  if (!b) return;
  const a = b.dataset.g, g = gGroup(), id = b.dataset.id;
  try {
    if (a === "accept") return gAcceptInvite(b.dataset.gid);
    if (a === "decline") return gDeclineInvite(b.dataset.gid);
    if (!gOk() || !g && a !== "copy") return;
    if (a === "tab") { GR.tab = b.dataset.tab; gRenderTabs(); if (GR.tab === "chat") { gMarkSeen(); const bx = $("#g-msgs"); bx.scrollTop = bx.scrollHeight; setTimeout(() => $("#g-chat-input").focus({ preventScroll: true }), 60); } }
    else if (a === "filter") { GR.filter = b.dataset.f; gRenderTasks(); }
    else if (a === "toggle") { const t = GR.tasks.find((x) => x.id === id); if (t) gSaveTask(id, { done: !t.done }); }
    else if (a === "edit") gOpenTask(id);
    else if (a === "add-child") gOpenTask(null, { parentId: id });
    else if (a === "split") gOpenSplit();
    else if (a === "invite" || a === "settings") gOpenInfo();
    else if (a === "copy") { try { await navigator.clipboard.writeText(b.dataset.text); showToast("Enlace copiado"); } catch { showToast("Cópialo manualmente."); } }
    else if (a === "del-msg") await fbDb.doc(`groups/${g.id}/messages/${id}`).delete();
    else if (a === "role") { const u = b.dataset.uid; await fbDb.collection("groups").doc(g.id).update({ [`members.${u}`]: g.members[u] === "admin" ? "member" : "admin" }); }
    else if (a === "unpend") await fbDb.collection("groups").doc(g.id).update({ pendingEmails: gArrayRemove(b.dataset.email) });
    else if (a === "kick" || a === "leave" || a === "delete-group") {
      if (b.dataset.confirm === "0") { b.dataset.confirm = "1"; b.dataset.label = b.textContent; b.textContent = "¿Seguro? Pulsa otra vez"; setTimeout(() => { if (b.isConnected) { b.dataset.confirm = "0"; b.textContent = b.dataset.label; } }, 4000); return; }
      if (a === "kick") { const u = b.dataset.uid; await fbDb.collection("groups").doc(g.id).update({ memberIds: gArrayRemove(u), [`members.${u}`]: firebase.firestore.FieldValue.delete(), [`memberInfo.${u}`]: firebase.firestore.FieldValue.delete() }); showToast("Miembro quitado"); }
      else if (a === "leave") { const u = gMe().uid; closeDialog(gInfoDlg); setView("today"); await fbDb.collection("groups").doc(g.id).update({ memberIds: gArrayRemove(u), [`members.${u}`]: firebase.firestore.FieldValue.delete(), [`memberInfo.${u}`]: firebase.firestore.FieldValue.delete() }); showToast("Saliste del grupo"); }
      else { await gDeleteGroup(g); }
    }
  } catch (er) { showToast(gErr(er)); }
});
async function gDeleteGroup(g) {
  closeDialog(gInfoDlg); setView("today"); gCloseActive();
  for (const sub of ["tasks", "messages"]) {
    const snap = await fbDb.collection(`groups/${g.id}/${sub}`).get();
    for (let i = 0; i < snap.docs.length; i += 400) { const b = fbDb.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
  }
  await fbDb.collection("groups").doc(g.id).delete();
  showToast("Grupo eliminado");
}
document.addEventListener("submit", async (e) => {
  if (e.target.id === "g-quick") {
    e.preventDefault();
    const input = $("#g-quick-input"), title = input.value.trim();
    if (!title) return;
    input.value = "";
    try { await gSaveTask(null, { title }); } catch (er) { showToast(gErr(er)); input.value = title; }
  } else if (e.target.id === "g-chat-form") {
    e.preventDefault();
    const ta = $("#g-chat-input"), text = ta.value.trim();
    if (!text) return;
    ta.value = ""; ta.style.height = "auto";
    try { await fbDb.collection(`groups/${GR.active}/messages`).add({ uid: gMe().uid, name: gMeInfo().name, text, at: Date.now() }); } catch (er) { showToast(gErr(er)); ta.value = text; }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.target.id === "g-chat-input" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("#g-chat-form").requestSubmit(); }
  else if (e.target.matches?.("[data-g=edit]") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); gOpenTask(e.target.dataset.id); }
});
document.addEventListener("input", (e) => { if (e.target.id === "g-chat-input") { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; } });

/* Paleta de comandos */
if (typeof integrationCommands === "function") {
  const prev = integrationCommands;
  integrationCommands = function () {
    const cmds = [{ g: "Grupos", l: "Crear o unirme a un grupo…", ic: "users", run: () => (gOk() ? gOpenCreate() : openAccount()) }];
    GR.groups.forEach((g) => cmds.push({ g: "Grupos", l: `Abrir grupo: ${g.name}`, ic: "users", run: () => setView("grp:" + g.id) }));
    return [...cmds, ...prev()];
  };
}
renderGroupNav();
gProcessJoinParam();
