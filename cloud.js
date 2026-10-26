"use strict";

/* =====================================================================
   TaskFlow · Cuentas de usuario y base de datos en la nube (Firebase)
   - Registro e inicio de sesión con correo, Google o Apple
   - Cada persona tiene su propio espacio privado en Firestore
     (tareas, listas y ajustes sincronizados entre dispositivos)
   - Los conectores (Google, Outlook, Spotify) solo se vinculan si su correo
     coincide con el de la cuenta TaskFlow (ver integrations.js: verifyLinked)
   - Los tokens de conectores y las claves de IA NUNCA se suben a la nube
   Si cloud-config.js está vacío, la app sigue funcionando solo en local.
   Se carga la última, después de app.js, integrations.js y ai.js.
   ===================================================================== */

const FB_CFG = window.TF_FIREBASE || {};
const cloudOn = !!(FB_CFG.apiKey && FB_CFG.projectId);
const FB_VER = "10.14.1";
const LS_UID = "taskflow.uid";
const DEVICE = (() => {
  try { let d = localStorage.getItem("taskflow.device"); if (!d) { d = uid(); localStorage.setItem("taskflow.device", d); } return d; } catch { return uid(); }
})();

let fbAuth = null, fbDb = null, fbUser = null;
let cloudStatus = cloudOn ? "idle" : "off"; // off | idle | sync | ok | error | offline
let cloudError = "";
let unsubState = null, pushTimer = null, applyingRemote = false, lastSyncAt = 0;
let readyResolve;
const readyP = new Promise((r) => { readyResolve = r; });

const cloudRequired = () => cloudOn;
const cloudUser = () => fbUser;
const cloudReady = () => (cloudOn ? Promise.race([readyP, new Promise((r) => setTimeout(r, 8000))]) : Promise.resolve());

/* ===== Textos de error ===== */
const AUTH_ERR = {
  "auth/invalid-email": "Ese correo no es válido.",
  "auth/user-not-found": "No existe ninguna cuenta con ese correo.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ese correo ya tiene cuenta. Entra con el método con el que te registraste.",
  "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a probar.",
  "auth/popup-closed-by-user": "Cerraste la ventana antes de terminar.",
  "auth/cancelled-popup-request": "Ya hay una ventana de acceso abierta.",
  "auth/network-request-failed": "Sin conexión con el servidor.",
  "auth/account-exists-with-different-credential": "Ya existe una cuenta con ese correo usando otro método (correo, Google o Apple). Entra con ese método.",
  "auth/unauthorized-domain": "Esta dirección web no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados).",
  "auth/operation-not-allowed": "Ese método de acceso no está activado en Firebase.",
  "auth/requires-recent-login": "Por seguridad, cierra sesión, vuelve a entrar y repite la acción.",
  "auth/user-disabled": "Esta cuenta está desactivada.",
};
const authError = (e) => AUTH_ERR[e?.code] || e?.message || "Algo salió mal.";

/* ===== Carga del SDK (solo si hay configuración) ===== */
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src));
    document.head.append(s);
  });
}
async function initCloud() {
  if (!cloudOn) { readyResolve(); return; }
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    await loadScript(base + "firebase-app-compat.js");
    await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-firestore-compat.js")]);
    firebase.initializeApp(FB_CFG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbAuth.languageCode = "es";
    fbAuth.getRedirectResult().catch((e) => showToast(authError(e)));
    fbAuth.onAuthStateChanged(onAuth);
  } catch (e) {
    cloudStatus = "offline"; cloudError = e.message; readyResolve(); renderAccountBtn();
  }
}

/* ===== Sincronización de datos ===== */
function wipeLocal() {
  ["taskflow.v2", "taskflow.conn", "taskflow.chat", "taskflow.tasks", LS_UID].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignorar */ } });
}
function parseRemote(d) {
  const s = JSON.parse(d.json);
  s.savedAt = d.savedAt || s.savedAt || 0;
  return s;
}
function adopt(s) {
  applyingRemote = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    state = load();
    applyTheme();
    render();
  } finally { applyingRemote = false; }
}
function mergeStates(remote, local) {
  const byId = (a, b) => { const m = new Map(); [...(b || []), ...(a || [])].forEach((x) => m.set(x.id, x)); return [...m.values()]; };
  const done = { ...(local.done || {}) };
  Object.entries(remote.done || {}).forEach(([k, v]) => { done[k] = Math.max(done[k] || 0, v); });
  return {
    ...local, ...remote,
    tasks: byId(remote.tasks, local.tasks),
    categories: byId(remote.categories, local.categories),
    done, pomo: { ...(local.pomo || {}), ...(remote.pomo || {}) },
    log: [...(local.log || []), ...(remote.log || [])].slice(-50),
    savedAt: Date.now(),
  };
}

async function bootstrap(user) {
  cloudStatus = "sync"; cloudError = ""; renderAccountBtn();
  const prev = localStorage.getItem(LS_UID);
  const same = prev === user.uid;
  if (prev && !same) { // otra persona usó antes este dispositivo: nunca se mezclan sus datos
    stopSync(); wipeLocal(); state = load(); conn = loadConn(); applyTheme(); render();
  }
  localStorage.setItem(LS_UID, user.uid);
  const ref = fbDb.doc(`users/${user.uid}/data/state`);
  const snap = await ref.get();
  if (snap.exists) {
    const remote = parseRemote(snap.data());
    if (same) { if ((remote.savedAt || 0) > (state.savedAt || 0)) adopt(remote); else await pushNow(); }
    else { adopt(mergeStates(remote, state)); await pushNow(); }
  } else await pushNow();

  const uref = fbDb.doc(`users/${user.uid}`);
  const us = await uref.get();
  const meta = { email: user.email || "", name: user.displayName || "", provider: user.providerData[0]?.providerId || "password", lastLogin: firebase.firestore.FieldValue.serverTimestamp() };
  if (!us.exists) meta.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  await uref.set(meta, { merge: true });

  startSync(ref);
  if (user.email && (!conn.linkEmail || !same)) { conn.linkEmail = user.email; saveConn(); }
  cloudStatus = "ok"; lastSyncAt = Date.now();
}

function startSync(ref) {
  stopSync();
  unsubState = ref.onSnapshot((snap) => {
    if (!snap.exists || snap.metadata.hasPendingWrites) return;
    const d = snap.data();
    if (d.device === DEVICE) return;
    const r = parseRemote(d);
    if ((r.savedAt || 0) > (state.savedAt || 0)) { adopt(r); lastSyncAt = Date.now(); showToast("Sincronizado desde otro dispositivo"); renderAccountBtn(); }
  }, () => { cloudStatus = "error"; renderAccountBtn(); });
}
function stopSync() { if (unsubState) { unsubState(); unsubState = null; } clearTimeout(pushTimer); }

function cloudPush() { // lo llama save() en app.js
  if (!fbUser || !fbDb || applyingRemote) return;
  clearTimeout(pushTimer);
  cloudStatus = "sync"; renderAccountBtn();
  pushTimer = setTimeout(() => pushNow().catch((e) => { cloudStatus = "error"; cloudError = e.message; renderAccountBtn(); }), 1200);
}
async function pushNow() {
  if (!fbUser) return;
  if (!state.savedAt) state.savedAt = Date.now();
  const json = JSON.stringify({ ...state, log: (state.log || []).slice(-50) });
  if (json.length > 900000) throw new Error("Hay demasiados datos para sincronizar (límite 900 KB).");
  await fbDb.doc(`users/${fbUser.uid}/data/state`).set({ json, savedAt: state.savedAt, device: DEVICE });
  lastSyncAt = Date.now(); cloudStatus = "ok"; cloudError = "";
  renderAccountBtn();
  if (accDlg.open) renderAccount();
}

/* Conectores vinculados (solo el correo, nunca tokens) */
function cloudRecordLink(provider, email) {
  if (!fbUser || !fbDb) return;
  const v = email ? { email, linkedAt: Date.now() } : firebase.firestore.FieldValue.delete();
  fbDb.doc(`users/${fbUser.uid}`).set({ connectors: { [provider]: v } }, { merge: true }).catch(() => { /* sin conexión: se reintentará al vincular de nuevo */ });
}

async function onAuth(user) {
  fbUser = user;
  if (user) {
    try { await bootstrap(user); }
    catch (e) { cloudStatus = "error"; cloudError = e.code === "permission-denied" ? "Faltan las reglas de seguridad de Firestore (ver README)." : e.message; showToast("Sincronización: " + cloudError); }
  } else { stopSync(); cloudStatus = "idle"; }
  readyResolve();
  if (typeof groupsOnAuth === "function") groupsOnAuth(user);
  renderAccountBtn();
  if (accDlg.open) renderAccount();
  if (connDlg.open) renderConn();
}

/* ===== Interfaz: botón y diálogo de cuenta ===== */
const APPLE_LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#000" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.800-.8-3-.8c-1.500 0-3 .9-3.800 2.300-1.600 2.800-.4 7 1.200 9.300.8 1.100 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7 2-1.100 2.800-2.200c.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.900zM14.200 5.800c.6-.8 1.100-1.800.9-2.800-.9 0-2 .6-2.600 1.400-.6.700-1.100 1.700-.9 2.700 1 .1 2-.5 2.600-1.300z"/></svg>`;
if (!ICONS.user) ICONS.user = '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.800 8 7"/>';

const accDlg = (() => {
  const d = document.createElement("dialog");
  d.className = "sheet glass"; d.id = "account-dialog"; d.setAttribute("aria-labelledby", "acc-title");
  d.innerHTML = `<header class="sheet__head"><h2 id="acc-title">Cuenta</h2>
      <button type="button" class="icon-btn icon-btn--sm" data-close aria-label="Cerrar">${icon("x")}</button></header>
    <div class="sheet__body conn-body" id="acc-body"></div>
    <footer class="sheet__foot"><span class="spacer"></span><button type="button" class="btn btn--primary" data-close>Listo</button></footer>`;
  document.body.append(d);
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
  d.addEventListener("mousedown", (e) => { if (e.target === d) closeDialog(d); });
  d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeDialog(d)));
  return d;
})();

const accBtn = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "icon-btn account-btn"; b.id = "btn-account";
  $(".topbar__actions").append(b);
  b.addEventListener("click", () => openAccount());
  return b;
})();

function renderAccountBtn() {
  const u = fbUser;
  const label = u ? `Cuenta: ${u.email || u.displayName}` : "Iniciar sesión o crear cuenta";
  accBtn.title = label; accBtn.setAttribute("aria-label", label);
  const ini = u ? (u.displayName || u.email || "?").trim().charAt(0).toUpperCase() : "";
  accBtn.innerHTML = (u ? `<span class="avatar">${esc(ini)}</span>` : icon("user")) +
    (u ? `<i class="sync-dot is-${cloudStatus}" title="${cloudStatus === "ok" ? "Sincronizado" : cloudStatus === "sync" ? "Sincronizando…" : "Error de sincronización"}"></i>` : "");
  if (typeof renderDock === "function") renderDock();
}

let authTab = "login", authBusy = false, authMsg = "", confirmAct = "";
function openAccount(tab) {
  if (tab) authTab = tab;
  authMsg = ""; confirmAct = "";
  renderAccount();
  openDialog(accDlg);
}
const fmtAgo = (t) => { if (!t) return "—"; const s = Math.round((Date.now() - t) / 1000); return s < 10 ? "ahora mismo" : s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : `hace ${Math.round(s / 3600)} h`; };
const PROVIDER_NAME = { password: "Correo y contraseña", "google.com": "Google", "apple.com": "Apple" };

function renderAccount() {
  const body = $("#acc-body");
  if (!cloudOn) {
    body.innerHTML = `<div class="notice is-warn"><p><strong>Las cuentas todavía no están activadas.</strong> Para que cada persona pueda registrarse (correo, Google o Apple) y tener su propia base de datos hace falta conectar un proyecto gratuito de Firebase.</p>
      <p>Sigue la guía <b>README → “Cuentas y base de datos”</b> y pega la configuración en <code>cloud-config.js</code>. Mientras tanto, TaskFlow funciona igual guardando todo en este dispositivo.</p></div>`;
    return;
  }
  if (cloudStatus === "offline") { body.innerHTML = `<div class="notice is-warn"><p>No se pudo cargar el servicio de cuentas (${esc(cloudError)}). Comprueba tu conexión; la app sigue funcionando en local.</p></div>`; return; }
  body.innerHTML = fbUser ? profileHTML() : authHTML();
}

function authHTML() {
  const signup = authTab === "signup";
  return `
    <div class="seg" style="--n:2;--i:${signup ? 1 : 0}" role="tablist">
      <button type="button" data-acc="tab-login" aria-pressed="${!signup}">Entrar</button>
      <button type="button" data-acc="tab-signup" aria-pressed="${signup}">Crear cuenta</button>
    </div>
    <div class="sso">
      <button type="button" class="sso-btn" data-acc="google"><span class="sso-logo">${LOGOS.google}</span>Continuar con Google</button>
      <button type="button" class="sso-btn" data-acc="apple"><span class="sso-logo">${APPLE_LOGO}</span>Continuar con Apple</button>
    </div>
    <p class="auth-or"><span>o con tu correo</span></p>
    <form id="acc-form" autocomplete="on" novalidate>
      ${signup ? `<div class="field"><label for="acc-name">Nombre <span class="muted">(opcional)</span></label><input type="text" id="acc-name" autocomplete="name" maxlength="60"></div>` : ""}
      <div class="field"><label for="acc-email">Correo electrónico</label><input type="email" id="acc-email" autocomplete="email" required placeholder="tu@correo.com" spellcheck="false"></div>
      <div class="field"><label for="acc-pass">Contraseña ${signup ? '<span class="muted">(mínimo 8 caracteres)</span>' : ""}</label><input type="password" id="acc-pass" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8"></div>
      <p class="conn-result ${authMsg ? "is-err" : ""}" id="acc-msg" role="status">${esc(authMsg)}</p>
      <div class="conn-actions">
        ${signup ? "" : `<button type="button" class="btn btn--ghost btn--sm" data-acc="reset">He olvidado mi contraseña</button>`}
        <button type="submit" class="btn btn--primary" ${authBusy ? "disabled" : ""}>${signup ? "Crear cuenta" : "Entrar"}</button>
      </div>
    </form>
    <p class="muted">Tus tareas se guardan en tu propio espacio privado y se sincronizan entre tus dispositivos. Nadie más puede verlas. Si ya tenías tareas en este dispositivo, se añadirán a tu cuenta.</p>`;
}

function profileHTML() {
  const u = fbUser;
  const prov = PROVIDER_NAME[u.providerData[0]?.providerId] || "Correo";
  const relay = /privaterelay\.appleid\.com$/i.test(u.email || "");
  const st = { ok: "Sincronizado", sync: "Sincronizando…", error: "Error de sincronización", idle: "…" }[cloudStatus] || "";
  const link = (id, name) => {
    const em = conn.links?.[id];
    return `<div class="pop__row"><span>${name}</span><span class="${em ? "status is-on" : "status"}">${em ? esc(em) : "Sin vincular"}</span></div>`;
  };
  return `
    <section class="conn-card">
      <header class="conn-card__head"><span class="conn-logo acc-avatar">${esc((u.displayName || u.email || "?").charAt(0).toUpperCase())}</span>
        <div><h3>${esc(u.displayName || "Tu cuenta")}</h3><p>${esc(u.email || "")}</p></div><span class="status is-on">${esc(prov)}</span></header>
      ${u.emailVerified ? "" : `<div class="notice is-warn"><p><strong>Verifica tu correo.</strong> Te enviamos un mensaje al registrarte; hasta confirmarlo no podrás vincular conectores.</p>
        <div class="conn-actions"><button type="button" class="btn btn--soft btn--sm" data-acc="resend">Reenviar correo</button><button type="button" class="btn btn--primary btn--sm" data-acc="verified">Ya lo verifiqué</button></div></div>`}
      ${relay ? `<div class="notice is-warn"><p>Usas el correo privado de Apple. Google y Outlook no pueden coincidir con él: cierra sesión y entra de nuevo eligiendo <em>Compartir mi correo</em>, o regístrate con tu correo real.</p></div>` : ""}
      ${authMsg ? `<p class="conn-result is-err" role="status">${esc(authMsg)}</p>` : ""}
    </section>

    <section class="conn-card">
      <header class="conn-card__head"><span class="conn-logo" style="--c:var(--accent)">${icon("reset")}</span><div><h3>Base de datos</h3><p>${st}${cloudError ? " · " + esc(cloudError) : ""} · última vez ${fmtAgo(lastSyncAt)}</p></div></header>
      <p class="muted">Tus tareas, listas y ajustes viven en tu espacio privado. Las claves de IA y los tokens de los conectores se quedan solo en este dispositivo.</p>
      <div class="conn-actions"><button type="button" class="btn btn--soft btn--sm" data-acc="sync">Sincronizar ahora</button></div>
    </section>

    <section class="conn-card">
      <header class="conn-card__head"><span class="conn-logo" style="--c:var(--accent)">${icon("plug")}</span><div><h3>Conectores vinculados</h3><p>Solo se vinculan cuentas con el correo <b>${esc(u.email || "")}</b></p></div></header>
      ${link("google", "Google")}${link("microsoft", "Outlook")}${link("spotify", "Spotify")}
      <div class="conn-actions"><button type="button" class="btn btn--soft btn--sm" data-action="open-conn" data-tab="accounts">Gestionar conectores</button></div>
    </section>

    <section class="conn-card">
      <div class="conn-actions">
        ${confirmAct === "out"
          ? `<span class="muted">Se borrarán los datos de este dispositivo (siguen en tu cuenta).</span><button type="button" class="btn btn--primary btn--sm" data-acc="signout-yes">Cerrar sesión</button>`
          : `<button type="button" class="btn btn--soft btn--sm" data-acc="signout">Cerrar sesión</button>`}
        ${confirmAct === "del"
          ? `<span class="muted">Se borrará tu cuenta y todos tus datos. No se puede deshacer.</span><button type="button" class="btn btn--danger btn--sm" data-acc="delete-yes">Sí, eliminar todo</button>`
          : `<button type="button" class="btn btn--danger btn--sm" data-acc="delete">Eliminar cuenta y datos</button>`}
      </div>
    </section>`;
}

/* ===== Acciones ===== */
const setMsg = (m) => { authMsg = m; const el = $("#acc-msg"); if (el) { el.textContent = m; el.className = "conn-result" + (m ? " is-err" : ""); } else renderAccount(); };

async function socialLogin(kind) {
  let prov;
  if (kind === "google") { prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: "select_account" }); }
  else { prov = new firebase.auth.OAuthProvider("apple.com"); prov.addScope("email"); prov.addScope("name"); }
  try { await fbAuth.signInWithPopup(prov); closeDialog(accDlg); }
  catch (e) {
    if (e.code === "auth/popup-blocked") { fbAuth.signInWithRedirect(prov); return; }
    setMsg(authError(e));
  }
}

async function submitAuth() {
  if (authBusy) return;
  const email = $("#acc-email").value.trim(), pass = $("#acc-pass").value, signup = authTab === "signup";
  if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg("Escribe un correo válido.");
  if (pass.length < 8) return setMsg("La contraseña debe tener al menos 8 caracteres.");
  authBusy = true; setMsg(""); $("#acc-form button[type=submit]").disabled = true;
  try {
    if (signup) {
      const cred = await fbAuth.createUserWithEmailAndPassword(email, pass);
      const name = ($("#acc-name")?.value || "").trim();
      if (name) await cred.user.updateProfile({ displayName: name });
      await cred.user.sendEmailVerification().catch(() => {});
      showToast("Cuenta creada. Revisa tu correo para verificarla.");
    } else await fbAuth.signInWithEmailAndPassword(email, pass);
    closeDialog(accDlg);
  } catch (e) { setMsg(authError(e)); }
  finally { authBusy = false; const b = $("#acc-form button[type=submit]"); if (b) b.disabled = false; }
}

accDlg.addEventListener("submit", (e) => { e.preventDefault(); submitAuth(); });
accDlg.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-acc]");
  if (!b) return;
  const a = b.dataset.acc;
  if (a === "tab-login" || a === "tab-signup") { authTab = a === "tab-signup" ? "signup" : "login"; authMsg = ""; renderAccount(); }
  else if (a === "google" || a === "apple") socialLogin(a);
  else if (a === "reset") {
    const email = $("#acc-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg("Escribe primero tu correo arriba.");
    try { await fbAuth.sendPasswordResetEmail(email); setMsg(""); showToast("Si existe esa cuenta, te enviamos un enlace para cambiar la contraseña."); } catch (er) { setMsg(authError(er)); }
  }
  else if (a === "resend") { try { await fbUser.sendEmailVerification(); showToast("Correo de verificación enviado"); } catch (er) { setMsg(authError(er)); renderAccount(); } }
  else if (a === "verified") { await fbUser.reload(); fbUser = fbAuth.currentUser; renderAccount(); if (connDlg.open) renderConn(); }
  else if (a === "sync") { try { cloudStatus = "sync"; renderAccount(); await pushNow(); showToast("Sincronizado"); } catch (er) { cloudStatus = "error"; cloudError = er.message; } renderAccountBtn(); renderAccount(); }
  else if (a === "signout") { confirmAct = "out"; renderAccount(); }
  else if (a === "signout-yes") {
    try { await pushNow(); } catch { /* si falla, los datos siguen en la nube de la última sincronización */ }
    stopSync(); await fbAuth.signOut(); wipeLocal(); location.reload();
  }
  else if (a === "delete") { confirmAct = "del"; renderAccount(); }
  else if (a === "delete-yes") {
    try {
      stopSync();
      await fbDb.doc(`users/${fbUser.uid}/data/state`).delete();
      await fbDb.doc(`users/${fbUser.uid}`).delete();
      await fbUser.delete();
      wipeLocal(); location.reload();
    } catch (er) { confirmAct = ""; authMsg = authError(er); renderAccount(); }
  }
});
document.addEventListener("click", (e) => { if (e.target.closest('[data-action="open-account"]')) openAccount(); });

/* Comando en la paleta y entrada en el dock */
const _prevCommands = typeof integrationCommands === "function" ? integrationCommands : null;
if (_prevCommands) {
  integrationCommands = function () {
    return [{ g: "Cuenta", l: fbUser ? "Mi cuenta y sincronización" : "Iniciar sesión / crear cuenta", ic: "user", run: () => openAccount() }, ..._prevCommands()];
  };
}

renderAccountBtn();
initCloud();
