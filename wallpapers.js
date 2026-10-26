"use strict";

/* =====================================================================
   TaskFlow · Fondos de pantalla
   - 23 fondos ilustrados (vectoriales, se generan en el propio navegador:
     no descargan nada y pesan casi 0): flores, animales, campos, ciudades,
     naturaleza y abstractos.
   - Fondos personales: el usuario sube sus fotos; se guardan solo en su
     dispositivo (IndexedDB) y se reducen a 1920 px.
   - Atenuación y desenfoque ajustables, y rotación automática diaria.
   Se carga después de app.js (usa state, save, applyTheme, $, icon…).
   ===================================================================== */

const WP_W = 1600, WP_H = 900;

/* ---------- Utilidades de dibujo ---------- */
function wpRng(seed) { // mulberry32: mismo dibujo siempre
  let a = seed | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const wpLG = (id, stops, v = "0,0,0,1") => { const [a, b, c, d] = v.split(","); return `<linearGradient id="${id}" x1="${a}" y1="${b}" x2="${c}" y2="${d}">${stops.map(([o, col, op]) => `<stop offset="${o}" stop-color="${col}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("")}</linearGradient>`; };
const wpRG = (id, stops) => `<radialGradient id="${id}">${stops.map(([o, col, op]) => `<stop offset="${o}" stop-color="${col}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("")}</radialGradient>`;
const wpBlur = (id, s) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${s}"/></filter>`;
const wpSVG = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WP_W} ${WP_H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${body}</svg>`;
const wpSky = (id) => `<rect width="${WP_W}" height="${WP_H}" fill="url(#${id})"/>`;
function wpRidge(y, amp, seed, fill, { f = 3, rough = .35, op = 1 } = {}) {
  const r = wpRng(seed), ph = [r() * 6, r() * 6, r() * 6];
  let d = `M0 ${WP_H}L0 ${y}`;
  for (let x = 0; x <= WP_W; x += 16) {
    const t = x / WP_W * Math.PI * 2;
    const v = Math.sin(t * f + ph[0]) * .6 + Math.sin(t * f * 2.3 + ph[1]) * .3 + Math.sin(t * f * 5.1 + ph[2]) * rough * .4;
    d += `L${x} ${(y - v * amp).toFixed(1)}`;
  }
  return `<path d="${d}L${WP_W} ${WP_H}Z" fill="${fill}" opacity="${op}"/>`;
}
function wpStars(n, seed, maxY = WP_H * .7, color = "#fff") {
  const r = wpRng(seed); let s = "";
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * WP_W).toFixed(0)}" cy="${(r() * maxY).toFixed(0)}" r="${(r() * 1.6 + .4).toFixed(1)}" fill="${color}" opacity="${(r() * .6 + .3).toFixed(2)}"/>`;
  return s;
}
function wpBuildings(baseY, n, seed, wMin, wMax, hMin, hMax, fill, { windows = "", edge = "" } = {}) {
  const r = wpRng(seed); let x = -20, s = "";
  while (x < WP_W + 20) {
    const w = wMin + r() * (wMax - wMin), h = hMin + r() * (hMax - hMin);
    s += `<rect x="${x.toFixed(0)}" y="${(baseY - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${fill}"${edge ? ` stroke="${edge}" stroke-width="1.5"` : ""}/>`;
    if (r() > .6) s += `<rect x="${(x + w * .45).toFixed(0)}" y="${(baseY - h - 26).toFixed(0)}" width="3" height="26" fill="${fill}"/>`;
    if (windows) for (let wy = baseY - h + 14; wy < baseY - 12; wy += 16) for (let wx = x + 7; wx < x + w - 9; wx += 13) if (r() > .62) s += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="8" fill="${windows}" opacity="${(r() * .5 + .5).toFixed(2)}"/>`;
    x += w + r() * 6;
  }
  return s;
}
function wpPines(baseY, n, seed, size, fill, op = 1) {
  const r = wpRng(seed); let s = "";
  for (let i = 0; i < n; i++) {
    const x = r() * (WP_W + 100) - 50, h = size * (.7 + r() * .6), w = h * .38, y = baseY + (r() - .5) * 20;
    s += `<path d="M${x.toFixed(0)} ${(y - h).toFixed(0)}l${(w * .45).toFixed(0)} ${(h * .38).toFixed(0)}h-${(w * .18).toFixed(0)}l${(w * .4).toFixed(0)} ${(h * .34).toFixed(0)}h-${(w * .18).toFixed(0)}l${(w * .36).toFixed(0)} ${(h * .3).toFixed(0)}h-${(w * 2.28).toFixed(0)}l${(w * .36).toFixed(0)} -${(h * .3).toFixed(0)}h-${(w * .18).toFixed(0)}l${(w * .4).toFixed(0)} -${(h * .34).toFixed(0)}h-${(w * .18).toFixed(0)}z" fill="${fill}" opacity="${op}"/>`;
  }
  return `<g>${s}<rect x="0" y="${baseY}" width="${WP_W}" height="${WP_H - baseY}" fill="${fill}" opacity="${op}"/></g>`;
}
const wpSun = (cx, cy, r, c1, c2) => `<circle cx="${cx}" cy="${cy}" r="${r * 3}" fill="url(#sunGlow)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}"/>`;

/* ---------- Escenas ---------- */
const WP_SCENES = [
  /* ===== FLORES ===== */
  { id: "tulipanes", name: "Campo de tulipanes", cat: "flores", svg() {
    const r = wpRng(11), cols = ["#e8457b", "#f5a3c0", "#ffd24a", "#9b5cf6", "#ff6a4d", "#fff4e8"];
    let rows = "";
    for (let row = 0; row < 11; row++) {
      const t = row / 10, y = 560 + t * t * 400, sc = .35 + t * 1.5, n = 14 + row * 3;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * 1700 - 50 + (r() - .5) * 60;
        rows += `<use href="#tul" x="${x.toFixed(0)}" y="${y.toFixed(0)}" transform="translate(${(x * (1 - sc)).toFixed(0)} ${(y * (1 - sc)).toFixed(0)}) scale(${sc.toFixed(2)})" style="color:${cols[Math.floor(r() * cols.length)]}"/>`;
      }
    }
    return wpSVG(wpLG("sk", [[0, "#9fd4f5"], [.6, "#f6e3f0"], [1, "#ffe8d2"]]) + wpLG("gr", [[0, "#7fc46a"], [1, "#2f8a4a"]]) +
      `<g id="tul"><path d="M0 0V-64" stroke="#3c8f4d" stroke-width="4" fill="none"/><path d="M0 -4Q-26 -26 -20 -58Q-6 -34 0 -4Z" fill="#4fa95c"/><path d="M-14 -66Q-17 -100 0 -108Q17 -100 14 -66Q0 -58 -14 -66Z" fill="currentColor"/><path d="M-4 -66Q-12 -92 0 -108Q6 -90 4 -66Z" fill="#fff" opacity=".22"/></g>`,
      wpSky("sk") + wpRidge(520, 40, 3, "#a9d6a0", { op: .7 }) + wpRidge(560, 26, 5, "#6fb86a") + `<rect y="560" width="${WP_W}" height="340" fill="url(#gr)"/>` + rows);
  } },
  { id: "cerezos", name: "Cerezos en flor", cat: "flores", svg() {
    const r = wpRng(21); let blossoms = "", petals = "";
    const branch = [[-40, 120, 520, 260], [300, 200, 760, 120], [520, 250, 980, 380], [200, 150, 420, 40], [700, 140, 1200, 220]];
    let paths = "";
    branch.forEach(([x1, y1, x2, y2], i) => {
      paths += `<path d="M${x1} ${y1}Q${(x1 + x2) / 2} ${y1 - 60 + i * 12} ${x2} ${y2}" stroke="#4a3140" stroke-width="${14 - i * 2}" fill="none" stroke-linecap="round"/>`;
      for (let k = 0; k < 90; k++) {
        const t = r(), x = x1 + (x2 - x1) * t + (r() - .5) * 150, y = y1 + (y2 - y1) * t + (r() - .5) * 120 - Math.sin(t * 3) * 30;
        blossoms += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(7 + r() * 13).toFixed(0)}" fill="${["#ffc2d6", "#ffb0cb", "#ffe1ec", "#ff9ec0"][Math.floor(r() * 4)]}" opacity="${(.65 + r() * .3).toFixed(2)}"/>`;
      }
    });
    for (let i = 0; i < 70; i++) petals += `<ellipse cx="${(r() * WP_W).toFixed(0)}" cy="${(r() * WP_H).toFixed(0)}" rx="${(5 + r() * 5).toFixed(0)}" ry="3.5" fill="#ffc6da" opacity="${(.4 + r() * .5).toFixed(2)}" transform="rotate(${(r() * 180).toFixed(0)} ${(r() * WP_W).toFixed(0)} 0)"/>`;
    return wpSVG(wpLG("sk", [[0, "#f6b8cf"], [.55, "#fde3ea"], [1, "#fff3e6"]]) + wpBlur("b", 3),
      wpSky("sk") + wpRidge(640, 60, 8, "#e9b8d4", { op: .6 }) + wpRidge(720, 40, 9, "#d99fc2", { op: .7 }) + wpRidge(800, 30, 10, "#b97fa8") + paths + `<g filter="url(#b)">${blossoms}</g>` + blossoms + petals);
  } },
  { id: "girasoles", name: "Girasoles", cat: "flores", svg() {
    const r = wpRng(31); let s = "";
    for (let row = 0; row < 7; row++) {
      const t = row / 6, y = 600 + t * 330, sc = .4 + t * 1.3, n = 8 + row * 2;
      for (let i = 0; i < n; i++) {
        const x = i / n * 1750 - 70 + (r() - .5) * 90, tilt = (r() - .5) * 14;
        s += `<use href="#sf" transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${tilt.toFixed(0)}) scale(${sc.toFixed(2)})"/>`;
      }
    }
    let petals = ""; for (let i = 0; i < 16; i++) petals += `<ellipse cx="0" cy="-42" rx="11" ry="30" fill="${i % 2 ? "#ffb81f" : "#ffc933"}" transform="rotate(${i * 22.5})"/>`;
    return wpSVG(wpLG("sk", [[0, "#5ab4f0"], [.65, "#bfe3f8"], [1, "#fff1cc"]]) + wpLG("gr", [[0, "#8cc152"], [1, "#4f8a2b"]]) + wpRG("sunGlow", [[0, "#fff6c0", .9], [1, "#fff6c0", 0]]) +
      `<g id="sf"><path d="M0 0V220" stroke="#3f7d2a" stroke-width="9"/><path d="M0 120Q-60 90 -64 130Q-30 150 0 120Z" fill="#4f9a34"/><g transform="translate(0 0)">${petals}<circle r="30" fill="#5a3a1e"/><circle r="22" fill="#74481f"/><circle r="9" fill="#3b2412"/></g></g>`,
      wpSky("sk") + wpSun(1250, 170, 60, "#fff7c9") + wpRidge(580, 30, 4, "#9fd07e", { op: .8 }) + `<rect y="610" width="${WP_W}" height="300" fill="url(#gr)"/>` + s);
  } },
  { id: "lavanda", name: "Campos de lavanda", cat: "flores", svg() {
    const r = wpRng(41); let s = "";
    for (let row = 0; row < 14; row++) {
      const t = row / 13, y = 470 + t * t * 460, sw = 2 + t * 6, len = 12 + t * 60, n = 120 + row * 30;
      const col = ["#7a52c7", "#9a6fe0", "#6a3fb5", "#b58cf0"];
      for (let i = 0; i < n; i++) { const x = r() * WP_W; s += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}l${(r() * 6 - 3).toFixed(1)} -${(len * (.6 + r() * .7)).toFixed(0)}" stroke="${col[Math.floor(r() * 4)]}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`; }
    }
    return wpSVG(wpLG("sk", [[0, "#3f3a8c"], [.45, "#e9779c"], [.75, "#ffc183"], [1, "#ffe6b4"]]) + wpRG("sunGlow", [[0, "#ffd9a0", .8], [1, "#ffd9a0", 0]]) + wpLG("fl", [[0, "#5d3fa3"], [1, "#2f1d63"]]),
      wpSky("sk") + wpSun(800, 470, 70, "#fff0c8") + wpRidge(470, 28, 6, "#6f4fa8", { op: .8 }) + `<rect y="470" width="${WP_W}" height="440" fill="url(#fl)"/>` + s);
  } },

  /* ===== ANIMALES ===== */
  { id: "aves", name: "Aves al atardecer", cat: "animales", svg() {
    const r = wpRng(51); let birds = "";
    for (let g = 0; g < 4; g++) {
      const cx = 250 + g * 330 + r() * 120, cy = 180 + r() * 220, sc = .5 + r() * .9;
      for (let i = 0; i < 14; i++) { const a = i - 7; birds += `<use href="#bd" transform="translate(${(cx + a * 46 * sc + (r() - .5) * 20).toFixed(0)} ${(cy + Math.abs(a) * 22 * sc + (r() - .5) * 14).toFixed(0)}) scale(${(sc * (.8 + r() * .4)).toFixed(2)})"/>`; }
    }
    return wpSVG(wpLG("sk", [[0, "#2b2f77"], [.4, "#c1568c"], [.7, "#ff9a6a"], [1, "#ffd9a0"]]) + wpRG("sunGlow", [[0, "#ffe2a8", .9], [1, "#ffe2a8", 0]]) +
      `<path id="bd" d="M-20 0Q-10 -12 0 0Q10 -12 20 0Q10 -5 0 5Q-10 -5 -20 0Z" fill="#1c1840"/>`,
      wpSky("sk") + wpSun(1000, 600, 90, "#ffeab8") + birds + wpRidge(700, 50, 12, "#4a2a5c", { op: .75 }) + wpRidge(780, 36, 13, "#2d1a45") + wpRidge(850, 24, 14, "#1a1030"));
  } },
  { id: "mariposas", name: "Mariposas", cat: "animales", svg() {
    const r = wpRng(61), cols = ["#ff8a5c", "#ffd24a", "#6ec6ff", "#c58bff", "#ff6fa5"]; let bf = "", bokeh = "";
    for (let i = 0; i < 16; i++) bf += `<use href="#bf" transform="translate(${(r() * 1500 + 50).toFixed(0)} ${(r() * 600 + 80).toFixed(0)}) rotate(${(r() * 70 - 35).toFixed(0)}) scale(${(.6 + r() * 1.2).toFixed(2)})" style="color:${cols[Math.floor(r() * 5)]}"/>`;
    for (let i = 0; i < 40; i++) bokeh += `<circle cx="${(r() * WP_W).toFixed(0)}" cy="${(r() * WP_H).toFixed(0)}" r="${(10 + r() * 36).toFixed(0)}" fill="#fff" opacity="${(r() * .12 + .04).toFixed(2)}"/>`;
    return wpSVG(wpLG("sk", [[0, "#1d6b6f"], [.6, "#6fcf97"], [1, "#e6f7a8"]]) + wpLG("gr", [[0, "#3f9d52"], [1, "#1f5e3a"]]) +
      `<g id="bf"><path d="M0 0C-28 -44 -64 -24 -46 8C-32 22 -8 16 0 0Z" fill="currentColor"/><path d="M0 0C28 -44 64 -24 46 8C32 22 8 16 0 0Z" fill="currentColor"/><path d="M0 2C-24 12 -34 40 -16 38C-6 34 -2 18 0 2Z" fill="currentColor" opacity=".8"/><path d="M0 2C24 12 34 40 16 38C6 34 2 18 0 2Z" fill="currentColor" opacity=".8"/><circle cx="-24" cy="-12" r="6" fill="#fff" opacity=".4"/><circle cx="24" cy="-12" r="6" fill="#fff" opacity=".4"/><rect x="-2" y="-10" width="4" height="34" rx="2" fill="#2a1f2e"/></g>`,
      wpSky("sk") + bokeh + wpRidge(640, 40, 15, "#3f9d52", { op: .6 }) + `<rect y="700" width="${WP_W}" height="200" fill="url(#gr)"/>` + wpRidge(730, 20, 16, "#2a7a46") + bf);
  } },
  { id: "peces", name: "Arrecife", cat: "animales", svg() {
    const r = wpRng(71), cols = ["#ff9248", "#ffd24a", "#4fd1c5", "#ff6f91", "#7dd3fc"]; let fish = "", bub = "", weed = "", rays = "";
    for (let g = 0; g < 5; g++) { const cx = r() * 1300 + 100, cy = r() * 520 + 130, c = cols[g % 5]; for (let i = 0; i < 9; i++) fish += `<use href="#fs" transform="translate(${(cx + r() * 200 - 100).toFixed(0)} ${(cy + r() * 120 - 60).toFixed(0)}) scale(${(r() > .5 ? 1 : -1) * (.5 + r() * .5)} ${(.5 + r() * .5).toFixed(2)})" style="color:${c}"/>`; }
    for (let i = 0; i < 40; i++) bub += `<circle cx="${(r() * WP_W).toFixed(0)}" cy="${(r() * WP_H).toFixed(0)}" r="${(2 + r() * 8).toFixed(0)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`;
    for (let i = 0; i < 30; i++) { const x = r() * WP_W, h = 90 + r() * 200; weed += `<path d="M${x.toFixed(0)} ${WP_H}Q${(x + 30).toFixed(0)} ${(WP_H - h / 2).toFixed(0)} ${(x - 10).toFixed(0)} ${(WP_H - h).toFixed(0)}" stroke="${["#1f8f6a", "#2bb08a", "#157a5c"][i % 3]}" stroke-width="${(8 + r() * 8).toFixed(0)}" fill="none" stroke-linecap="round"/>`; }
    for (let i = 0; i < 6; i++) rays += `<polygon points="${300 + i * 260},0 ${340 + i * 260},0 ${200 + i * 260},${WP_H} ${60 + i * 260},${WP_H}" fill="#fff" opacity=".05"/>`;
    return wpSVG(wpLG("sk", [[0, "#2ec4d6"], [.5, "#0f7da8"], [1, "#0a3a68"]]) +
      `<g id="fs"><path d="M0 0Q32 -18 66 0Q32 18 0 0Z" fill="currentColor"/><path d="M60 0L90 -16L90 16Z" fill="currentColor"/><path d="M30 -12Q40 -26 50 -12Z" fill="currentColor" opacity=".7"/><circle cx="13" cy="-3" r="3" fill="#0a1a30"/></g>`,
      wpSky("sk") + rays + wpRidge(830, 40, 17, "#12546e", { op: .8 }) + weed + fish + bub + wpRidge(880, 16, 18, "#d9b36b"));
  } },
  { id: "medusas", name: "Medusas", cat: "animales", svg() {
    const r = wpRng(81), cols = ["#7be0ff", "#c58bff", "#ff8ad6", "#8affc7"]; let j = "";
    for (let i = 0; i < 9; i++) {
      const x = r() * 1400 + 100, y = r() * 450 + 100, sc = .5 + r() * 1.2, c = cols[i % 4]; let t = "";
      for (let k = -3; k <= 3; k++) t += `<path d="M${k * 11} 4q${(r() * 30 - 15).toFixed(0)} 40 ${(r() * 20 - 10).toFixed(0)} 80t${(r() * 24 - 12).toFixed(0)} 90t${(r() * 24 - 12).toFixed(0)} 80" stroke="${c}" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`;
      j += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${sc.toFixed(2)})" style="color:${c}"><g filter="url(#gl)" opacity=".8"><path d="M-48 4Q-48 -70 0 -70Q48 -70 48 4Q24 14 0 4Q-24 14 -48 4Z" fill="currentColor"/></g><path d="M-48 4Q-48 -70 0 -70Q48 -70 48 4Q24 14 0 4Q-24 14 -48 4Z" fill="currentColor" opacity=".55"/><ellipse cx="-12" cy="-40" rx="14" ry="8" fill="#fff" opacity=".35"/>${t}</g>`;
    }
    return wpSVG(wpLG("sk", [[0, "#050c2e"], [.6, "#0a1f5c"], [1, "#0d3a6e"]]) + wpBlur("gl", 14), wpSky("sk") + wpStars(60, 5, 900) + j);
  } },
  { id: "buho", name: "Búho a la luz de la luna", cat: "animales", svg() {
    return wpSVG(wpLG("sk", [[0, "#0b1033"], [.7, "#2a2a6a"], [1, "#4a3f8c"]]) + wpRG("moonGlow", [[0, "#fff6d6", .55], [1, "#fff6d6", 0]]),
      wpSky("sk") + wpStars(120, 7, 800) + `<circle cx="1180" cy="260" r="360" fill="url(#moonGlow)"/><circle cx="1180" cy="260" r="130" fill="#fff4cf"/><circle cx="1140" cy="230" r="22" fill="#f0e2b0" opacity=".6"/><circle cx="1210" cy="300" r="30" fill="#f0e2b0" opacity=".5"/>` +
      `<path d="M-40 640Q300 600 640 660T1000 620" stroke="#1c1536" stroke-width="30" fill="none" stroke-linecap="round"/><path d="M420 640Q480 560 560 540" stroke="#1c1536" stroke-width="12" fill="none" stroke-linecap="round"/>` +
      `<g transform="translate(560 620)"><ellipse cx="0" cy="-80" rx="70" ry="95" fill="#3a3358"/><ellipse cx="0" cy="-60" rx="42" ry="62" fill="#5a5080"/><path d="M-62 -150L-40 -190L-20 -156ZM62 -150L40 -190L20 -156Z" fill="#3a3358"/><ellipse cx="0" cy="-130" rx="62" ry="50" fill="#3a3358"/><circle cx="-24" cy="-132" r="22" fill="#ffd24a"/><circle cx="24" cy="-132" r="22" fill="#ffd24a"/><circle cx="-24" cy="-132" r="10" fill="#1a1436"/><circle cx="24" cy="-132" r="10" fill="#1a1436"/><path d="M-7 -116L0 -100L7 -116Z" fill="#f0902a"/><path d="M-70 -100Q-96 -60 -60 -20L-50 -60Z M70 -100Q96 -60 60 -20L50 -60Z" fill="#2b2548"/></g>` +
      wpRidge(780, 40, 19, "#150f2e") + wpPines(800, 30, 20, 150, "#0d0a20"));
  } },

  /* ===== CAMPOS ===== */
  { id: "trigo", name: "Trigales dorados", cat: "campos", svg() {
    const r = wpRng(91); let s = "";
    for (let row = 0; row < 12; row++) {
      const t = row / 11, y = 520 + t * t * 420, len = 14 + t * 80, sw = 1.5 + t * 4, n = 130 + row * 26;
      for (let i = 0; i < n; i++) { const x = r() * WP_W, c = ["#e8b84a", "#f4cf6a", "#d9a032", "#fbe08a"][Math.floor(r() * 4)]; s += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}q${(r() * 12 - 6).toFixed(1)} -${(len * .6).toFixed(0)} ${(r() * 20 - 10).toFixed(1)} -${(len * (.8 + r() * .5)).toFixed(0)}" stroke="${c}" stroke-width="${sw.toFixed(1)}" fill="none" stroke-linecap="round"/>`; }
    }
    return wpSVG(wpLG("sk", [[0, "#5aa9e6"], [.7, "#bfe0f5"], [1, "#fff0cc"]]) + wpRG("sunGlow", [[0, "#fff3b0", .8], [1, "#fff3b0", 0]]) + wpLG("fl", [[0, "#d9a032"], [1, "#a8741c"]]),
      wpSky("sk") + wpSun(300, 220, 56, "#fff7cf") + `<ellipse cx="900" cy="170" rx="200" ry="34" fill="#fff" opacity=".7"/><ellipse cx="1180" cy="230" rx="150" ry="26" fill="#fff" opacity=".6"/>` + wpRidge(520, 34, 21, "#8fb86a", { op: .85 }) + `<rect y="520" width="${WP_W}" height="400" fill="url(#fl)"/>` + s);
  } },
  { id: "colinas", name: "Colinas verdes", cat: "campos", svg() {
    return wpSVG(wpLG("sk", [[0, "#6cc1f2"], [1, "#e4f6ff"]]),
      wpSky("sk") + `<ellipse cx="400" cy="200" rx="230" ry="44" fill="#fff" opacity=".9"/><ellipse cx="560" cy="226" rx="170" ry="34" fill="#fff" opacity=".9"/><ellipse cx="1150" cy="140" rx="200" ry="36" fill="#fff" opacity=".85"/>` +
      wpRidge(520, 70, 22, "#9ad47c", { f: 1.6 }) + wpRidge(600, 80, 23, "#6fbd5d", { f: 1.8 }) + wpRidge(700, 70, 24, "#4fa84b", { f: 2.2 }) + wpRidge(800, 60, 25, "#388f3e", { f: 2.6 }));
  } },
  { id: "amapolas", name: "Campo de amapolas", cat: "campos", svg() {
    const r = wpRng(101); let s = "";
    for (let i = 0; i < 520; i++) { const t = Math.pow(r(), .6), y = 560 + t * 340, sc = .3 + t * 1.4, x = r() * WP_W; s += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${sc.toFixed(2)})"><path d="M0 0V26" stroke="#2f7a3a" stroke-width="3"/><circle r="12" fill="${r() > .15 ? "#e63946" : "#ff6b6b"}"/><circle r="4" fill="#2a1418"/></g>`; }
    return wpSVG(wpLG("sk", [[0, "#8ec5f0"], [1, "#fff1e2"]]) + wpLG("gr", [[0, "#6fb752"], [1, "#2d7a3a"]]),
      wpSky("sk") + `<ellipse cx="1000" cy="170" rx="210" ry="38" fill="#fff" opacity=".85"/>` + wpRidge(540, 50, 26, "#8ccf78", { f: 1.8 }) + `<rect y="570" width="${WP_W}" height="340" fill="url(#gr)"/>` + s);
  } },

  /* ===== CIUDADES ===== */
  { id: "skyline", name: "Ciudad al atardecer", cat: "ciudades", svg() {
    return wpSVG(wpLG("sk", [[0, "#3a3a8c"], [.4, "#d4527f"], [.75, "#ff9b62"], [1, "#ffd896"]]) + wpRG("sunGlow", [[0, "#ffe3a8", .9], [1, "#ffe3a8", 0]]),
      wpSky("sk") + wpSun(1040, 560, 80, "#fff0c4") + wpBuildings(780, 0, 31, 40, 90, 120, 330, "#7a4a86") + wpBuildings(820, 0, 32, 50, 110, 160, 420, "#4a2c66") + wpBuildings(880, 0, 33, 60, 130, 120, 300, "#271640") + `<rect y="880" width="${WP_W}" height="30" fill="#271640"/>`);
  } },
  { id: "nocturna", name: "Ciudad de noche", cat: "ciudades", svg() {
    return wpSVG(wpLG("sk", [[0, "#050818"], [.7, "#142a5c"], [1, "#2c4b8a"]]) + wpRG("moonGlow", [[0, "#dfe9ff", .4], [1, "#dfe9ff", 0]]),
      wpSky("sk") + wpStars(90, 9, 520) + `<circle cx="300" cy="170" r="200" fill="url(#moonGlow)"/><circle cx="300" cy="170" r="52" fill="#eef3ff"/>` + wpBuildings(800, 0, 41, 50, 100, 140, 380, "#16224a", { windows: "#ffd978" }) + wpBuildings(860, 0, 42, 60, 130, 120, 300, "#0c1432", { windows: "#ffe9a8" }) + `<rect y="860" width="${WP_W}" height="50" fill="#070c20"/>`);
  } },
  { id: "neon", name: "Ciudad neón", cat: "ciudades", svg() {
    let grid = ""; for (let i = -12; i <= 12; i++) grid += `<line x1="800" y1="620" x2="${800 + i * 220}" y2="${WP_H}" stroke="#ff4fd8" stroke-opacity=".55" stroke-width="2"/>`;
    for (let i = 1; i <= 8; i++) { const y = 620 + Math.pow(i / 8, 2.2) * 280; grid += `<line x1="0" y1="${y.toFixed(0)}" x2="${WP_W}" y2="${y.toFixed(0)}" stroke="#ff4fd8" stroke-opacity=".5" stroke-width="2"/>`; }
    let stripes = ""; for (let i = 0; i < 6; i++) stripes += `<rect x="560" y="${400 + i * 36}" width="480" height="${3 + i * 3}" fill="#2a0d52"/>`;
    return wpSVG(wpLG("sk", [[0, "#12063a"], [.55, "#5b1a8c"], [1, "#ff4f9a"]]) + wpLG("sun", [[0, "#ffe66d"], [1, "#ff3d9a"]]) + wpLG("fl", [[0, "#2a0d52"], [1, "#12063a"]]) + wpBlur("gl", 6),
      wpSky("sk") + wpStars(60, 4, 380, "#ffd6f7") + `<circle cx="800" cy="520" r="210" fill="url(#sun)"/>${stripes}` + wpBuildings(620, 0, 51, 40, 90, 80, 300, "#1a0840", { edge: "#35e6ff" }) + `<rect y="620" width="${WP_W}" height="${WP_H - 620}" fill="url(#fl)"/><g filter="url(#gl)">${grid}</g>${grid}`);
  } },

  /* ===== NATURALEZA ===== */
  { id: "montanas", name: "Montañas entre niebla", cat: "naturaleza", svg() {
    return wpSVG(wpLG("sk", [[0, "#7aa6d6"], [.6, "#e8d6dc"], [1, "#ffe9d2"]]) + wpLG("mist", [[0, "#fff", 0], [.5, "#fff", .55], [1, "#fff", 0]]) + wpBlur("b", 14),
      wpSky("sk") + wpRidge(430, 150, 61, "#7f93bd", { f: 1.4, rough: .7 }) + `<rect y="420" width="${WP_W}" height="100" fill="url(#mist)"/>` + wpRidge(540, 130, 62, "#5d739f", { f: 1.7, rough: .7 }) + `<rect y="520" width="${WP_W}" height="110" fill="url(#mist)"/>` + wpRidge(660, 110, 63, "#3f5580", { f: 2, rough: .6 }) + `<rect y="640" width="${WP_W}" height="120" fill="url(#mist)"/>` + wpRidge(780, 80, 64, "#26385e", { f: 2.4 }));
  } },
  { id: "bosque", name: "Bosque de pinos", cat: "naturaleza", svg() {
    return wpSVG(wpLG("sk", [[0, "#a8d8c8"], [.7, "#e9f3d9"], [1, "#fff6d6"]]) + wpLG("mist", [[0, "#fff", 0], [.6, "#fff", .5], [1, "#fff", 0]]) + wpRG("sunGlow", [[0, "#fff8c8", .7], [1, "#fff8c8", 0]]),
      wpSky("sk") + wpSun(1150, 260, 50, "#fffbe0") + wpPines(560, 40, 71, 260, "#9bc7a6", .8) + `<rect y="500" width="${WP_W}" height="130" fill="url(#mist)"/>` + wpPines(680, 34, 72, 320, "#5f9a7a") + `<rect y="620" width="${WP_W}" height="120" fill="url(#mist)"/>` + wpPines(800, 26, 73, 400, "#2f6b52") + wpPines(910, 20, 74, 480, "#174536"));
  } },
  { id: "playa", name: "Playa al atardecer", cat: "naturaleza", svg() {
    let refl = ""; const r = wpRng(5); for (let i = 0; i < 12; i++) refl += `<rect x="${(1000 - 30 - i * 14 + r() * 20).toFixed(0)}" y="${520 + i * 24}" width="${40 + i * 28}" height="6" rx="3" fill="#ffe3a0" opacity="${(.8 - i * .05).toFixed(2)}"/>`;
    return wpSVG(wpLG("sk", [[0, "#2f3d8f"], [.4, "#b8508f"], [.75, "#ff9a62"], [1, "#ffd896"]]) + wpLG("sea", [[0, "#ff9a7a"], [.3, "#6a5fa8"], [1, "#1f2f6a"]]) + wpLG("sand", [[0, "#f3d4a0"], [1, "#d9aa6c"]]) + wpRG("sunGlow", [[0, "#ffe9b0", .9], [1, "#ffe9b0", 0]]),
      wpSky("sk") + wpSun(1000, 500, 74, "#fff2cc") + `<rect y="520" width="${WP_W}" height="380" fill="url(#sea)"/>${refl}` + `<path d="M0 760Q400 700 800 740T1600 720V900H0Z" fill="url(#sand)"/><path d="M0 760Q400 700 800 740T1600 720" stroke="#fff" stroke-width="5" fill="none" opacity=".8"/><path d="M0 690Q300 660 640 684T1300 676T1600 684" stroke="#fff" stroke-width="3" fill="none" opacity=".4"/>`);
  } },
  { id: "desierto", name: "Dunas del desierto", cat: "naturaleza", svg() {
    return wpSVG(wpLG("sk", [[0, "#f0845c"], [.5, "#ffc388"], [1, "#fff0c8"]]) + wpRG("sunGlow", [[0, "#fff5d0", .9], [1, "#fff5d0", 0]]),
      wpSky("sk") + wpSun(1150, 330, 64, "#fffbe6") + wpRidge(560, 60, 81, "#e9a56a", { f: 1.2, rough: .15 }) + wpRidge(640, 80, 82, "#d4864f", { f: 1.5, rough: .15 }) + wpRidge(730, 90, 83, "#b8683a", { f: 1.3, rough: .1 }) + wpRidge(830, 70, 84, "#8f4a2a", { f: 1.8, rough: .1 }));
  } },
  { id: "aurora", name: "Aurora boreal", cat: "naturaleza", svg() {
    const rb = (y, h, c1, c2, seed) => { const r = wpRng(seed); let d = `M0 ${y}`; for (let x = 0; x <= WP_W; x += 100) d += `Q${x + 50} ${(y + (r() - .5) * 180).toFixed(0)} ${x + 100} ${(y + (r() - .5) * 120).toFixed(0)}`; d += `L${WP_W} ${y + h}`; for (let x = WP_W; x >= 0; x -= 100) d += `Q${x - 50} ${(y + h + (r() - .5) * 120).toFixed(0)} ${x - 100} ${(y + h + (r() - .5) * 100).toFixed(0)}`; return `<path d="${d}Z" fill="url(#${c1})" opacity=".6"/>`; };
    return wpSVG(wpLG("sk", [[0, "#030816"], [.7, "#0a1c3c"], [1, "#12335a"]]) + wpLG("a1", [[0, "#3dffb0", 0], [.5, "#3dffb0", .9], [1, "#35b6ff", 0]], "0,0,0,1") + wpLG("a2", [[0, "#b06bff", 0], [.5, "#7a7bff", .8], [1, "#3dd6ff", 0]]) + wpBlur("b", 18),
      wpSky("sk") + wpStars(160, 6, 760) + `<g filter="url(#b)">${rb(130, 300, "a1", "", 91)}${rb(260, 260, "a2", "", 92)}</g>` + wpRidge(780, 60, 93, "#0b1830") + wpPines(830, 30, 94, 180, "#050c1c") + wpRidge(880, 22, 95, "#e9f3ff", { op: .08 }));
  } },
  { id: "espacio", name: "Nebulosa", cat: "naturaleza", svg() {
    return wpSVG(wpLG("sk", [[0, "#04030f"], [1, "#0d0a2a"]]) + wpRG("n1", [[0, "#8a3dff", .75], [1, "#8a3dff", 0]]) + wpRG("n2", [[0, "#ff4fa8", .6], [1, "#ff4fa8", 0]]) + wpRG("n3", [[0, "#3da8ff", .6], [1, "#3da8ff", 0]]) + wpRG("pl", [[0, "#ffd6a0"], [.7, "#e07a5f"], [1, "#6a2c4a"]]) + wpBlur("b", 30),
      wpSky("sk") + `<g filter="url(#b)"><ellipse cx="500" cy="380" rx="520" ry="260" fill="url(#n1)"/><ellipse cx="1100" cy="300" rx="480" ry="240" fill="url(#n2)"/><ellipse cx="900" cy="640" rx="560" ry="230" fill="url(#n3)"/></g>` + wpStars(260, 10, 900) + `<circle cx="1260" cy="620" r="120" fill="url(#pl)"/><ellipse cx="1260" cy="620" rx="210" ry="38" fill="none" stroke="#f2c9a0" stroke-width="10" opacity=".7" transform="rotate(-18 1260 620)"/>`);
  } },

  /* ===== ABSTRACTOS ===== */
  { id: "ondas", name: "Ondas", cat: "abstractos", svg() {
    let w = ""; const cols = [["#6b74f5", "#9b5cf6"], ["#9b5cf6", "#f0566b"], ["#f0566b", "#ff9a62"], ["#14a38b", "#2d8cf0"]];
    for (let i = 0; i < 6; i++) { const y = 330 + i * 90; let d = `M0 ${y}`; for (let x = 0; x <= WP_W; x += 40) d += `L${x} ${(y + Math.sin(x / 190 + i * 1.1) * 60 + Math.sin(x / 80 + i) * 14).toFixed(1)}`; w += `<path d="${d}L${WP_W} ${WP_H}L0 ${WP_H}Z" fill="url(#w${i % 4})" opacity=".78"/>`; }
    return wpSVG(wpLG("sk", [[0, "#1a1d4a"], [1, "#3a2a7a"]]) + cols.map(([a, b], i) => wpLG("w" + i, [[0, a], [1, b]], "0,0,1,1")).join(""), wpSky("sk") + w);
  } },
  { id: "malla", name: "Malla de color", cat: "abstractos", svg() {
    return wpSVG(wpLG("sk", [[0, "#2a2f7a"], [1, "#6b3aa8"]]) + wpBlur("b", 90),
      wpSky("sk") + `<g filter="url(#b)"><circle cx="260" cy="200" r="340" fill="#ff6a8a"/><circle cx="1280" cy="160" r="320" fill="#4fc3ff"/><circle cx="820" cy="560" r="360" fill="#9b6bff"/><circle cx="1400" cy="760" r="300" fill="#ffb86a"/><circle cx="160" cy="760" r="280" fill="#3ddbb0"/></g>`);
  } },
];

const WP_CATS = [["todos", "Todos"], ["flores", "Flores"], ["animales", "Animales"], ["campos", "Campos"], ["ciudades", "Ciudades"], ["naturaleza", "Naturaleza"], ["abstractos", "Abstractos"], ["mios", "Mis fondos"]];

/* ---------- Estado ---------- */
const wpCache = new Map();
const wpSvgOf = (sc) => { if (!wpCache.has(sc.id)) wpCache.set(sc.id, sc.svg()); return wpCache.get(sc.id); };
const wpUri = (sc) => `data:image/svg+xml;utf8,${encodeURIComponent(wpSvgOf(sc))}`;
function wallCfg() {
  const w = (state.settings.wall ||= {});
  w.id ??= ""; w.dim ??= 38; w.blur ??= 0; w.auto ??= false;
  return w;
}

/* ---------- Fondos personales (IndexedDB) ---------- */
const WP_DB = { db: null };
function wpOpenDB() {
  if (WP_DB.db) return Promise.resolve(WP_DB.db);
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("Este navegador no permite guardar fotos."));
    const q = indexedDB.open("taskflow-walls", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("walls", { keyPath: "id" });
    q.onsuccess = () => { WP_DB.db = q.result; res(q.result); };
    q.onerror = () => rej(q.error || new Error("No se pudo abrir el almacenamiento."));
  });
}
const wpTx = async (mode, fn) => { const db = await wpOpenDB(); return new Promise((res, rej) => { const t = db.transaction("walls", mode), s = t.objectStore("walls"); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
const wpAllCustom = () => wpTx("readonly", (s) => s.getAll()).then((a) => (a || []).sort((x, y) => y.at - x.at)).catch(() => []);
const wpGetCustom = (id) => wpTx("readonly", (s) => s.get(id)).catch(() => null);
const wpPutCustom = (o) => wpTx("readwrite", (s) => s.put(o));
const wpDelCustom = (id) => wpTx("readwrite", (s) => s.delete(id));

async function wpDownscale(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la imagen."))), "image/jpeg", .86));
}

/* ---------- Aplicar el fondo ---------- */
const wpLayer = (() => { const d = document.createElement("div"); d.className = "wall"; d.id = "wall"; d.setAttribute("aria-hidden", "true"); ($(".bg") || document.body).prepend(d); return d; })();
let wpObjUrl = null, wpFirst = true;
function wpEffectiveId() {
  const w = wallCfg();
  if (w.auto) { const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000); return WP_SCENES[day % WP_SCENES.length].id; }
  return w.id;
}
async function applyWall() {
  const w = wallCfg(), root = document.documentElement;
  root.style.setProperty("--wall-dim", (w.dim / 100).toFixed(2));
  root.style.setProperty("--wall-blur", w.blur + "px");
  const id = wpEffectiveId();
  let url = "";
  if (id.startsWith("custom:")) {
    const rec = await wpGetCustom(id.slice(7));
    if (rec) { if (wpObjUrl) URL.revokeObjectURL(wpObjUrl); wpObjUrl = URL.createObjectURL(rec.blob); url = wpObjUrl; }
  } else {
    const sc = WP_SCENES.find((x) => x.id === id);
    if (sc) url = wpUri(sc);
  }
  const set = () => { wpLayer.style.backgroundImage = url ? `url("${url}")` : ""; root.dataset.wall = url ? "on" : ""; };
  if (wpFirst || !url) { set(); wpFirst = false; return; }
  wpLayer.style.opacity = 0; setTimeout(() => { set(); wpLayer.style.opacity = ""; }, 260);
}
const _applyTheme = applyTheme;
applyTheme = function () { _applyTheme(); applyWall(); }; // también tras sincronizar con la cuenta

/* ---------- Diálogo ---------- */
if (!ICONS.image) ICONS.image = '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5L8 19"/>';
const wpDlg = (() => {
  const d = document.createElement("dialog");
  d.className = "sheet sheet--wide glass"; d.id = "wall-dialog"; d.setAttribute("aria-labelledby", "wall-title");
  d.innerHTML = `<header class="sheet__head"><h2 id="wall-title">Fondos de pantalla</h2><button type="button" class="icon-btn icon-btn--sm" data-close aria-label="Cerrar">${icon("x")}</button></header>
    <div class="sheet__body wall-body">
      <div class="wall-cats" id="wall-cats" role="tablist"></div>
      <div id="wall-grid" class="wall-grid"></div>
      <section class="conn-card wall-ctl">
        <div class="wall-range"><label for="wall-dim">Atenuación</label><input type="range" id="wall-dim" min="0" max="75" step="1"><output id="wall-dim-o"></output></div>
        <div class="wall-range"><label for="wall-blur">Desenfoque</label><input type="range" id="wall-blur" min="0" max="20" step="1"><output id="wall-blur-o"></output></div>
        <div class="pop__row"><span>Cambiar de fondo cada día</span><button type="button" class="switch" id="wall-auto" role="switch" aria-label="Cambiar de fondo cada día"><i></i></button></div>
        <div class="conn-actions"><button type="button" class="btn btn--ghost btn--sm" id="wall-none">Sin fondo</button><button type="button" class="btn btn--soft btn--sm" id="wall-random">Sorpréndeme</button></div>
      </section>
    </div>
    <footer class="sheet__foot"><span class="spacer"></span><button type="button" class="btn btn--primary" data-close>Listo</button></footer>`;
  document.body.append(d);
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
  d.addEventListener("mousedown", (e) => { if (e.target === d) closeDialog(d); });
  d.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeDialog(d)));
  return d;
})();

let wpCat = "todos", wpCustom = [], wpThumbs = new Map();
function wpThumb(sc) { // se pinta una vez y se reutiliza
  if (!wpThumbs.has(sc.id)) wpThumbs.set(sc.id, wpUri(sc));
  return wpThumbs.get(sc.id);
}
async function renderWall() {
  const w = wallCfg();
  $("#wall-cats").innerHTML = WP_CATS.map(([k, n]) => `<button type="button" role="tab" data-wcat="${k}" aria-pressed="${wpCat === k}">${n}</button>`).join("");
  const cur = w.auto ? wpEffectiveId() : w.id;
  let html = "";
  if (wpCat === "mios") {
    wpCustom = await wpAllCustom();
    html += `<label class="wall-add" id="wall-drop"><input type="file" id="wall-file" accept="image/*" multiple hidden>${icon("plus")}<strong>Añadir tus fotos</strong><span>Pulsa o arrastra imágenes aquí.<br>Se guardan solo en este dispositivo.</span></label>`;
    html += wpCustom.map((c) => `<div class="wall-item${cur === "custom:" + c.id ? " is-on" : ""}" data-wid="custom:${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}"><img alt="" src="${URL.createObjectURL(c.blob)}"><span>${esc(c.name)}</span><button type="button" class="wall-del" data-wdel="${c.id}" aria-label="Eliminar ${esc(c.name)}">${icon("x")}</button></div>`).join("");
  } else {
    html = WP_SCENES.filter((s) => wpCat === "todos" || s.cat === wpCat).map((s) => `<div class="wall-item${cur === s.id ? " is-on" : ""}" data-wid="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}"><img alt="" loading="lazy" src="${wpThumb(s)}"><span>${esc(s.name)}</span></div>`).join("");
  }
  $("#wall-grid").innerHTML = html;
  $("#wall-dim").value = w.dim; $("#wall-dim-o").textContent = w.dim + "%";
  $("#wall-blur").value = w.blur; $("#wall-blur-o").textContent = w.blur + " px";
  $("#wall-auto").setAttribute("aria-checked", !!w.auto);
}
function openWall(cat) { if (cat) wpCat = cat; renderWall(); openDialog(wpDlg); }
function wpChoose(id) { const w = wallCfg(); w.id = id; w.auto = false; save(); applyWall(); renderWall(); }

async function wpAddFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith("image/"));
  if (!list.length) return showToast("Elige archivos de imagen (JPG, PNG, WebP…).");
  if ((await wpAllCustom()).length + list.length > 16) return showToast("Puedes guardar hasta 16 fondos propios. Elimina alguno primero.");
  let last = null;
  for (const f of list) {
    if (f.size > 25 * 1024 * 1024) { showToast(`«${f.name}» es demasiado grande (máx. 25 MB).`); continue; }
    try { const blob = await wpDownscale(f); last = { id: uid(), name: f.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Mi foto", blob, at: Date.now() }; await wpPutCustom(last); }
    catch (e) { showToast(`No se pudo añadir «${f.name}»: ${e.message}`); }
  }
  if (last) { wpChoose("custom:" + last.id); showToast("Fondo añadido"); } else renderWall();
}

wpDlg.addEventListener("click", async (e) => {
  const cat = e.target.closest("[data-wcat]");
  if (cat) { wpCat = cat.dataset.wcat; renderWall(); return; }
  const del = e.target.closest("[data-wdel]");
  if (del) {
    e.stopPropagation();
    const id = del.dataset.wdel; await wpDelCustom(id);
    if (wallCfg().id === "custom:" + id) { wallCfg().id = ""; save(); applyWall(); }
    renderWall(); return;
  }
  const it = e.target.closest("[data-wid]");
  if (it) { wpChoose(it.dataset.wid); return; }
  if (e.target.closest("#wall-none")) wpChoose("");
  else if (e.target.closest("#wall-random")) wpChoose(WP_SCENES[Math.floor(Math.random() * WP_SCENES.length)].id);
  else if (e.target.closest("#wall-auto")) { const w = wallCfg(); w.auto = !w.auto; save(); applyWall(); renderWall(); }
});
wpDlg.addEventListener("keydown", (e) => { const it = e.target.closest?.("[data-wid]"); if (it && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); wpChoose(it.dataset.wid); } });
wpDlg.addEventListener("input", (e) => {
  const w = wallCfg();
  if (e.target.id === "wall-dim") { w.dim = +e.target.value; $("#wall-dim-o").textContent = w.dim + "%"; }
  else if (e.target.id === "wall-blur") { w.blur = +e.target.value; $("#wall-blur-o").textContent = w.blur + " px"; }
  else return;
  document.documentElement.style.setProperty("--wall-dim", (w.dim / 100).toFixed(2));
  document.documentElement.style.setProperty("--wall-blur", w.blur + "px");
});
wpDlg.addEventListener("change", (e) => { if (e.target.id === "wall-dim" || e.target.id === "wall-blur") save(); if (e.target.id === "wall-file") { wpAddFiles(e.target.files); e.target.value = ""; } });
wpDlg.addEventListener("dragover", (e) => { if (e.target.closest("#wall-drop")) { e.preventDefault(); e.target.closest("#wall-drop").classList.add("is-over"); } });
wpDlg.addEventListener("dragleave", (e) => e.target.closest("#wall-drop")?.classList.remove("is-over"));
wpDlg.addEventListener("drop", (e) => { if (e.target.closest("#wall-drop")) { e.preventDefault(); wpAddFiles(e.dataTransfer.files); } });

/* ---------- Puntos de entrada ---------- */
const wpBtn = (() => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "icon-btn wall-btn"; b.id = "btn-wall"; b.title = "Fondos de pantalla"; b.setAttribute("aria-label", "Fondos de pantalla");
  b.innerHTML = icon("image");
  $("#btn-theme").before(b);
  b.addEventListener("click", () => openWall());
  return b;
})();
(() => {
  const stack = $("#pop-settings .pop__stack");
  if (!stack) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "btn btn--soft btn--sm"; b.innerHTML = `${icon("image")} Fondos de pantalla`;
  b.addEventListener("click", () => openWall());
  stack.prepend(b);
})();
if (typeof integrationCommands === "function") {
  const prev = integrationCommands;
  integrationCommands = function () { return [{ g: "Apariencia", l: "Fondos de pantalla…", ic: "image", run: () => openWall() }, { g: "Apariencia", l: "Fondo aleatorio", ic: "image", run: () => wpChoose(WP_SCENES[Math.floor(Math.random() * WP_SCENES.length)].id) }, ...prev()]; };
}

applyWall();
