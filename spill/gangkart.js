// Gangkart, trapper og veifinning for spillet: hver etasje rastreres til et rutenett av gangbare ruter,
// trappene er egne baner mellom etasjene, og A* finner veien (også via trappene).
import * as THREE from 'three';
import { F, TX1, nedreSving, øvreSving, opptrinn, inntrinn, scene, M, vis, oppdater } from '../hus.js';

// ---------- Gangkart ----------
// Hver etasje rastreres til et rutenett: en rute er gangbar når det finnes gulv under og ingen
// møbler eller vegger mellom kne- og hodehøyde. Dører og glass i dører regnes som åpne.
const R = 0.05, X0 = -1.0, Z0 = -5.0, NX = Math.round(7.4 / R), NZ = Math.round(20 / R), N = NX * NZ;
const ETASJER = 3, base = f => f * F;                                  // f = 0, 1, 2
const gulv = Array.from({ length: ETASJER }, () => new Float32Array(N).fill(NaN));
const sperret = Array.from({ length: ETASJER }, () => new Uint8Array(N));
const åpne = new Set([M.hvitDør, M.ytterdør, M.bodDør, M.glass]);
const celle = (x, z) => [Math.floor((x - X0) / R), Math.floor((z - Z0) / R)];
const id = (i, j) => j * NX + i;
const inni = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ;
function rastrer(boks, fn) {
  const [i1, j1] = celle(boks.min.x, boks.min.z), [i2, j2] = celle(boks.max.x - 1e-6, boks.max.z - 1e-6);
  for (let j = Math.max(0, j1); j <= Math.min(NZ - 1, j2); j++)
    for (let i = Math.max(0, i1); i <= Math.min(NX - 1, i2); i++) fn(id(i, j));
}
function byggKart(utenom = new Set()) {                          // utenom: figurens egne deler
  vis.etasje = 3; vis.lave = false; vis.tak = false; oppdater();
  scene.updateMatrixWorld(true);
  const b = new THREE.Box3(), str = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isMesh || åpne.has(o.material) || o.material === M.porteTak || utenom.has(o)) return;   // tak over inngangen er ikke gulv
    b.setFromObject(o); b.getSize(str);
    for (let f = 0; f < ETASJER; f++) {
      const y0 = base(f);
      // gulvflater: tynne og store nok, med topp nær etasjens gulvnivå
      if (str.y < 0.4 && str.x * str.z > 0.2 && b.max.y > y0 - 0.5 && b.max.y < y0 + 0.12)
        rastrer(b, k => { if (!(gulv[f][k] >= b.max.y)) gulv[f][k] = b.max.y; });
      // hindringer mellom kne- og hodehøyde
      else if (b.min.y < y0 + 1.7 && b.max.y > y0 + 0.25) rastrer(b, k => { sperret[f][k] = 1; });
    }
  });
  // gjør hindringene litt større så figuren ikke går gjennom kantene
  for (let f = 0; f < ETASJER; f++) {
    const s = sperret[f], ut = new Uint8Array(N), r = 3;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      if (!s[id(i, j)]) continue;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
        if (di * di + dj * dj <= r * r && inni(i + di, j + dj)) ut[id(i + di, j + dj)] = 1;
    }
    sperret[f] = ut;
  }
}
const gangbar = (f, i, j) => inni(i, j) && !sperret[f][id(i, j)] && !Number.isNaN(gulv[f][id(i, j)]);
const høydeVed = (f, x, z) => { const [i, j] = celle(x, z); return inni(i, j) ? gulv[f][id(i, j)] : NaN; };

// ---------- Trapper ----------
// Gangbanen i hver trapp: vindeltrinn inn fra vest, rett løp mot +z og vindeltrinn ut mot vest.
function trappeBane(f) {
  const y0 = base(f), p = [];
  p.push([3.70, y0, 3.75]);
  for (let i = 0; i < 3; i++) {
    const a = (-75 + 30 * i) * Math.PI / 180;
    p.push([TX1 + 0.5 * Math.cos(a), y0 + (i + 1) * opptrinn, nedreSving.z2 + 0.5 * Math.sin(a)]);
  }
  for (let j = 0; j < 8; j++) p.push([4.60, y0 + (4 + j) * opptrinn, nedreSving.z2 + (j + 0.5) * inntrinn]);
  for (let i = 0; i < 3; i++) {
    const a = (15 + 30 * i) * Math.PI / 180;
    p.push([TX1 + 0.5 * Math.cos(a), y0 + (12 + i) * opptrinn, øvreSving.z1 + 0.5 * Math.sin(a)]);
  }
  p.push([3.85, y0 + F, 6.85]);
  return p.map(([x, y, z]) => new THREE.Vector3(x, y, z));
}
const trapper = [0, 1].map(f => {
  const bane = trappeBane(f);
  let lengde = 0;
  for (let k = 1; k < bane.length; k++) lengde += bane[k].distanceTo(bane[k - 1]);
  return { f, bane, lengde, nede: celle(bane[0].x, bane[0].z), oppe: celle(bane.at(-1).x, bane.at(-1).z) };
});
// sørg for at endene av trappene alltid er gangbare
function åpneTrappeender() {
  for (const t of trapper) for (const [f, [i, j], p] of [[t.f, t.nede, t.bane[0]], [t.f + 1, t.oppe, t.bane.at(-1)]])
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const k = id(i + di, j + dj);
      sperret[f][k] = 0;
      if (Number.isNaN(gulv[f][k])) gulv[f][k] = p.y;
    }
}

// ---------- Veifinning (A* over alle etasjer, trapper som egne kanter) ----------
const NAB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
class Haug {
  constructor() { this.a = []; }
  push(n, p) { const a = this.a; a.push([p, n]); let i = a.length - 1;
    while (i > 0) { const q = (i - 1) >> 1; if (a[q][0] <= a[i][0]) break; [a[q], a[i]] = [a[i], a[q]]; i = q; } }
  pop() { const a = this.a, top = a[0], sist = a.pop();
    if (a.length) { a[0] = sist; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[1]; }
  get size() { return this.a.length; }
}
function finnVei(fra, til) {                                               // noder: [f, i, j]
  const nøkkel = (f, i, j) => f * N + id(i, j);
  const h = (f, i, j) => Math.hypot(i - til[1], j - til[2]) + Math.abs(f - til[0]) * 60;
  const g = new Map(), forrige = new Map(), åpen = new Haug();
  const start = nøkkel(...fra), mål = nøkkel(...til);
  g.set(start, 0); åpen.push(start, h(...fra));
  while (åpen.size) {
    const k = åpen.pop();
    if (k === mål) break;
    const f = Math.floor(k / N), r = k % N, i = r % NX, j = Math.floor(r / NX), gk = g.get(k);
    const prøv = (nk, kost, via) => {
      const ng = gk + kost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); forrige.set(nk, [k, via]);
        const nf = Math.floor(nk / N), nr = nk % N;
        åpen.push(nk, ng + h(nf, nr % NX, Math.floor(nr / NX)));
      }
    };
    for (const [di, dj, c] of NAB) {
      const ni = i + di, nj = j + dj;
      if (!gangbar(f, ni, nj)) continue;
      if (di && dj && (!gangbar(f, i + di, j) || !gangbar(f, i, j + dj))) continue;   // ikke skjær hjørner
      prøv(nøkkel(f, ni, nj), c, null);
    }
    for (const t of trapper) {                                             // trapper opp og ned
      if (f === t.f && i === t.nede[0] && j === t.nede[1]) prøv(nøkkel(t.f + 1, ...t.oppe), t.lengde / R, { t, opp: true });
      if (f === t.f + 1 && i === t.oppe[0] && j === t.oppe[1]) prøv(nøkkel(t.f, ...t.nede), t.lengde / R, { t, opp: false });
    }
  }
  if (!forrige.has(mål) && start !== mål) return null;
  // bygg veien baklengs: liste av punkter med etasje, trapper som ferdige baner
  const deler = [];
  let k = mål;
  while (k !== start) {
    const [fk, via] = forrige.get(k);
    deler.push({ k, via });
    k = fk;
  }
  deler.push({ k: start, via: null });
  deler.reverse();
  const punkt = k => { const f = Math.floor(k / N), r = k % N; return { f, i: r % NX, j: Math.floor(r / NX) }; };
  const vei = [];
  for (const d of deler) {
    if (d.via) {
      const b = d.via.opp ? d.via.t.bane : [...d.via.t.bane].reverse();
      for (const p of b) vei.push({ p: p.clone(), f: d.via.opp ? d.via.t.f + 1 : d.via.t.f, trapp: true });
    } else {
      const { f, i, j } = punkt(d.k);
      vei.push({ p: new THREE.Vector3(X0 + (i + 0.5) * R, gulv[f][id(i, j)], Z0 + (j + 0.5) * R), f, trapp: false });
    }
  }
  return glatt(vei);
}
// fjern unødvendige knekkpunkter der det er fri sikt i samme etasje
function friSikt(f, a, b) {
  const n = Math.ceil(a.distanceTo(b) / (R * 0.5));
  for (let s = 1; s < n; s++) {
    const x = a.x + (b.x - a.x) * s / n, z = a.z + (b.z - a.z) * s / n, [i, j] = celle(x, z);
    if (!gangbar(f, i, j)) return false;
  }
  return true;
}
function glatt(vei) {
  const ut = [vei[0]];
  let a = 0;
  while (a < vei.length - 1) {
    if (vei[a + 1].trapp || vei[a].trapp) { ut.push(vei[++a]); continue; }
    let b = a + 1;
    while (b + 1 < vei.length && !vei[b + 1].trapp && vei[b + 1].f === vei[a].f && friSikt(vei[a].f, vei[a].p, vei[b + 1].p)) b++;
    ut.push(vei[b]); a = b;
  }
  return ut;
}

export { R, base, gulv, sperret, celle, byggKart, gangbar, høydeVed, trapper, åpneTrappeender, finnVei };
