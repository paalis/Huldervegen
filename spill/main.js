import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { F, scene, vis, oppdater, etiketter, sol, midt } from '../hus.js';
import { kobleTil } from '../flerspiller.js';
import { lagHimmel } from '../himmel.js';
import { firebaseConfig } from '../firebase-config.js';
import { R, base, gulv, sperret, celle, byggKart, gangbar, høydeVed, trapper, åpneTrappeender, finnVei } from './gangkart.js';
import { lagFigur, FERDIGE, settUtseende, figurdeler, figurHendelser } from './figur.js';
import { KLIPP_HANDLING, lagAnimasjoner, animer, lastAnimasjoner } from './animasjon.js';
import { dører, lagDører, oppdaterDører } from './dorer.js';
import { munnPunkt, etterAnimasjon } from './hender.js';
import { slåSammen, skyggeTakt } from './ytelse.js';
import { del, nårFerdig } from './laster.js';
import { finnRom } from './rom.js';
import { lagDag } from './dag.js';
import { lagLys } from './lys.js';
import { lagMusikk } from './musikk.js';
import { toneHvert, visAlt, toning } from './toning.js';
import { lagHåndting, lagStratocaster, koppMaskin, middag, visDamp, damp, vann, oppdaterVann, panne, zzz } from './rekvisitter.js';

// lasteskjermen: huset bygges mens figuren og bevegelsene lastes ned (begge startes med en gang)
const husFerdig = del('Bygger huset …', 1);
lastAnimasjoner();

// husets egne deler (før spillet legger til figurer og rekvisitter): disse kan slås sammen for ytelse
const husDeler = new Set(); scene.traverse(o => { if (o.isMesh) husDeler.add(o); });

// ---------- Renderer, kamera, kontroller ----------
const mobil = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.1;
controls.minDistance = 3;
controls.maxDistance = 25;
controls.enablePan = false;

// myk skygge i hjørner og under møbler, som i 3D-modellen
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: mobil ? 0 : 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.5, scale: 1.4, samples: 16, distanceFallOff: 1 });
ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
const aoRender = ao.render.bind(ao);
ao.render = (...a) => {
  const skjult = [];
  scene.traverseVisible(o => { if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && o.material.transparent) { o.visible = false; skjult.push(o); } });   // gjennomsiktig (glass, damp, vann) blir svart i skyggeeffekten
  aoRender(...a);
  for (const o of skjult) o.visible = true;
};
composer.addPass(ao);
composer.addPass(new OutputPass());
if (mobil) { ao.enabled = false; sol.shadow.mapSize.set(1024, 1024); }       // lettere på mobil
const skyggeTikk = skyggeTakt(renderer, mobil);
const settStørrelse = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
};
settStørrelse();
window.addEventListener('resize', settStørrelse);
for (const o of etiketter) o.element.style.display = 'none';         // romnavn vises nederst i stedet

// hvilken animasjon som passer nå
function velgKlipp(handlingId, går, fart, løper) {
  const h = handlingId && HANDLINGER[handlingId];
  if (h) {
    if (KLIPP_HANDLING[handlingId]) return { klipp: KLIPP_HANDLING[handlingId], h };
    if (h.holdning === 'sitt') return { klipp: 'setter_seg', h, armer: !!h.armer };
    if (h.holdning === 'ligg') return { klipp: 'ligger', h };
    return { klipp: null, h };                                             // egne bevegelser (kaffe, dusj, ...)
  }
  if (går) return løper ? { klipp: 'løp', tempo: Math.min(1.6, Math.max(0.7, fart / 3.3)) } : { klipp: 'gå', tempo: Math.min(1.7, Math.max(0.55, fart / 1.35)) };
  return { klipp: 'stå' };
}

const lagretUtseende = (() => { try { return JSON.parse(localStorage.getItem('huldervegen-utseende')) || {}; } catch { return {}; } })();
// standard er 3D-modellen; et lagret utseende fra før 3D-valget fantes (uten «modell») gir også 3D-modellen
const STANDARD_FIGUR = FERDIGE['Pablo Andrés (3D)'];
const meg = lagFigur('modell' in lagretUtseende ? lagretUtseende : STANDARD_FIGUR);
// figur, ben, armer og hode peker på figuren som posers nå (meg, eller en annen spiller via medRigg)
let { figur, benV, benH, armV, armH, hodet } = meg, rigg = meg;
const jakke = meg.jakke;
function medRigg(r, fn) {
  const før = [figur, benV, benH, armV, armH, hodet, rigg];
  ({ figur, benV, benH, armV, armH, hodet } = r); rigg = r;
  try { fn(); } finally { [figur, benV, benH, armV, armH, hodet, rigg] = før; }
}
const lokal = () => figur === meg.figur;
const harJakke = () => jakke[0].visible;
const settJakke = på => { if (harJakke() !== på) { for (const d of jakke) d.visible = på; oppdaterKnapper(); } };
scene.add(figur);
figur.traverse(o => figurdeler.add(o));
figurHendelser.nyModell = r => { if (r === meg) oppdaterKnapper(); lagAnimasjoner(r); };

// markering der man klikket
const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0x3fd15a, transparent: true, opacity: 0, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);

// ---------- Tilstand og bevegelse ----------
const tilstand = { f: 0, pos: new THREE.Vector3(3.5, 0, 6.8), retning: Math.PI, vei: [], fart: 2.0, gange: 0, visEtasje: 0, handling: null, planlagt: null };
const knapp = id => document.getElementById(id);
function visEtasje(f) {
  tilstand.visEtasje = f;
  vis.etasje = f + 1; oppdater();
  for (const n of [1, 2, 3]) knapp(`etg${n}`).classList.toggle('på', n === f + 1);
  for (const b of document.querySelectorAll('#hurtig [data-etg]')) b.classList.toggle('på', +b.dataset.etg === f + 1);
  if (typeof oppdaterKnapper === 'function') oppdaterKnapper();
}
function gåTil(f, x, z, beholdPlan = false) {
  stoppHandling();
  if (!beholdPlan) tilstand.planlagt = null;
  // nærmeste gangbare rute rundt klikket
  let [ci, cj] = celle(x, z), best = null;
  for (let r = 0; r <= 20 && !best; r++)
    for (let dj = -r; dj <= r && !best; dj++) for (let di = -r; di <= r; di++)
      if ((Math.abs(di) === r || Math.abs(dj) === r) && gangbar(f, ci + di, cj + dj)) { best = [ci + di, cj + dj]; break; }
  if (!best) return false;
  const [si, sj] = celle(tilstand.pos.x, tilstand.pos.z);
  let start = [tilstand.f, si, sj];
  if (!gangbar(...start)) {                                              // stå fast i en kant: start i nærmeste ledige rute
    for (let r = 1; r <= 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
      if (gangbar(tilstand.f, si + di, sj + dj)) { start = [tilstand.f, si + di, sj + dj]; r = 99; dj = di = 99; }
  }
  const vei = finnVei(start, [f, ...best]);
  if (!vei) return false;
  tilstand.vei = vei.slice(1);
  const slutt = vei.at(-1).p;
  ring.position.set(slutt.x, slutt.y + 0.02, slutt.z); ring.material.opacity = 0.9;
  return true;
}

// klikk/trykk på gulvet (skilles fra dra-for-å-snu ved hvor langt pekeren flyttet seg)
const peker = new THREE.Vector2(), stråle = new THREE.Raycaster();
let ned = null;
renderer.domElement.addEventListener('pointerdown', e => { ned = [e.clientX, e.clientY]; draSist = [e.clientX, e.clientY]; });
// dra med musa (eller fingeren) for å snu kameraet rundt figuren når kameraet er bak den
let draSist = null;
renderer.domElement.addEventListener('pointermove', e => {
  if (!ned || !draSist || kamera.modus !== 'bak' || !(e.buttons & 1 || e.pointerType === 'touch')) return;
  const dx = e.clientX - draSist[0], dy = e.clientY - draSist[1];
  draSist = [e.clientX, e.clientY];
  kamera.dreiing -= dx * 0.006;
  kamera.helning = Math.min(3, Math.max(-1.2, kamera.helning + dy * 0.01));
  kamera.sistDra = performance.now();
});
addEventListener('pointerup', () => { draSist = null; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!ned || Math.hypot(e.clientX - ned[0], e.clientY - ned[1]) > 6) return;
  peker.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  stråle.setFromCamera(peker, camera);
  const f = tilstand.visEtasje, y0 = base(f);
  const treff = stråle.intersectObjects(scene.children, true).find(t => t.object.visible && t.object !== ring && !figurdeler.has(t.object) && t.point.y < y0 + 1.2);
  // bruk punktet der strålen krysser gulvnivået hvis treffet er på et møbel
  const p = treff ? treff.point : null;
  let x, z;
  if (p && p.y < y0 + 0.3) { x = p.x; z = p.z; }
  else {
    const t = (y0 - stråle.ray.origin.y) / stråle.ray.direction.y;
    if (!(t > 0)) return;
    x = stråle.ray.origin.x + stråle.ray.direction.x * t; z = stråle.ray.origin.z + stråle.ray.direction.z * t;
  }
  gåTil(f, x, z);
});

// piltaster/WASD: styr selv i forhold til kameraet
const taster = new Set();
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return;              // skriving i skjemaet
  const k = e.key.toLowerCase();
  if (k === 'e' && !e.repeat) nærmesteHandling();
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();               // ikke rull siden
  if (k === 'c' && !e.repeat) settKamera(kamera.modus === 'bak' ? 'ovenfra' : 'bak');
  taster.add(k);
});
addEventListener('keyup', e => taster.delete(e.key.toLowerCase()));

// knapper
for (const n of [1, 2, 3]) knapp(`etg${n}`).onclick = () => visEtasje(n - 1);
const settLave = på => { vis.lave = på; knapp('lave').classList.toggle('på', på); oppdater(); };
knapp('lave').onclick = () => settLave(!vis.lave);
knapp('bak').onclick = () => settKamera(kamera.modus === 'bak' ? 'ovenfra' : 'bak');

// romnavn nederst på skjermen
let sistRom = '';
function oppdaterRom() {
  const { f, pos } = tilstand;
  const r = finnRom(f, pos);
  const tekst = r ? `${r[5]}<small>${r[6] || `${f + 1}. etasje`}</small>` : `${f + 1}. etasje`;
  if (tekst !== sistRom) { knapp('rom').innerHTML = tekst; sistRom = tekst; }
}

// ---------- Handlinger ----------
// Hver handling: hvor figuren går (gå), hvor den plasseres (pos, retning), holdning (står, sitter eller
// ligger), armbevegelse og lyd. Lydfilene legges i mappen lyder/ (se lyder/README.md). Mangler en fil,
// kjører handlingen uten lyd. varighet: sekunder før figuren reiser seg av seg selv (null = til den
// gjør noe annet). gjenta: lyden går i loop.
const [G1, G2, G3] = [base(0), base(1), base(2)];
const π = Math.PI;
const sittArmer = (tt) => {                                               // hendene hviler på lårene
  for (const a of [armV, armH]) { a.skulder.rotation.x = -0.55; a.albue.rotation.x = -0.65; }
};
const vaskeArmer = (tt) => {                                              // gnir hendene under kranen
  armV.skulder.rotation.x = armH.skulder.rotation.x = -0.75;
  armV.albue.rotation.x = armH.albue.rotation.x = -0.75;
  armV.skulder.rotation.z = 0.28 + Math.sin(tt * 10) * 0.06;
  armH.skulder.rotation.z = -0.28 - Math.sin(tt * 10) * 0.06;
};
// to-ledds IK for armene til styreskjelettet: legg håndleddet på et punkt i verden (overarm 0,29, underarm
// 0,27, albuen bøyer framover). Brukes når hendene skal treffe noe bestemt, som stekepanna.
function rekk(a, mål) {
  figur.updateMatrixWorld(true);
  const d = figur.worldToLocal(mål.clone()).sub(a.skulder.position);
  const A = 0.29, B2 = 0.27, L = Math.min(d.length(), A + B2 - 0.005);
  const klem = v => Math.min(1, Math.max(-1, v));
  const sideveis = Math.asin(klem(d.x / L)), fram = Math.atan2(d.z, -d.y);
  const albue = Math.PI - Math.acos(klem((A * A + B2 * B2 - L * L) / (2 * A * B2)));
  const alfa = Math.acos(klem((A * A + L * L - B2 * B2) / (2 * A * L)));
  a.skulder.rotation.set(-(fram - alfa), 0, sideveis);
  a.albue.rotation.set(-albue, 0, 0);
}
// som rekk, men håndleddet på 3D-modellen skal treffe målet nøyaktig (rettHender gjør IK på modellens egne armbein)
// Målene gis i figurens faktiske stilling (slik den står etter animer); mens handlingen poserer, kan styreskjelettet
// stå et annet sted (når figuren sitter, senkes det), så målene regnes om dit først.
function iRigg(p) {
  if (!rigg.ekteInv) return p.clone();
  figur.updateMatrixWorld(true);
  return p.clone().applyMatrix4(rigg.ekteInv).applyMatrix4(figur.matrixWorld);
}
const fot = () => (rigg.fot ?? figur.position).clone();                   // figurens plass på gulvet
function rekkMot(a, mål) {
  a.mål = mål.clone(); a.brukt = true;                                     // 3D-modellen: se rettHender
  rekk(a, iRigg(mål));
}
const myk = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const retninger = () => { const h = figur.rotation.y; return [new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), new THREE.Vector3(-Math.cos(h), 0, Math.sin(h))]; };
const OPP = new THREE.Vector3(0, 1, 0);
// drikker av glass eller kopp (ting: 'glass' eller 'koppHånd'): holder det i fanget eller foran brystet, løfter det til munnen innimellom og vipper det
function drikk(tt, ting, hvile, periode = 9) {
  const [fram, høyre] = retninger(), u = tt % periode;
  const w = myk((u - (periode - 3.5)) / 0.8) * (1 - myk((u - (periode - 1.1)) / 0.8));   // 0 = hviler, 1 = ved munnen
  const munn = rigg.munn?.clone() ?? hodet.getWorldPosition(new THREE.Vector3()).addScaledVector(fram, 0.1);
  const vedMunn = munn.clone().addScaledVector(fram, 0.11).addScaledVector(høyre, 0.04).addScaledVector(OPP, -0.09);
  rekkMot(armV, hvile.clone().lerp(vedMunn, w));
  hodet.rotation.x = -0.12 * w;
  rigg.håndTing = { o: rigg.ting[ting], type: 'beger', w, vipp: 1.0 * w * (0.85 + 0.15 * Math.sin(tt * 2)), munn };
  return w;
}
const slappAv = tt => {                                                   // lener seg tilbake med et glass
  const [fram, høyre] = retninger();
  const p = fot(), w = drikk(tt, 'glass', p.clone().addScaledVector(høyre, 0.2).addScaledVector(fram, 0.2).setY(p.y + 0.72));
  rekkMot(armH, p.clone().addScaledVector(høyre, -0.24).addScaledVector(fram, 0.12).setY(p.y + 0.6));
  figur.rotation.x = -0.12;
  hodet.rotation.y = Math.sin(tt * 0.3) * 0.35 * (1 - w);
};
const jakkeArmer = tt => {                                                // armene inn i ermene, én om gangen
  const a = tt < 1.5 ? armV : armH, u = (tt % 1.5) / 1.5;
  a.skulder.rotation.x = -0.6 * Math.sin(u * π); a.skulder.rotation.z = (a === armV ? -1 : 1) * 0.9 * Math.sin(u * π);
  a.albue.rotation.x = -0.4;
};
const SKJORTER = ['#1f5a56', '#8a1e2d', '#2c3f6b', '#d9d4c7', '#3d3d3d', '#6b7a3a'];
const HANDLINGER = {
  piano: { navn: 'Spill piano', ikon: '🎹', f: 2, gå: [1.35, 5.90], pos: [0.89, 5.90], retning: -π / 2, holdning: 'sitt', sete: 0.53,
    lyd: 'lyder/piano.mp3', gjenta: true,
    armer: tt => {
      armV.skulder.rotation.x = -0.85 + Math.sin(tt * 9) * 0.05;
      armH.skulder.rotation.x = -0.85 + Math.sin(tt * 7 + 1) * 0.05;
      armV.albue.rotation.x = armH.albue.rotation.x = -0.55;
      armV.skulder.rotation.z = 0.25 + Math.sin(tt * 1.3) * 0.12;          // hendene flytter seg langs tangentene
      armH.skulder.rotation.z = -0.25 + Math.sin(tt * 1.1 + 2) * 0.12;
    } },
  gitar: { navn: 'Spill gitar', ikon: '🎸', f: 2, gå: [0.95, 8.58], pos: [0.95, 8.58], retning: π / 2, holdning: 'stå',
    lyd: 'lyder/gitar.mp3', gjenta: true,
    før: () => { holdtGitar.visible = true; if (stativGitar) stativGitar.visible = false; if (kontorstol) kontorstol.visible = false; },
    etter: () => { holdtGitar.visible = false; if (stativGitar) stativGitar.visible = true; if (kontorstol) kontorstol.visible = true; },
    armer: tt => {
      armV.skulder.rotation.x = -0.35 + Math.sin(tt * 12) * 0.1;          // høyre hånd slår an over lydhullet
      armV.skulder.rotation.z = 0.3; armV.albue.rotation.x = -0.75;
      armH.skulder.rotation.x = -0.75; armH.skulder.rotation.z = 0.12;    // venstre hånd på halsen
      armH.albue.rotation.x = -1.05;
    } },
  vaskemaskin: { navn: 'Start vaskemaskinen', ikon: '🧺', f: 2, gå: [4.78, 8.72], pos: [4.78, 8.72], retning: 0, holdning: 'stå',
    lyd: 'lyder/vaskemaskin.mp3', gjenta: false, varighet: 1.4, lydVed: 0.6, maskinGår: 12,
    armer: tt => {
      const løft = tt < 0.45 ? tt / 0.45 : tt < 0.95 ? 1 : Math.max(0, 1 - (tt - 0.95) / 0.4);
      armV.skulder.rotation.x = -1.3 * løft; armV.albue.rotation.x = -0.2;
    } },
  do2: { navn: 'Gå på do', rom: 'badet', ikon: '🚽', f: 1, gå: [2.55, 5.85], pos: [2.60, 6.47], retning: π, holdning: 'sitt', sete: 0.43,
    lyd: 'lyder/do.mp3', gjenta: false, varighet: 8, armer: sittArmer },
  do3: { navn: 'Gå på do', rom: 'vaskerommet', ikon: '🚽', f: 2, gå: [4.55, 8.80], pos: [4.55, 8.38], retning: 0, holdning: 'sitt', sete: 0.43,
    lyd: 'lyder/do.mp3', gjenta: false, varighet: 8, armer: sittArmer },
  vask2: { navn: 'Vask hendene', rom: 'badet', ikon: '🧼', f: 1, gå: [1.20, 6.30], pos: [1.20, 6.40], retning: 0, holdning: 'stå',
    lyd: 'lyder/handvask.mp3', gjenta: false, varighet: 6, armer: vaskeArmer },
  vask3: { navn: 'Vask hendene', rom: 'vaskerommet', ikon: '🧼', f: 2, gå: [3.80, 8.50], pos: [3.78, 8.50], retning: -π / 2, holdning: 'stå',
    lyd: 'lyder/handvask.mp3', gjenta: false, varighet: 6, armer: vaskeArmer },
  steke: { navn: 'Stek mat', ikon: '🍳', f: 0, gå: [1.25, 8.47], pos: [0.98, 8.47], retning: -π / 2, holdning: 'stå',
    lyd: 'lyder/steking.mp3', gjenta: true,
    før: () => { panne.visible = stekespade.visible = true; }, etter: () => { panne.visible = stekespade.visible = false; },
    armer: tt => {
      panne.rotation.y = -0.6 + Math.sin(tt * 2.5) * 0.04;                 // skaftet peker mot venstre hånd
      rekk(armV, new THREE.Vector3(0.76 + Math.cos(tt * 4) * 0.035, G1 + 1.0 + Math.sin(tt * 8) * 0.01, 8.36 + Math.sin(tt * 4) * 0.035));   // rører med stekespaden
      const skaft = new THREE.Vector3(0.27, 0.035, 0).applyQuaternion(panne.quaternion).add(panne.position);
      rekk(armH, skaft.setY(skaft.y + 0.05));                               // holder i skaftet
    } },
  sov13: { navn: 'Sov', rom: 'soverom 13 m²', ikon: '😴', f: 1, gå: [1.70, 1.40], pos: [0.81, 2.15], retning: 0, holdning: 'ligg', liggehøyde: 0.62,
    lyd: 'lyder/sove.mp3', gjenta: true },
  sov7: { navn: 'Sov', rom: 'soverom 7 m²', ikon: '😴', f: 1, gå: [3.60, 1.90], pos: [3.10, 0.81], retning: -π / 2, holdning: 'ligg', liggehøyde: 0.62,
    lyd: 'lyder/sove.mp3', gjenta: true },
  sov12: { navn: 'Sov', rom: 'soverom 12 m²', ikon: '😴', f: 1, gå: [2.40, 9.35], pos: [2.15, 8.17], retning: π / 2, holdning: 'ligg', liggehøyde: 0.62,
    lyd: 'lyder/sove.mp3', gjenta: true },
  netflix: { navn: 'Se Netflix', rom: 'stua', ikon: '📺', f: 0, gå: [2.45, 2.15], pos: [0.78, 2.05], retning: π / 2, holdning: 'sitt', sete: 0.46,
    lyd: 'lyder/netflix.mp3', gjenta: true,
    før: () => { fjernkontroll.visible = tvBilde.visible = true; }, etter: () => { fjernkontroll.visible = tvBilde.visible = false; },
    armer: tt => {
      sittArmer(tt);
      armV.skulder.rotation.x = -0.75; armV.albue.rotation.x = -0.95;      // fjernkontrollen i høyre hånd
      if (tt % 9 < 0.4) armV.skulder.rotation.x -= Math.sin(tt % 9 / 0.4 * π) * 0.12;   // bytter av og til
      if (lokal()) tegnTv(tt);
    } },
  netflix3: { navn: 'Se Netflix', rom: 'stua', ikon: '📺', f: 2, gå: [2.30, 4.95], pos: [2.25, 3.95], retning: 0, holdning: 'sitt', sete: 0.45,
    lyd: 'lyder/netflix.mp3', gjenta: true,
    før: () => { fjernkontroll.visible = tvBilde3.visible = true; }, etter: () => { fjernkontroll.visible = tvBilde3.visible = false; },
    armer: tt => { HANDLINGER.netflix.armer(tt); } },
  middag: { navn: 'Spis middag', ikon: '🍽️', f: 0, gå: [2.55, 4.20], pos: [2.10, 4.62], retning: 0, holdning: 'sitt', sete: 0.49,
    lyd: 'lyder/middag.mp3', gjenta: true,
    før: () => { middag.visible = gaffel.visible = true; }, etter: () => { middag.visible = gaffel.visible = false; },
    armer: tt => {
      // tar en bit fra tallerkenen, fører gaffelen til munnen, legger den ned igjen og tygger en stund
      const [fram, høyre] = retninger(), u = tt % 5.2, n = Math.floor(tt / 5.2);
      const mat = middag.position.clone().add(new THREE.Vector3(0, 0.035, 0))
        .addScaledVector(høyre, 0.03 * Math.sin(n * 2.1)).addScaledVector(fram, 0.03 * Math.cos(n * 1.7) - 0.01);
      const munn = rigg.munn?.clone() ?? hodet.getWorldPosition(new THREE.Vector3()).addScaledVector(fram, 0.1);
      const ned = fram.clone().multiplyScalar(0.55).addScaledVector(OPP, -0.8).addScaledVector(høyre, -0.15).normalize();   // gaffelen ned i maten
      const inn = fram.clone().multiplyScalar(-0.85).addScaledVector(OPP, 0.3).addScaledVector(høyre, -0.2).normalize();   // gaffelen inn i munnen
      const løft = myk((u - 1.3) / 0.8) * (1 - myk((u - 2.6) / 0.8));
      const stikk = u < 1.3 ? Math.max(0, Math.sin(u * 7)) * 0.015 : 0;
      const tupp = mat.clone().add(new THREE.Vector3(0, u > 3.4 ? 0.05 : stikk, 0)).lerp(munn.clone().addScaledVector(fram, 0.01), løft);
      const retning = ned.clone().lerp(inn, løft).normalize();
      rekkMot(armV, tupp.clone().addScaledVector(retning, -0.13));
      rekkMot(armH, middag.position.clone().addScaledVector(høyre, -0.24).addScaledVector(fram, -0.1).add(new THREE.Vector3(0, 0.04, 0)));
      hodet.rotation.x = 0.3 - løft * 0.25 + (u > 3.4 ? Math.max(0, Math.sin(tt * 9)) * 0.03 : 0);   // ser ned, løfter hodet litt, tygger
      rigg.håndTing = { o: rigg.ting.gaffel, type: 'skaft', tupp, retning, lengde: 0.105 };
    } },
  kaffe: { navn: 'Lag kaffe', ikon: '☕', f: 0, gå: [1.545, 8.55], pos: [1.545, 8.82], retning: 0, holdning: 'stå',
    lyd: 'lyder/kaffe.mp3', gjenta: false,
    før: () => { koppMaskin.visible = true; }, etter: () => { koppMaskin.visible = koppHånd.visible = damp.visible = false; },
    armer: tt => {
      if (tt < 1.2) {                                                       // trykker på knappen
        const r = Math.sin(Math.min(1, tt / 1.2) * π);
        armV.skulder.rotation.x = -1.25 * r; armV.albue.rotation.x = -0.2;
      } else if (tt < 6) {                                                  // venter mens kaffen renner
        armV.skulder.rotation.x = -0.15; armH.skulder.rotation.x = -0.15;
        if (lokal()) visDamp(new THREE.Vector3(1.545, 0.98, 9.29), tt);
        hodet.rotation.y = Math.sin(tt * 0.8) * 0.2;
      } else {                                                              // drikker
        if (lokal() && koppMaskin.visible) { koppMaskin.visible = false; koppHånd.visible = true; }
        const [fram, høyre] = retninger();
        const p = fot(); drikk(tt - 6 + 4, 'koppHånd', p.clone().addScaledVector(høyre, 0.15).addScaledVector(fram, 0.2).setY(p.y + 1.1), 7);
        if (lokal()) visDamp(koppHånd.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0)), tt);
      }
    } },
  ute: { medJakke: true, navn: 'Slapp av ute', rom: 'terrassen', ikon: '🌤️', f: 0, gå: [2.65, -1.40], pos: [1.55, -0.66], retning: π, holdning: 'sitt', sete: 0.47,
    lyd: 'lyder/ute.mp3', gjenta: true,
    før: () => { glass.visible = true; }, etter: () => { glass.visible = false; }, armer: slappAv },
  ut: { medJakke: true, navn: 'Gå ut', rom: 'tar på jakke', ikon: '🚪', f: 0, gå: [3.95, 8.55], pos: [4.02, 8.55], retning: π / 2, holdning: 'stå',
    lyd: 'lyder/jakke.mp3', gjenta: false, varighet: 3, vis: () => !harJakke(),
    armer: tt => { jakkeArmer(tt); if (tt > 1.6 && lokal()) settJakke(true); },
    ferdig: () => gåTil(0, 3.55, 10.75) },
  inn: { medJakke: true, navn: 'Gå inn', rom: 'tar av jakka', ikon: '🏠', f: 0, gå: [3.95, 8.55], pos: [4.02, 8.55], retning: π / 2, holdning: 'stå',
    lyd: 'lyder/jakke.mp3', gjenta: false, varighet: 3, vis: harJakke,
    armer: tt => { jakkeArmer(tt); if (tt > 1.6 && lokal()) settJakke(false); } },
  dusj: { navn: 'Dusj', rom: 'badet', ikon: '🚿', f: 1, gå: [1.30, 5.20], pos: [0.55, 5.04], retning: π / 2, holdning: 'stå',
    lyd: 'lyder/dusj.mp3', gjenta: false, varighet: 14,
    før: () => { vann.visible = true; }, etter: () => { vann.visible = damp.visible = false; },
    armer: tt => {                                                          // vasker håret
      for (const [a, sz] of [[armV, 0.55], [armH, -0.55]]) {
        a.skulder.rotation.x = -2.2 + Math.sin(tt * 6 + (a === armV ? 0 : 1.5)) * 0.12; a.skulder.rotation.z = sz;
        a.albue.rotation.x = -1.7;
      }
      hodet.rotation.x = -0.15;
      if (lokal()) { oppdaterVann(tt); visDamp(new THREE.Vector3(0.55, F + 1.9, 5.04), tt); }
    } },
  tenner: { navn: 'Puss tennene', rom: 'badet', ikon: '🪥', f: 1, gå: [1.48, 6.25], pos: [1.48, 6.42], retning: 0, holdning: 'stå',
    lyd: 'lyder/tannpuss.mp3', gjenta: false, varighet: 10,
    før: () => { tannbørste.visible = true; }, etter: () => { tannbørste.visible = false; },
    armer: tt => {
      // høyre hånd ved munnviken (børsten rettes inn mot munnen i plasserTannbørste), venstre hånd på servanten;
      // børster fram og tilbake og flytter seg sakte mellom venstre og høyre side av munnen
      hodet.rotation.x = 0.18;
      const h = figur.rotation.y, fram = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), høyre = new THREE.Vector3(-Math.cos(h), 0, Math.sin(h));
      const munn = munnPunkt(rigg), gnikk = Math.sin(tt * 11), side = Math.sin(tt * 0.5);
      rekk(armV, munn.clone().addScaledVector(høyre, 0.12 + gnikk * 0.012).addScaledVector(fram, 0.07 + side * 0.03)
        .add(new THREE.Vector3(0, -0.13 + Math.cos(tt * 11) * 0.005, 0)));
      rekk(armH, figur.position.clone().addScaledVector(høyre, -0.26).addScaledVector(fram, 0.27).setY(G2 + 0.95));
    } },
  klær: { navn: 'Skift T-skjorte', rom: 'garderoben', ikon: '👕', f: 1, gå: [1.40, 3.50], pos: [1.40, 3.62], retning: 0, holdning: 'stå',
    lyd: 'lyder/garderobe.mp3', gjenta: false, varighet: 4,
    armer: tt => {
      if (tt < 1.2) {                                                       // åpner skapet og finner en skjorte
        armV.skulder.rotation.x = -1.2 * Math.sin(tt / 1.2 * π); armV.albue.rotation.x = -0.3;
      } else {                                                              // trekker den over hodet
        const o = Math.sin(Math.min(1, (tt - 1.2) / 2.4) * π);
        for (const a of [armV, armH]) { a.skulder.rotation.x = -2.6 * o; a.albue.rotation.x = -0.9 * o; }
        if (tt > 2.4 && lokal() && !tilstand.handling.skiftet) {
          tilstand.handling.skiftet = true;
          const i = (SKJORTER.indexOf(meg.utseende.skjorte) + 1) % SKJORTER.length;
          byttUtseende({ ...meg.utseende, skjorte: SKJORTER[i] });
        }
      }
    } },
  utsikt: { medJakke: true, navn: 'Se utover', rom: 'altanen', ikon: '🌇', f: 1, gå: [3.80, 10.60], pos: [3.80, 11.30], retning: 0, holdning: 'stå',
    lyd: 'lyder/utsikt.mp3', gjenta: true,
    armer: tt => {                                                          // albuene på rekkverket, ser seg rundt
      for (const [a, sz] of [[armV, 0.3], [armH, -0.3]]) { a.skulder.rotation.x = -0.75; a.skulder.rotation.z = sz; a.albue.rotation.x = -1.35; }
      hodet.rotation.y = Math.sin(tt * 0.35) * 0.55;
      figur.rotation.x = 0.08;
    } },
  takterrasse: { medJakke: true, navn: 'Slapp av', rom: 'takterrassen', ikon: '🌅', f: 2, gå: [1.20, 1.10], pos: [1.15, 2.58], retning: π, holdning: 'sitt', sete: 0.48,
    lyd: 'lyder/takterrasse.mp3', gjenta: true,
    før: () => { glass.visible = true; }, etter: () => { glass.visible = false; }, armer: slappAv },
  playstation: { navn: 'Spill PlayStation', rom: 'kontoret', ikon: '🎮', f: 2, gå: [1.05, 8.55], pos: [1.60, 8.55], retning: π / 2, holdning: 'sitt', sete: 0.51,
    lyd: 'lyder/playstation.mp3', gjenta: true,
    før: () => { kontroll.visible = skjermlys.visible = true; }, etter: () => { kontroll.visible = skjermlys.visible = false; },
    armer: tt => {
      for (const [a, sz] of [[armV, 0.32], [armH, -0.32]]) {
        a.skulder.rotation.x = -0.55; a.skulder.rotation.z = sz;
        a.albue.rotation.x = -1.15 + Math.sin(tt * (a === armV ? 13 : 11)) * 0.04;   // tomlene jobber
      }
      kontroll.rotation.x = Math.sin(tt * 2) * 0.06;
      skjermlys.material.color.setHSL((tt * 0.07) % 1, 0.55, 0.45 + Math.sin(tt * 6) * 0.08);
    } },
};
// kameravinkel under handlingen (med kamera bak figuren): fra siden, forfra eller på skrå bakfra
const KAMERA_FOR = {
  do2: 'side', do3: 'side', piano: 'front', gitar: 'front', middag: 'front', ute: 'front', takterrasse: 'front',
  vask2: 'side', vask3: 'side', tenner: 'side', kaffe: 'side', sov13: 'side', sov7: 'side', sov12: 'side',
  dusj: 'side', utsikt: 'høyre', vaskemaskin: 'skrå', steke: 'høyre', netflix: 'skrå', netflix3: 'skrå', playstation: 'skrå',
};
for (const [id, k] of Object.entries(KAMERA_FOR)) if (HANDLINGER[id]) HANDLINGER[id].kamera = k;
// kontroll i hendene og lys på skjermen mens figuren spiller
const kontroll = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.09, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
kontroll.position.set(0, 0.88, 0.30); kontroll.visible = false; figur.add(kontroll);
const skjermlys = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.34), new THREE.MeshBasicMaterial({ color: 0x3366aa }));
skjermlys.position.set(2.566, G3 + 1.05, 8.70); skjermlys.rotation.y = -π / 2; skjermlys.visible = false; scene.add(skjermlys);
// fjernkontroll i hånda og bilde på TV-en i stua mens figuren ser Netflix
const fjernkontroll = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.02, 0.17, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }));
fjernkontroll.position.set(-0.17, 0.80, 0.30); fjernkontroll.visible = false; figur.add(fjernkontroll);
const tvLerret = document.createElement('canvas'); tvLerret.width = 320; tvLerret.height = 180;
const tvTekstur = new THREE.CanvasTexture(tvLerret); tvTekstur.colorSpace = THREE.SRGBColorSpace;
const tvBilde = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.81), new THREE.MeshBasicMaterial({ map: tvTekstur, toneMapped: false }));
tvBilde.position.set(5.015, G1 + 1.375, 1.90); tvBilde.rotation.y = -π / 2; tvBilde.visible = false; scene.add(tvBilde);
function tegnTv(tt) {                                                    // logo først, så en «film» med rolig skiftende bilder
  const g = tvLerret.getContext('2d'), w = 320, h = 180;
  if (tt < 3) {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.globalAlpha = Math.min(1, tt * 1.5, (3 - tt) * 2);
    g.font = 'bold 44px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e50914'; g.fillText('NETFLIX', w / 2, h / 2);
    g.globalAlpha = 1;
  } else {
    const klipp = Math.floor((tt - 3) / 6), u = (tt - 3) % 6 / 6;
    const hue = (klipp * 67 + 200) % 360;
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, `hsl(${hue}, 50%, ${45 + 10 * Math.sin(tt * 0.7)}%)`);
    gr.addColorStop(1, `hsl(${(hue + 40) % 360}, 55%, 22%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = `hsla(${(hue + 180) % 360}, 45%, 70%, 0.7)`;
    g.beginPath(); g.ellipse(60 + u * 200, 110 - Math.sin(u * π) * 20, 34, 52, 0, 0, 2 * π); g.fill();   // en figur som går over bildet
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 150, w, 30);
  }
  tvTekstur.needsUpdate = true;
}
// TV-en i stua i 3. etasje viser det samme
const tvBilde3 = new THREE.Mesh(tvBilde.geometry.clone().scale(0.86 / 1.46, 0.50 / 0.81, 1), tvBilde.material);
tvBilde3.position.set(2.30, G3 + 0.81, 6.605); tvBilde3.rotation.y = π; tvBilde3.visible = false; scene.add(tvBilde3);
// ting i hånda: hver figur har sitt eget sett (rekvisitter.js) i en gruppe på styreskjelettets hånd, som flyttes
// til 3D-modellens hånd når den er lastet (oppdaterGrep), og sin egen gitar
function giHåndting(r) {
  r.håndJust = new THREE.Group(); r.armV.hånd.add(r.håndJust);
  r.ting = lagHåndting();
  for (const [navn, o] of Object.entries(r.ting)) {
    r.håndJust.add(o); o.userData.ting = navn; o.userData.opprinnelig = [o.position.clone(), o.quaternion.clone()];
  }
  r.gitar = lagStratocaster(); r.gitar.visible = false; scene.add(r.gitar);
}
giHåndting(meg);
meg.fot = tilstand.pos;                                                    // figurens plass på gulvet (se fot)
const { gaffel, koppHånd, glass, tannbørste, stekespade } = meg.ting, holdtGitar = meg.gitar;
let kontorstol = null, stativGitar = null, vaskemaskin = null, vaskeluke = null, vaskX = 0, vaskLukeX = 0;
function finnTing() {
  scene.traverse(o => {
    if (o.isGroup && Math.abs(o.position.x - 0.40) < 0.02 && Math.abs(o.position.y - G3) < 0.02 && Math.abs(o.position.z - 8.58) < 0.02) stativGitar = o;
    if (o.isGroup && Math.abs(o.position.x - 1.60) < 0.02 && Math.abs(o.position.y - G3) < 0.02 && Math.abs(o.position.z - 8.55) < 0.02) kontorstol = o;
  });
  vaskemaskin = scene.getObjectByName('vaskemaskin'); vaskeluke = scene.getObjectByName('trommel');   // maskinen og trommelen som snurrer
  if (vaskemaskin) vaskX = vaskemaskin.position.x;
  if (vaskeluke) vaskLukeX = vaskeluke.position.x;
}
let lyd = null;
function spillLyd(h) {
  stoppLyd();
  const l = new Audio(h.lyd); l.loop = !!h.gjenta;
  l.addEventListener('error', () => { if (lyd === l) lyd = null; });
  l.play().catch(() => {});
  return (lyd = l);
}
function stoppLyd() { if (lyd) { lyd.pause(); lyd = null; } }
function planlegg(id) {                                                  // gå til handlingen og start den der
  const h = HANDLINGER[id];
  if (opptatt(id)) return;                                                // en annen spiller er der
  if (gåTil(h.f, ...h.gå, true)) tilstand.planlagt = id;
}
function nærmesteHandling() {
  const t = tilstand;
  let best = null, d = 2.5;
  for (const [id, h] of Object.entries(HANDLINGER)) {
    const a = Math.hypot(t.pos.x - h.gå[0], t.pos.z - h.gå[1]);
    if (h.f === t.f && a < d && (!h.vis || h.vis()) && !opptatt(id)) { d = a; best = id; }
  }
  if (best) planlegg(best);
}
function startHandling(id) {
  const t = tilstand, h = HANDLINGER[id];
  taBilde();                                                               // gli fra gangen inn i handlingen
  kamera.dreiing = 0; kamera.helning = 0;                                  // handlingens egen kameravinkel
  t.handling = { id, tid: 0 };
  t.pos.set(h.pos[0], base(h.f), h.pos[1]);
  t.retning = h.retning; figur.rotation.y = h.retning;
  if (!h.medJakke) settJakke(false);                                       // jakka henges av når figuren gjør noe inne
  h.før?.();
  if (h.lydVed === undefined) spillLyd(h);
  oppdaterKnapper();
}
function stoppHandling() {
  const t = tilstand, h = t.handling && HANDLINGER[t.handling.id];
  if (!h) return;
  if (h.holdning === 'sitt' && meg.anim?.handlinger.reiser_seg)            // 3D-modellen reiser seg ordentlig først
    t.reiser = { tid: 0, varighet: meg.anim.handlinger.reiser_seg.getClip().duration / 1.4, h, pos: t.pos.clone(), retning: meg.figur.rotation.y, y: t.pos.y };
  else taBilde();                                                          // reis seg mykt
  t.pos.set(h.gå[0], base(h.f), h.gå[1]);                                // reis seg / gå ut av senga
  const [i, j] = celle(t.pos.x, t.pos.z);
  if (!gangbar(t.f, i, j)) for (let r = 1; r <= 10 && !gangbar(t.f, ...celle(t.pos.x, t.pos.z)); r++)
    for (const [di, dj] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (gangbar(t.f, i + di, j + dj)) { t.pos.x += di * R; t.pos.z += dj * R; break; }
  h.etter?.();
  if (h.lydVed === undefined) stoppLyd();
  figur.rotation.x = 0; figur.rotation.z = 0; zzz.visible = false; hodet.rotation.set(0, 0, 0);
  t.handling = null;
  oppdaterKnapper();
}
let vaskTid = 0;
function oppdaterVask(dt) {                                              // maskinen rister mens den går
  if (vaskTid <= 0) return;
  vaskTid -= dt;
  const s = vaskTid > 0 ? Math.sin(performance.now() / 22) * 0.003 : 0;
  if (vaskemaskin) vaskemaskin.position.x = vaskX + s;
  if (vaskeluke) { vaskeluke.position.x = vaskLukeX + s; vaskeluke.rotation.z += dt * 6; }
}
// stillingen i en handling, for egen figur eller (via medRigg) en annen spiller; y = gulvet der den står
function posere(h, tt, y) {
  for (const b of [benV, benH]) { b.hofte.rotation.x = 0; b.kne.rotation.x = 0; }
  for (const a of [armV, armH]) { a.skulder.rotation.x = 0; a.albue.rotation.x = -0.1; a.skulder.rotation.z = (a === armV ? -1 : 1) * 0.08; }
  figur.rotation.x = 0; figur.rotation.z = 0; hodet.rotation.set(0, 0, 0); figur.userData.vri = 0;
  figur.position.y = y;
  if (h.holdning === 'sitt') {
    for (const b of [benV, benH]) { b.hofte.rotation.x = -1.5; b.kne.rotation.x = 1.45; }
    figur.position.y = y + h.sete - 0.89 * figur.scale.y;
  } else if (h.holdning === 'ligg') {                                    // på ryggen, hodet mot puta
    figur.rotation.x = -π / 2;
    figur.position.y = y + h.liggehøyde;
    for (const a of [armV, armH]) { a.albue.rotation.x = -0.15; a.skulder.rotation.z = (a === armV ? 1 : -1) * 0.02; }
    figur.position.y += Math.sin(tt * 1.6) * 0.004;                      // pust
    if (lokal()) {
      const hode = new THREE.Vector3(0, 1.75, 0).applyEuler(figur.rotation).add(figur.position);
      zzz.position.set(hode.x, hode.y + 0.35 + (tt % 2.5) * 0.12, hode.z); zzz.visible = true;
      zzz.material.opacity = 1 - (tt % 2.5) / 2.5;
    }
  } else if (h.holdning === 'stå') {
    figur.position.y = y + Math.abs(Math.sin(tt * 3)) * 0.004;
  }
  h.armer?.(tt);
}
function poseHandling(dt) {
  const t = tilstand, h = HANDLINGER[t.handling.id], hd = t.handling;
  hd.tid += dt;
  const tt = hd.tid;
  zzz.visible = false;
  posere(h, tt, t.pos.y);
  if (h.lydVed !== undefined && tt >= h.lydVed && !hd.lydStartet) {     // vaskemaskinen: trykk, så går den
    hd.lydStartet = true;
    const l = spillLyd(h);
    vaskTid = h.maskinGår;
    l.addEventListener('loadedmetadata', () => { if (Number.isFinite(l.duration)) vaskTid = l.duration; });
  }
  if (h.varighet && tt > h.varighet) { stoppHandling(); h.ferdig?.(); }
}
// ikoner der handlingene skjer: et rundt ikon over hver plass i etasjen som vises. Trykk for å gå dit og
// gjøre handlingen; mens den pågår blir ikonet en stoppknapp. Opptatte plasser (flerspiller) er grå.
const ikoner = new Map();                                                // id → { el, tilstand }
const IKONHØYDE = { sitt: 1.45, ligg: 1.05, stå: 2.0 };
function oppdaterKnapper() {
  for (const [id, h] of Object.entries(HANDLINGER)) {
    if (ikoner.has(id)) continue;
    const el = document.createElement('button'); el.className = 'hikon';
    el.innerHTML = '<span class="tegn"></span><span class="navn"></span>';
    el.addEventListener('click', e => {
      e.stopPropagation();
      const t = tilstand;
      if (t.handling?.id === id) stoppHandling();
      else if (t.planlagt === id) { t.planlagt = null; t.vei = []; }
      else if (!opptatt(id)) planlegg(id);
    });
    knapp('ikoner').appendChild(el);
    ikoner.set(id, { el, def: h, punkt: h.ikonPunkt ?? new THREE.Vector3(h.pos[0], base(h.f) + (IKONHØYDE[h.holdning] ?? 1.8), h.pos[1]), sist: '' });
  }
  // trappene: ⬆ ved foten og ⬇ på toppen; trykk, så går figuren opp eller ned
  for (const tr of trapper) for (const opp of [true, false]) {
    const id = `trapp-${tr.f}-${opp ? 'opp' : 'ned'}`;
    if (ikoner.has(id)) continue;
    const fra = opp ? tr.bane[0] : tr.bane.at(-1), til = opp ? tr.bane.at(-1) : tr.bane[0];
    const def = { f: opp ? tr.f : tr.f + 1, ikon: opp ? '⬆' : '⬇', navn: opp ? `Gå opp til ${tr.f + 2}. etasje` : `Gå ned til ${tr.f + 1}. etasje`, trapp: true };
    const el = document.createElement('button'); el.className = 'hikon';
    el.innerHTML = '<span class="tegn"></span><span class="navn"></span>';
    el.addEventListener('click', e => { e.stopPropagation(); gåTil(opp ? tr.f + 1 : tr.f, til.x, til.z); });
    knapp('ikoner').appendChild(el);
    ikoner.set(id, { el, def, punkt: fra.clone().add(new THREE.Vector3(0, 1.7, 0)), sist: '' });
  }
}
const ikonP = new THREE.Vector3(), ikonStråle = new THREE.Raycaster();
function bakVegg(punkt) {                                                // står noe synlig mellom kameraet og punktet?
  const r = new THREE.Vector3().subVectors(punkt, camera.position), l = r.length();
  ikonStråle.set(camera.position, r.normalize()); ikonStråle.far = l - 0.35;
  return ikonStråle.intersectObjects(hindre, false).some(h => h.object.visible && synlig(h.object));
}
function plasserIkoner() {
  const t = tilstand;
  for (const [id, ik] of ikoner) {
    const h = ik.def, el = ik.el;
    let vis = h.f === t.visEtasje && (!h.vis || h.vis()) && knapp('fler').hidden;
    if (vis) { ikonP.copy(ik.punkt).project(camera); vis = ikonP.z < 1 && Math.abs(ikonP.x) < 1.05 && Math.abs(ikonP.y) < 1.05; }
    // med kamera bak figuren: bare ikoner i nærheten som ikke står bak en vegg (sjekkes noen ganger i sekundet)
    if (vis && kamera.modus === 'bak' && !(t.handling?.id === id || t.planlagt === id)) {
      const nærme = Math.hypot(t.pos.x - ik.punkt.x, t.pos.z - ik.punkt.z) < 4.5;
      if (!nærme) vis = false;
      else {
        if (!(ik.sjekk > 0)) { ik.sjekk = 8 + (ik.punkt.x * 7 | 0) % 4; ik.bak = bakVegg(ik.punkt); }
        ik.sjekk--;
        vis = !ik.bak;
      }
    }
    if (!vis) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    const aktiv = t.handling?.id === id, påVei = t.planlagt === id, opp = !h.trapp && !h.lys && !aktiv && opptatt(id);
    const tilst = `${aktiv}${påVei}${opp}${h.tilstand?.() ?? ''}`;
    if (tilst !== ik.sist) {                                               // bare oppdater teksten når noe endrer seg
      ik.sist = tilst;
      el.classList.toggle('aktiv', aktiv || påVei); el.classList.toggle('opptatt', opp);
      el.querySelector('.tegn').textContent = aktiv || påVei ? '⏹' : h.ikon;
      el.querySelector('.navn').textContent = aktiv ? `Stopp: ${h.navn}` : påVei ? `På vei: ${h.navn}` : `${h.navn}${h.rom ? ` (${h.rom})` : ''}${opp ? ' – opptatt' : ''}`;
      el.setAttribute('aria-label', el.querySelector('.navn').textContent);
    }
    const avstand = camera.position.distanceTo(ik.punkt), nær = Math.hypot(t.pos.x - ik.punkt.x, t.pos.z - ik.punkt.z);
    const skala = Math.min(1.15, Math.max(0.82, 6 / avstand));
    el.style.display = '';
    el.style.opacity = aktiv || påVei ? 1 : nær < 4 ? 1 : 0.8;
    el.style.transform = `translate(${(ikonP.x + 1) / 2 * innerWidth - 21}px, ${(1 - ikonP.y) / 2 * innerHeight - 21}px) scale(${skala.toFixed(2)})`;
  }
}

// gange: hofta svinger, kneet bøyes når benet føres fram, armene svinger motsatt med litt bøyd albue
function gangPose(gange, beveger, y) {
  const sving = beveger ? Math.sin(gange) * 0.55 : Math.sin(gange) * 0.55 * 0.85;
  for (const [b, a, fase] of [[benV, armH, sving], [benH, armV, -sving]]) {
    b.hofte.rotation.x = fase * 0.75;
    b.kne.rotation.x = Math.max(0, -Math.sin(gange + (b === benV ? 0 : Math.PI) + 0.9)) * (beveger ? 0.9 : 0);
    a.skulder.rotation.x = fase * 0.6;
    a.albue.rotation.x = -0.18 - Math.max(0, fase) * 0.45;
    a.skulder.rotation.z = (a === armV ? -1 : 1) * 0.08;
  }
  figur.rotation.x = 0; hodet.rotation.set(0, 0, 0);
  figur.position.y = y + (beveger ? Math.abs(Math.cos(gange)) * 0.025 : 0);
  // overkroppen vrir seg litt mot benene når den går; står den stille, puster den, flytter vekten
  // og ser seg litt rundt (hver figur i sin egen takt)
  const T = performance.now() / 1000 + (figur.id % 7) * 1.3, ro = beveger ? 0 : 1;
  figur.userData.vri = beveger ? Math.sin(gange) * 0.13 : 0;
  figur.rotation.z = ro * Math.sin(T * 0.45) * 0.012;
  hodet.rotation.y = ro * (Math.sin(T * 0.31) * 0.14 + Math.sin(T * 0.11 + 1) * 0.1);
  hodet.rotation.x = ro * Math.sin(T * 0.23) * 0.05;
  for (const a of [armV, armH]) a.skulder.rotation.x += ro * Math.sin(T * 1.25) * 0.015;   // pust
}

// 3D-modellen min: velg animasjon ut fra tilstanden
const sistPos = new THREE.Vector3();
function animerMeg(dt) {
  const t = tilstand;
  const fart = dt > 0 ? Math.hypot(t.pos.x - sistPos.x, t.pos.z - sistPos.z) / dt : 0;
  sistPos.copy(t.pos);
  let valg;
  if (t.reiser) valg = { klipp: 'reiser_seg', h: t.reiser.h, tempo: 1.4 };
  else valg = velgKlipp(t.handling?.id, t.beveger, fart, t.løper);
  valg.y = t.reiser ? t.reiser.y : t.pos.y;
  animer(meg, valg, dt);
  etterAnimasjon(meg);
}
// myke overganger: stillingen tas vare på når figuren setter seg, reiser seg eller bytter handling,
// og den nye stillingen glir inn over den gamle i løpet av et halvt sekund
const LEDD = () => [meg.benV.hofte, meg.benV.kne, meg.benH.hofte, meg.benH.kne, meg.armV.skulder, meg.armV.albue, meg.armH.skulder, meg.armH.albue, meg.hodet];
let overgang = null;
function taBilde(varighet = 0.55) {
  const f = meg.figur;
  overgang = { tid: 0, varighet, ledd: LEDD().map(o => o.rotation.clone()), pos: f.position.clone(), ry: f.rotation.y, rx: f.rotation.x, rz: f.rotation.z };
}
function blandOvergang(dt) {
  if (!overgang) return;
  overgang.tid += dt;
  const u = Math.min(1, overgang.tid / overgang.varighet);
  if (u >= 1) { overgang = null; return; }
  const w = 1 - u * u * (3 - 2 * u), f = meg.figur;                     // vekten på den gamle stillingen
  LEDD().forEach((o, i) => {
    const g = overgang.ledd[i], r = o.rotation;
    r.set(r.x + (g.x - r.x) * w, r.y + (g.y - r.y) * w, r.z + (g.z - r.z) * w);
  });
  f.position.lerp(overgang.pos, w);
  let dr = overgang.ry - f.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  f.rotation.y += dr * w; f.rotation.x += (overgang.rx - f.rotation.x) * w; f.rotation.z += (overgang.rz - f.rotation.z) * w;
}

// ---------- Oppdatering hvert bilde ----------
const klokke = new THREE.Clock(), fremover = new THREE.Vector3(), høyre = new THREE.Vector3();
function steg(dt) {
  const t = tilstand;
  let beveger = false;
  if (t.reiser) {                                                          // reiser seg fra stolen/sofaen
    t.reiser.tid += dt;
    if (t.reiser.tid < t.reiser.varighet) {
      figur.position.copy(t.reiser.pos); figur.rotation.set(0, t.reiser.retning, 0);
      t.beveger = false; oppdaterVask(dt); oppdaterRom();
      return;
    }
    const hp = meg.avatar?.rot.getObjectByName('Hips')?.getWorldPosition(new THREE.Vector3());
    if (hp) figur.position.set(hp.x, t.reiser.y, hp.z);                   // fortsett der den står nå
    t.reiser = null; taBilde(0.4);
  }
  // tastaturstyring avbryter klikkveien
  const fx = ((taster.has('arrowright') || taster.has('d')) - (taster.has('arrowleft') || taster.has('a'))) || stikke.x;
  const fz = ((taster.has('arrowup') || taster.has('w')) - (taster.has('arrowdown') || taster.has('s'))) || -stikke.y;
  if (!fx) t.sving = 0;
  const iTrapp = t.vei.length && t.vei[0].trapp;                         // i trappa: gå ferdig opp eller ned
  const løper = taster.has('shift') ? 1.6 : 1;                           // Shift: løp
  t.løper = løper > 1 && (t.beveger || false);
  if ((fx || fz) && !iTrapp) {
    if (t.handling) stoppHandling();
    t.planlagt = null;
    t.vei = [];
    let v;
    if (kamera.modus === 'bak') {                                          // som i GTA: ← → snur, ↑ ↓ går
      // svinghastigheten bygger seg opp mykt opp til ca. 95 grader i sekundet
      t.sving = Math.min(1, (t.sving || 0) + dt * 3);
      t.retning -= fx * 1.65 * t.sving * dt;
      v = new THREE.Vector3(Math.sin(t.retning), 0, Math.cos(t.retning)).multiplyScalar(fz * t.fart * løper * dt * (fz < 0 ? 0.6 : 1));
    } else {
      camera.getWorldDirection(fremover); fremover.y = 0; fremover.normalize();
      høyre.crossVectors(fremover, camera.up).normalize();
      v = fremover.multiplyScalar(fz).add(høyre.multiplyScalar(fx)).normalize().multiplyScalar(t.fart * løper * dt * Math.min(1, Math.hypot(fx, fz)));
    }
    const prøv = (dx, dz) => {
      const [i, j] = celle(t.pos.x + dx, t.pos.z + dz);
      if (!gangbar(t.f, i, j)) return false;
      t.pos.x += dx; t.pos.z += dz; return true;
    };
    if (fz || kamera.modus !== 'bak') {
      if (prøv(v.x, v.z) || prøv(v.x, 0) || prøv(0, v.z)) beveger = true;
      if (kamera.modus !== 'bak') t.retning = Math.atan2(v.x, v.z);
    }
    const h = høydeVed(t.f, t.pos.x, t.pos.z);
    if (!Number.isNaN(h)) t.pos.y += (h - t.pos.y) * Math.min(1, dt * 12);
    // gå inn i trappa når man er nær foten eller toppen og går omtrent mot den
    const fart = Math.hypot(v.x, v.z);
    let motTrapp = false;
    for (const tr of trapper) {
      const [a, b] = t.f === tr.f ? [tr.bane[0], tr.bane[1]] : t.f === tr.f + 1 ? [tr.bane.at(-1), tr.bane.at(-2)] : [];
      if (!a || fart < 1e-6) continue;
      const mot = new THREE.Vector3(b.x - t.pos.x, 0, b.z - t.pos.z).normalize();
      const rettMot = Math.hypot(t.pos.x - a.x, t.pos.z - a.z) < 0.45 && (mot.x * v.x + mot.z * v.z) / fart > 0.85;
      if (!rettMot) continue;
      motTrapp = true;
      t.trappHold = (t.trappHold || 0) + dt;                               // må gå rett mot trappa et kort øyeblikk
      if (t.trappHold >= 0.3) {
        t.trappHold = 0;
        const opp = t.f === tr.f;
        t.vei = (opp ? tr.bane : [...tr.bane].reverse()).map(p => ({ p: p.clone(), f: opp ? tr.f + 1 : tr.f, trapp: true }));
      }
    }
    if (!motTrapp) t.trappHold = 0;
  }
  // følg veien
  // rolig start og oppbremsing før målet (ikke i trappa)
  let rest = 0, forrige = t.pos;
  for (const m of t.vei) { rest += forrige.distanceTo(m.p); forrige = m.p; }
  t.akselerasjon = t.vei.length ? Math.min(1, (t.akselerasjon || 0.25) + dt * 3) : 0;
  t.tempo = t.vei.length && !t.vei[0].trapp ? t.akselerasjon * Math.min(1, Math.max(0.35, rest / 0.7)) : 1;
  let igjen = t.fart * t.tempo * (t.vei.length && !t.planlagt ? løper : 1) * dt;
  while (t.vei.length && igjen > 0) {
    const mål = t.vei[0], d = new THREE.Vector3().subVectors(mål.p, t.pos);
    const flat = Math.hypot(d.x, d.z), lengde = mål.trapp ? d.length() : flat;
    if (flat > 1e-3) t.retning = Math.atan2(d.x, d.z);
    if (lengde <= igjen) {
      t.pos.copy(mål.p); igjen -= lengde;
      if (mål.f !== t.f) { t.f = mål.f; visEtasje(t.f); }              // ny etasje: vis den
      t.vei.shift();
    } else {
      t.pos.addScaledVector(d, igjen / lengde);
      if (!mål.trapp) { const h = høydeVed(t.f, t.pos.x, t.pos.z); if (!Number.isNaN(h)) t.pos.y += (h - t.pos.y) * Math.min(1, dt * 12); }
      igjen = 0;
    }
    beveger = true;
  }
  // figur og gange
  figur.position.copy(t.pos);
  let dr = t.retning - figur.rotation.y;
  dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  figur.rotation.y += kamera.modus === 'bak' && !t.vei.length ? dr : dr * Math.min(1, dt * 10);
  t.gange = beveger ? t.gange + dt * 7.5 * (t.fart / 1.4) * (løper > 1 ? 1.3 : 1) * Math.max(0.55, t.vei.length ? t.tempo : 1) : t.gange * 0.85;
  gangPose(t.gange, beveger, t.pos.y);
  t.beveger = beveger;
  // fremme ved en planlagt handling: start den
  if (t.planlagt && !t.vei.length) { const id = t.planlagt; t.planlagt = null; startHandling(id); }
  if (t.handling) poseHandling(dt);
  blandOvergang(dt);
  oppdaterVask(dt);
  ring.material.opacity = Math.max(0, ring.material.opacity - dt * (t.vei.length ? 0.2 : 1.2));
  if (beveger && t.visEtasje !== t.f) visEtasje(t.f);                // figuren går: vis etasjen den er i
  oppdaterRom();
}

// Kameraet: 'ovenfra' svever over figuren (dra for å snu), 'bak' henger bak og over figuren som
// i GTA og trekker seg inn foran vegger og møbler som ville skjult den.
const kamera = { dreiing: 0, helning: 0, sistDra: 0, modus: mobil ? 'ovenfra' : 'bak', avstand: 3.2, blikk: new THREE.Vector3() };
const fokus = new THREE.Vector3(), ønsket = new THREE.Vector3(), hode = new THREE.Vector3();
const hindre = [], glassFlater = [];
function settKamera(modus) {
  kamera.modus = modus;
  knapp('bak').classList.toggle('på', modus === 'bak');
  controls.enabled = modus === 'ovenfra';
  if (modus === 'ovenfra') {
    visAltIgjen();
    settLave(true);
    const p = tilstand.pos;
    camera.position.set(p.x + 5.5, base(tilstand.visEtasje) + 8.5, p.z - 6.5);
    controls.target.set(p.x, base(tilstand.visEtasje) + 0.9, p.z);
    controls.update();
  } else {
    settLave(false);
    kamera.blikk.set(tilstand.pos.x, tilstand.pos.y + 1.3, tilstand.pos.z);
    følg(0, true);
  }
}
renderer.domElement.addEventListener('wheel', e => {
  if (kamera.modus === 'bak') kamera.avstand = Math.min(6, Math.max(1.6, kamera.avstand * (e.deltaY > 0 ? 1.1 : 0.9)));
}, { passive: true });
const kameraStråle = new THREE.Raycaster();
function følg(dt, hopp = false) {
  const t = tilstand;
  if (kamera.modus === 'fri') return;                                     // styres utenfra (test/opptak)
  if (kamera.modus === 'ovenfra') {
    fokus.set(t.pos.x, base(t.visEtasje) + 0.9, t.pos.z);
    const flytt = hopp ? 1 : Math.min(1, dt * 4);
    const d = new THREE.Vector3().subVectors(fokus, controls.target).multiplyScalar(flytt);
    controls.target.add(d); camera.position.add(d);
    return;
  }
  const r = figur.rotation.y, a = kamera.avstand;
  // fugleperspektiv bak figuren; vegger, dører og møbler som står mellom kameraet og figuren
  // skjules mens de er i veien (som når veggene klippes bort i Sims). Under en handling glir kameraet
  // over til en egen vinkel (fra siden, forfra eller skrått bakfra), på den siden der det er mest plass.
  const h = t.handling && !overgang && HANDLINGER[t.handling.id], vinkel = h?.kamera && KAMERAVINKEL[h.kamera];
  const kropp = kroppspunkter();
  let mål;
  if (vinkel) {
    mål = kropp.bryst.clone().lerp(kropp.hode, 0.35);
    const høyde = h.holdning === 'ligg' ? 1.25 : vinkel.h, avst = h.holdning === 'ligg' ? 2.1 : vinkel.d;
    t.handling.kameraSide ??= vinkel.side ?? velgSide(mål, r, vinkel.v, avst, høyde);   // fast side, eller der det er mest plass
    const v = r + vinkel.v * t.handling.kameraSide + kamera.dreiing;
    ønsket.set(mål.x + Math.sin(v) * avst, mål.y + Math.max(-0.6, høyde + kamera.helning), mål.z + Math.cos(v) * avst);
  } else {
    const rc = r + kamera.dreiing;                                         // dreid med musa; blikket går gjennom figuren
    ønsket.set(t.pos.x - Math.sin(rc) * a, t.pos.y + Math.max(0.4, 1.6 + a * 0.3 + kamera.helning), t.pos.z - Math.cos(rc) * a);
    mål = new THREE.Vector3(t.pos.x + Math.sin(rc) * 1.0, t.pos.y + 1.0, t.pos.z + Math.cos(rc) * 1.0);
  }
  const k = hopp ? 1 : Math.min(1, dt * (vinkel || kamera.fraVinkel > 0 ? 2.5 : 6));    // gli rolig inn i og ut av vinkelen
  kamera.fraVinkel = vinkel ? 1.2 : Math.max(0, (kamera.fraVinkel || 0) - dt);
  // når figuren går og man ikke har dratt på en stund, glir kameraet tilbake bak figuren
  if (t.beveger && performance.now() - kamera.sistDra > 1500) { const d = Math.min(1, dt * 1.5); kamera.dreiing -= Math.atan2(Math.sin(kamera.dreiing), Math.cos(kamera.dreiing)) * d; kamera.helning *= 1 - d; }
  camera.position.lerp(ønsket, k);
  kamera.blikk.lerp(mål, k);
  camera.lookAt(kamera.blikk);
  // Et rutenett av stråler fra kameraet dekker hele omrisset av figuren (fra føttene til over hodet, og
  // skulderbredden ut på hver side). Alt som en stråle treffer før den når figuren, skjules: vegger, møbler,
  // trappetrinn, rekkverk og glass. Det som står ved siden av figuren, blir stående. Bilder og annet som
  // henger på en skjult vegg, skjules sammen med den. Det som skjules, holdes skjult et øyeblikk etterpå,
  // så det ikke blinker.
  figur.updateMatrixWorld(true);
  const nå = performance.now(), sideveis = new THREE.Vector3().subVectors(kamera.blikk, camera.position).setY(0).cross(camera.up).normalize();
  const punkter = [];
  if (vinkel) {                                                            // under en handling: bare overkroppen
    const fra = kropp.bryst.y - 0.2, til = kropp.hode.y + 0.14;
    for (let i = 0; i < 4; i++) for (const u of [-0.24, -0.12, 0, 0.12, 0.24]) {
      const p = kropp.bryst.clone().lerp(kropp.hode, i / 3); p.y = fra + (til - fra) * i / 3;
      punkter.push(p.addScaledVector(sideveis, u));
    }
  } else {
    const fs = figur.scale.y;
    for (const h of [0.15, 0.45, 0.75, 1.05, 1.35, 1.6, 1.85]) for (const u of [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36])
      punkter.push(new THREE.Vector3(t.pos.x, t.pos.y + h * fs, t.pos.z).addScaledVector(sideveis, u * (h > 1.65 ? 0.6 : 1)));
  }
  // bare det som ligger i området mellom kameraet og figuren er aktuelt
  const område = new THREE.Box3().setFromPoints([camera.position, ...punkter]).expandByScalar(0.3);
  const kandidater = [];
  for (const o of hindreOgGlass) if (synlig(o, true) && område.intersectsBox(boksFor(o))) kandidater.push(o);
  const skjul = o => {
    if (!(o.visible || toning(o))) return;                                // skjult av spillet ellers (ikke av kameraet)
    skjultTil.set(o, nå + 350);
    for (const b of påVegg.get(o) ?? []) skjultTil.set(b, nå + 350);      // bilder på veggen
  };
  for (const m of punkter) {
    const retning = new THREE.Vector3().subVectors(m, camera.position), lengde = retning.length();
    kameraStråle.set(camera.position, retning.normalize()); kameraStråle.far = lengde - 0.22;
    for (const treff of kameraStråle.intersectObjects(kandidater, false)) skjul(treff.object);
  }
  for (const o of kandidater) {
    const b = boksFor(o);
    if (o.material.clippingPlanes && b.clone().expandByScalar(0.06).containsPoint(camera.position)) skjul(o);   // kameraet står inni veggen
    else if (!vinkel && b.min.y > t.pos.y + 2.0 && b.min.y < camera.position.y) skjul(o);   // trinn og bjelker over hodet, mellom kameraet og figuren
  }
  // tone bort det som er i veien, og tilbake det som ikke lenger er det
  const bort = new Set();
  for (const [o, til] of skjultTil) if (til > nå) bort.add(o); else skjultTil.delete(o);
  toneHvert(bort, hopp ? 1 : dt);
}
// bokser i verden for alt som kan stå i veien (beregnes én gang; huset står stille)
const bokser = new Map(), hindreOgGlass = [], påVegg = new Map();
const boksFor = o => {
  let b = bokser.get(o);
  if (!b || o.userData.dør) { b = new THREE.Box3().setFromObject(o); bokser.set(o, b); }   // dørene beveger seg
  return b;
};

// klokka og lyset: sola flyttes noen ganger i sekundet, lampene følger figuren hvert bilde
let dagTid = 1;
function dagTikk(dt) {
  if ((dagTid += dt) > 0.25) { dagTid = 0; dag.oppdater(); knapp('klokke').textContent = dag.tekst(); }
  musikk.oppdater(camera, tilstand.visEtasje);
  lys.oppdater(dag.tilstand.dagslys, tilstand.visEtasje, tilstand.pos, vis.lave ? tilstand.visEtasje * F + 1.1 : Infinity);
}
knapp('klokke').onclick = () => { dag.nesteModus(); knapp('klokke').textContent = dag.tekst(); knapp('klokke').title = `Klokka: ${dag.modus.navn}. Trykk for å bytte.`; visBeskjed(`🕗 ${dag.modus.navn}`); };
// nærmeste gangbare plass (innenfor ca. 60 cm) der figuren kan stå
function plassVed(f, x, z) {
  const [ci, cj] = celle(x, z);
  for (let r = 0; r <= 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++)
    if ((Math.abs(di) === r || Math.abs(dj) === r) && gangbar(f, ci + di, cj + dj)) return [x + di * R, z + dj * R];
  return null;
}
// musikkanleggene: lydplanke under TV-en i stua (1. etasje) og høyttalerne på kontoret; figuren går bort og bytter musikk
const ANLEGG = [
  { id: 'stue', navn: 'stua', i: 'i stua', f: 0, punkt: new THREE.Vector3(4.99, 0.88, 1.90), står: [4.45, 1.90], langsZ: true },
  { id: 'kontor', navn: 'kontoret', i: 'på kontoret', f: 2, punkt: new THREE.Vector3(2.67, base(2) + 0.92, 9.30), står: [2.2, 9.1] },
].map(a => ({ ...a, stasjon: 0 }));
let musikk = null;
function lagAnlegg() {
  const svart = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.5 });
  for (const a of ANLEGG) {
    if (a.langsZ) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.8), svart); m.position.copy(a.punkt); m.castShadow = true; scene.add(m); }   // lydplanke på veggen under TV-en
    a.led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x36ff8a, emissiveIntensity: 0 }));
    a.led.position.copy(a.punkt).add(a.langsZ ? new THREE.Vector3(-0.046, 0, 0.3) : new THREE.Vector3(-0.05, 0.12, 0)); scene.add(a.led);
    const st = plassVed(a.f, ...a.står);
    if (!st) continue;
    const retning = Math.atan2(a.punkt.x - st[0], a.punkt.z - st[1]);
    HANDLINGER[`musikk-${a.id}`] = {
      get navn() { return a.stasjon ? `Bytt musikk (nå: ${musikk.stasjon(a).navn})` : 'Skru på musikk'; }, rom: a.navn, ikon: '🎵', lys: true,
      f: a.f, gå: st, pos: st, retning, holdning: 'stå', varighet: 0.9, gjenta: false,
      ikonPunkt: a.punkt.clone().add(new THREE.Vector3(0, 0.55, 0)), tilstand: () => a.stasjon,
      armer: tt => {
        const inn = Math.sin(Math.min(1, tt / 0.8) * π);
        rekkMot(armV, fot().add(new THREE.Vector3(0, 1.0, 0)).lerp(a.punkt, inn));
        if (lokal() && tt > 0.4 && !tilstand.handling.trykket) { tilstand.handling.trykket = true; byttMusikk(a); }
      },
    };
  }
  musikk = lagMusikk({ anlegg: ANLEGG });
}
async function byttMusikk(a) {
  const st = await musikk.neste(a);
  visBeskjed(st.id === 'av' ? `🎵 Musikken ${a.i} er av` : `🎵 ${st.navn} ${a.i}`);
  knapp('musikk').classList.toggle('på', ANLEGG.some(x => x.stasjon));
}
// musikknappen nede til høyre: bytter på anlegget nærmest figuren (helst i samme etasje)
knapp('musikk').onclick = () => {
  const a = [...ANLEGG].sort((x, y) => (Math.abs(x.f - tilstand.f) * 20 + x.punkt.distanceTo(tilstand.pos)) - (Math.abs(y.f - tilstand.f) * 20 + y.punkt.distanceTo(tilstand.pos)))[0];
  byttMusikk(a);
};
// lysbryterne er handlinger: figuren går bort til bryteren og trykker på den
function leggTilBrytere() {
  for (const b of lys.brytere) {
    const st = plassVed(b.f, ...b.står);                                   // stå foran bryteren, vendt mot den
    if (!st) { console.warn('Ingen plass ved bryteren', b.rom); continue; }
    b.står = st; b.retning = Math.atan2(b.punkt.x - st[0], b.punkt.z - st[1]);
    const id = `lys-${b.rom}`, trykk = b.punkt.clone().add(new THREE.Vector3(Math.sin(b.retning) * -0.02, 0, Math.cos(b.retning) * -0.02));
    HANDLINGER[id] = {
      get navn() { return `${lys.erPå(b.rom) ? 'Slå av' : 'Slå på'} lyset`; }, rom: b.navn, ikon: '💡', lys: true,
      f: b.f, gå: b.står, pos: b.står, retning: b.retning, holdning: 'stå', varighet: 0.9, gjenta: false,
      ikonPunkt: b.punkt.clone().add(new THREE.Vector3(0, 0.4, 0)), tilstand: () => lys.erPå(b.rom),
      armer: tt => {
        const inn = Math.sin(Math.min(1, tt / 0.8) * π);                     // hånda fram til bryteren og tilbake
        rekkMot(armV, fot().add(new THREE.Vector3(0, 1.0, 0)).lerp(trykk, inn));
        if (lokal() && tt > 0.4 && !tilstand.handling.trykket) { tilstand.handling.trykket = true; lys.vipp(b.rom); }
      },
    };
  }
}
// kort beskjed nederst på skjermen
let beskjedTid = 0;
function visBeskjed(tekst) {
  const el = knapp('beskjed'); el.textContent = tekst; el.classList.add('vis');
  clearTimeout(beskjedTid); beskjedTid = setTimeout(() => el.classList.remove('vis'), 2200);
}

// dører åpnes for figuren og for andre spillere i nærheten
const dørerTikk = dt => oppdaterDører(dt, [{ f: tilstand.f, p: tilstand.pos }, ...[...andre.values()].map(a => ({ f: a.data.f, p: a.pos }))]);
function forberedKamera() {
  hindreOgGlass.push(...hindre, ...glassFlater);
  // bilder og andre tynne ting som henger på en vegg, hører til veggen
  const vegger = hindre.filter(o => o.material.clippingPlanes);
  for (const o of hindre) {
    const b = boksFor(o), str = b.getSize(new THREE.Vector3());
    if (o.material.clippingPlanes || Math.min(str.x, str.z) > 0.06 || str.y < 0.2 || str.y > 2) continue;
    for (const v of vegger) if (boksFor(v).distanceToPoint(b.getCenter(new THREE.Vector3())) < 0.1) { if (!påVegg.has(v)) påVegg.set(v, []); påVegg.get(v).push(o); }
  }
}
const skjultTil = new Map();
const KAMERAVINKEL = { høyre: { v: Math.PI / 2, d: 2.4, h: 0.55, side: -1 }, side: { v: Math.PI / 2, d: 2.4, h: 0.55 }, front: { v: 0.4, d: 2.3, h: 0.45 }, skrå: { v: Math.PI - 0.65, d: 2.5, h: 0.75 } };
// hode, bryst og hofter i verden (3D-modellens knokler hvis den finnes, ellers den tegnede figuren)
function kroppspunkter() {
  const av = meg.avatar?.rot, p = n => av?.getObjectByName(n)?.getWorldPosition(new THREE.Vector3());
  const hode = p('Head'), bryst = p('Spine2'), hofter = p('Hips');
  if (hode && bryst && hofter) return { hode, bryst, hofter };
  figur.updateMatrixWorld(true);
  return { hode: figur.localToWorld(new THREE.Vector3(0, 1.72, 0)), bryst: figur.localToWorld(new THREE.Vector3(0, 1.3, 0)), hofter: figur.localToWorld(new THREE.Vector3(0, 0.93, 0)) };
}
// velg siden (±) der kameraet står friest: lengst fri sikt fra figuren mot kameraplassen
function velgSide(mål, r, v, avst, høyde) {
  let best = 1, bestFri = -1;
  for (const s of [1, -1]) {
    const plass = new THREE.Vector3(mål.x + Math.sin(r + v * s) * avst, mål.y + høyde, mål.z + Math.cos(r + v * s) * avst);
    const ret = plass.clone().sub(mål), l = ret.length();
    kameraStråle.set(mål, ret.normalize()); kameraStråle.far = l;
    const treff = kameraStråle.intersectObjects(hindre, false).find(x => x.object.visible && synlig(x.object) && !(x.object.isMesh && figurdeler.has(x.object)));
    const fri = treff ? treff.distance : l + 1;
    if (fri > bestFri + 0.05) { best = s; bestFri = fri; }
  }
  return best;
}
let himmel = null, dag = null, lys = null;
const høye = [];
function visAltIgjen() { visAlt(); skjultTil.clear(); }
const synlig = (o, ignorerEgen = false) => { for (let p = ignorerEgen ? o.parent : o; p; p = p.parent) if (!p.visible) return false; return true; };

// ---------- Start ----------
requestAnimationFrame(() => setTimeout(() => {
  figur.traverse(o => figurdeler.add(o));                                 // også det figuren holder
  byggKart(figurdeler);
  åpneTrappeender();
  vis.lave = true;
  visEtasje(0);
  tilstand.pos.y = høydeVed(0, tilstand.pos.x, tilstand.pos.z) || 0;
  camera.position.set(tilstand.pos.x + 5.5, 8.5, tilstand.pos.z - 6.5);
  controls.target.set(tilstand.pos.x, 0.9, tilstand.pos.z);
  controls.update();
  lagDører();
  finnTing();
  const holdesAlene = new Set();                                         // grupper spillet flytter eller skjuler hver for seg
  for (const g of [kontorstol, stativGitar]) g?.traverse(o => holdesAlene.add(o));
  const ytelse = slåSammen(scene, husDeler, o => figurdeler.has(o) || holdesAlene.has(o));
  console.info('Slått sammen', ytelse.før, 'deler til', ytelse.etter);
  scene.traverse(o => { if (o.isMesh && !o.material.transparent && !figurdeler.has(o) && o !== ring) hindre.push(o); });
  scene.traverse(o => { if (o.isMesh && o.material.transparent && o.material.opacity < 0.9 && !figurdeler.has(o) && o !== ring) glassFlater.push(o); });
  forberedKamera();
  himmel = lagHimmel(scene, sol, midt);                                 // sol, skyer og fly med banner (etter gangkartet)
  dag = lagDag({ scene, sol, himmel, midt }); dag.oppdater();            // klokka: sola, himmelen og lyset ute
  lys = lagLys({ mobil });                                               // lamper og brytere
  leggTilBrytere();
  lagAnlegg();
  for (const o of hindre) {                                               // vegger, dører og høye skap (faste bokser)
    const b = new THREE.Box3().setFromObject(o);
    const tynn = Math.min(b.max.x - b.min.x, b.max.z - b.min.z) < 0.06 && b.max.y - b.min.y > 0.3;   // bilder og annet på veggene
    if ((o.material.clippingPlanes || tynn || b.max.y - b.min.y > 1.3) && b.max.y - b.min.y < 3.5) høye.push({ o, b, grense: tynn ? 0.35 : 0.06 });   // også bjelker over dører
  }
  settKamera(kamera.modus);
  oppdaterKnapper();
  husFerdig(1);
  nårFerdig(() => { const l = knapp('laster'); if (!l) return; l.classList.add('borte'); setTimeout(() => l.remove(), 450); });
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, klokke.getDelta());
    steg(dt); animerMeg(dt); tegnAndre(dt); dørerTikk(dt); flerTikk(dt); følg(dt); if (kamera.modus !== 'bak') controls.update();
    himmel?.oppdater(dt, camera); dagTikk(dt); plasserLapper(); plasserIkoner(); følgYtelse(); if (sol.intensity > 0) skyggeTikk();
    if (ao.enabled) composer.render(); else renderer.render(scene, camera);   // uten skyggeeffekten: rett til skjermen, med kantutjevning
  });
}, 30));

// ---------- Flerspiller ----------
// Innlogging og sanntid via Firebase (flerspiller.js, firebase-config.js). Andre spillere vises med sin
// egen figur og navn over hodet; posisjon, retning, etasje og handling sendes ca. 8 ganger i sekundet.
const andre = new Map();                                                 // uid → { rigg, lapp, data, pos, mottatt }
let fler = null, bruker = null, iHuset = false, sistSendt = '', sendTid = 0, lytter = false;
const lagretNavn = (() => { try { return localStorage.getItem('huldervegen-navn') || ''; } catch { return ''; } })();
const mittNavn = () => (knapp('u-navn').value.trim() || bruker?.navn || 'Gjest').slice(0, 20);
function opptatt(id) {
  for (const a of andre.values()) if (a.data.h === id && performance.now() - a.mottatt < 30000) return true;
  return false;
}
function byttUtseende(u) {
  settUtseende(meg, u);
  try { localStorage.setItem('huldervegen-utseende', JSON.stringify(meg.utseende)); } catch {}
  if (iHuset) fler.send({ utseende: meg.utseende });
  if (bruker) fler.lagreProfil(bruker.uid, { navn: mittNavn(), utseende: meg.utseende }).catch(() => {});
  fyllSkjema();
}
// navnelapp over hodet: en HTML-lapp som følger hodet på skjermen (skarp, og uten skyggeeffekten)
function navnelapp() {
  const el = document.createElement('div'); el.className = 'navnelapp';
  el.innerHTML = '<i></i><span></span>'; document.body.appendChild(el);
  return {
    el, synlig: false, position: new THREE.Vector3(),
    skriv(t, f) { el.querySelector('span').textContent = t; el.querySelector('i').style.background = f; },
  };
}
function håndterSpiller(hva, uid, d) {
  if (uid === bruker?.uid) return;
  let a = andre.get(uid);
  if (hva === 'borte' || !d) {
    if (a) { scene.remove(a.rigg.figur, a.rigg.gitar); a.lapp.el.remove(); andre.delete(uid); oppdaterKnapper(); oppdaterOnline(); }
    return;
  }
  if (!a) {
    const r = lagFigur(d.utseende || {}); giHåndting(r); scene.add(r.figur); r.figur.traverse(o => figurdeler.add(o));
    const lapp = navnelapp();
    a = { rigg: r, lapp, data: {}, pos: new THREE.Vector3(d.x, d.y, d.z), r: d.r || 0, uj: '', navn: '' };
    r.fot = a.pos;                                                         // (se fot)
    andre.set(uid, a);
  }
  const uj = JSON.stringify(d.utseende || {});
  if (uj !== a.uj) { settUtseende(a.rigg, d.utseende || {}); a.uj = uj; a.navn = ''; }
  if (d.navn !== a.navn) { a.navn = d.navn; a.lapp.skriv(d.navn || '?', a.rigg.utseende.skjorte); oppdaterOnline(); }
  const nyHandling = a.data.h !== d.h, nyEtasje = a.data.f !== d.f;
  a.data = d; a.mottatt = performance.now();
  if (nyHandling) oppdaterKnapper();
  if (nyEtasje || nyHandling) oppdaterOnline();
}
// hva andre spillere holder i hånda under handlingene (kaffekoppen først når kaffen er ferdig)
const TING_I_HÅNDA = { middag: ['gaffel'], ute: ['glass'], takterrasse: ['glass'], tenner: ['tannbørste'], steke: ['stekespade'], kaffe: ['koppHånd'] };
function tegnAndre(dt) {
  const nå = performance.now();
  for (const a of andre.values()) {
    const d = a.data, r = a.rigg, f = r.figur;
    const synlig = d.f <= tilstand.visEtasje && nå - a.mottatt < 30000;   // ikke i etasjer over den som vises
    f.visible = a.lapp.synlig = synlig;
    if (!synlig) { a.lapp.el.style.display = 'none'; continue; }
    // glid mot siste kjente posisjon og retning
    const mål = new THREE.Vector3(d.x, d.y, d.z);
    const flytt = a.pos.distanceTo(mål) > 3 ? 1 : Math.min(1, dt * 10);
    const gammel = a.pos.clone(); a.pos.lerp(mål, flytt);
    const fart = dt > 0 ? gammel.distanceTo(a.pos) / dt : 0;
    let dr = (d.r || 0) - a.r; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); a.r += dr * Math.min(1, dt * 10);
    f.position.copy(a.pos); f.rotation.y = a.r;
    for (const j of r.jakke) j.visible = !!d.j;
    const h = d.h && HANDLINGER[d.h], tt = (d.ht || 0) + (nå - a.mottatt) / 1000;
    // tingene i hånda og gitaren, som for egen figur (der handlingens før/etter viser dem)
    const iHånda = TING_I_HÅNDA[d.h] ?? [];
    for (const [navn, o] of Object.entries(r.ting)) o.visible = iHånda.includes(navn) && !(navn === 'koppHånd' && tt < 6);
    r.gitar.visible = d.h === 'gitar';
    medRigg(r, () => {
      if (h) { f.position.set(d.x, d.y, d.z); f.rotation.y = d.r; posere(h, tt, d.y); }
      else {
        const går = !!d.b || fart > 0.3;
        r.gange = går ? r.gange + dt * 7.5 * Math.min(2, Math.max(0.6, fart / 1.4)) : r.gange * 0.85;
        gangPose(r.gange, går, a.pos.y);
      }
    });
    const valg = velgKlipp(d.h, !!d.b || fart > 0.3, fart, fart > 2.6);
    valg.y = d.h ? d.y : a.pos.y;
    valg.ferdig = tt > 2;                                                  // kom inn midt i handlingen: sitt eller ligg med en gang
    animer(r, valg, dt);
    etterAnimasjon(r);
    r.hodet.getWorldPosition(a.lapp.position); a.lapp.position.y += 0.2;
  }
}
// navnelappene plasseres etter kameraet er flyttet, rett før bildet tegnes
function plasserLapper() {
  for (const a of andre.values()) {
    const l = a.lapp, p = l.position.clone().project(camera);
    const inne = l.synlig && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
    l.el.style.display = inne ? '' : 'none';
    if (inne) l.el.style.transform = `translate(${(p.x + 1) / 2 * innerWidth}px, ${(1 - p.y) / 2 * innerHeight}px) translate(-50%, -100%)`;
  }
}
const rund = x => Math.round(x * 100) / 100;
function flerTikk(dt) {
  if (!iHuset) return;
  const t = tilstand;
  const d = { f: t.f, x: rund(t.pos.x), y: rund(t.pos.y), z: rund(t.pos.z), r: rund(figur.rotation.y), h: t.handling?.id ?? null, b: t.beveger ? 1 : 0, j: harJakke() ? 1 : 0 };
  const nøkkel = JSON.stringify(d);
  sendTid += dt;
  if ((nøkkel !== sistSendt && sendTid > 0.12) || sendTid > 4) {     // ved endring, og hvert 4. sekund
    d.ht = t.handling ? rund(t.handling.tid) : 0;
    fler.send(d); sistSendt = nøkkel; sendTid = 0;
  }
}
// liste over hvem som er i huset, øverst til høyre
function oppdaterOnline() {
  const el = knapp('online');
  el.hidden = !iHuset; document.body.classList.toggle('innlogget', iHuset);
  if (!iHuset) return;
  const etg = f => `${f + 1}. etg`;
  const rad = (navn, farge, d) => `<span><i style="background:${farge}"></i>${navn.replace(/[<&]/g, '')} · ${etg(d.f)}${d.h && HANDLINGER[d.h] ? ' · ' + HANDLINGER[d.h].ikon : ''}</span>`;
  el.innerHTML = `<b>I huset nå (${andre.size + 1})</b>` + rad(mittNavn() + ' (deg)', meg.utseende.skjorte, { f: tilstand.f, h: tilstand.handling?.id })
    + [...andre.values()].map(a => rad(a.navn || '?', a.rigg.utseende.skjorte, a.data)).join('');
}
setInterval(() => iHuset && oppdaterOnline(), 1500);
setInterval(() => { if (iHuset && document.hidden) flerTikk(5); }, 4000);   // livstegn også når fanen ligger i bakgrunnen
async function gåInnIHuset() {
  if (iHuset || !bruker) return;
  const t = tilstand;
  await fler.bliMed(bruker.uid, { navn: mittNavn(), utseende: meg.utseende, f: t.f, x: rund(t.pos.x), y: rund(t.pos.y), z: rund(t.pos.z), r: rund(figur.rotation.y), h: null, ht: 0, b: 0, j: harJakke() ? 1 : 0 });
  iHuset = true; sistSendt = '';
  if (!lytter) { lytter = true; fler.lytt(håndterSpiller); }
  oppdaterOnline();
}

// skjemaet for innlogging og egen figur
const SKJEMA = ['hud', 'hår', 'skjorte', 'bukse', 'sko', 'frisyre', 'skjegg', 'høyde', 'kropp', 'modell'];
for (const [navn, u] of Object.entries(FERDIGE)) {                       // knapper for de ferdige figurene
  const b = document.createElement('button'); b.textContent = navn;
  b.onclick = () => {
    byttUtseende(u);
    knapp('u-navn').value = navn; knapp('u-navn').dispatchEvent(new Event('change'));
  };
  knapp('ferdige').appendChild(b);
}
function fyllSkjema() {
  const u = meg.utseende;
  for (const k of SKJEMA) knapp('u-' + k).value = k === 'høyde' ? Math.round(u.høyde * 100) : (u[k] ?? '');
  knapp('u-høyde-tekst').textContent = `${Math.round(u.høyde * 100)} cm`;
}
const lesSkjema = () => Object.fromEntries(SKJEMA.map(k => [k, k === 'høyde' ? knapp('u-høyde').value / 100 : knapp('u-' + k).value]));
for (const k of SKJEMA) knapp('u-' + k).addEventListener('input', () => byttUtseende(lesSkjema()));
knapp('u-navn').value = lagretNavn;
knapp('u-navn').addEventListener('change', () => {
  try { localStorage.setItem('huldervegen-navn', knapp('u-navn').value.trim()); } catch {}
  if (iHuset) fler.send({ navn: mittNavn() });
  if (bruker) fler.lagreProfil(bruker.uid, { navn: mittNavn(), utseende: meg.utseende }).catch(() => {});
  oppdaterOnline();
});
knapp('u-tilfeldig').onclick = () => {
  const velg = a => a[Math.floor(Math.random() * a.length)];
  byttUtseende({
    hud: velg(['#f3d2bd', '#e3b79b', '#c99472', '#a8714f', '#7a4b31', '#4f3022']),
    hår: velg(['#1d1510', '#3f2a1d', '#6b4528', '#a8763e', '#d9b56c', '#8c8c8c', '#b5432a']),
    skjorte: velg(['#1f5a56', '#8a1e2d', '#2c3f6b', '#d9d4c7', '#3d3d3d', '#6b7a3a', '#e0a526', '#7b4d9e']),
    bukse: velg(['#2b3448', '#1c1c1c', '#5a4a3a', '#8a8f96', '#3b5170']),
    sko: velg(['#f2f0ea', '#1c1c1c', '#7a5236', '#c23b2f']),
    frisyre: velg(['kort', 'kort', 'langt', 'langt', 'skallet']), skjegg: velg(['ingen', 'ingen', 'stubb', 'skjegg']),
    høyde: 1.55 + Math.round(Math.random() * 35) / 100, kropp: velg(['mann', 'kvinne']),
  });
};
knapp('u-standard').onclick = () => byttUtseende(STANDARD_FIGUR);
knapp('flerknapp').onclick = () => { fyllSkjema(); knapp('fler').hidden = false; };
knapp('fler-lukk').onclick = () => { knapp('fler').hidden = true; };
knapp('fler').addEventListener('pointerdown', e => { if (e.target === knapp('fler')) knapp('fler').hidden = true; });
const FEIL = {
  'auth/invalid-credential': 'Feil brukernavn eller passord.', 'auth/wrong-password': 'Feil passord.', 'auth/user-not-found': 'Finner ingen bruker med det navnet.',
  'auth/invalid-email': 'Brukernavnet må ha minst 2 bokstaver eller tall.', 'auth/email-already-in-use': 'Brukernavnet er opptatt – velg et annet, eller logg inn hvis det er ditt.',
  'auth/weak-password': 'Passordet må ha minst 6 tegn.', 'auth/missing-password': 'Skriv inn et passord.',
  'auth/popup-closed-by-user': 'Innloggingsvinduet ble lukket.', 'auth/popup-blocked': 'Nettleseren blokkerte innloggingsvinduet.',
  'auth/unauthorized-domain': 'Dette domenet er ikke godkjent i Firebase ennå (se FLERSPILLER.md).',
  'auth/operation-not-allowed': 'Denne innloggingsmåten er ikke slått på i Firebase (se FLERSPILLER.md).',
};
const prøv = async fn => {
  knapp('fler-feil').textContent = '';
  try { await fn(); } catch (e) { knapp('fler-feil').textContent = FEIL[e.code] || `Noe gikk galt: ${e.code || e.message}`; }
};
knapp('google').onclick = () => prøv(() => fler.google());
knapp('logginn').onclick = () => prøv(() => fler.brukernavn(knapp('brukernavn').value, knapp('passord').value));
knapp('nykonto').onclick = () => prøv(() => {
  const n = knapp('brukernavn').value.trim();
  if (!knapp('u-navn').value.trim()) { knapp('u-navn').value = n.slice(0, 20); knapp('u-navn').dispatchEvent(new Event('change')); }   // navnet over hodet
  return fler.nyKonto(n, knapp('passord').value);
});
knapp('passord').addEventListener('keydown', e => { if (e.key === 'Enter') knapp('logginn').click(); });
knapp('loggut').onclick = () => prøv(() => fler.loggUt());
async function startFlerspiller() {
  if (!firebaseConfig) return;                                           // ikke satt opp: spill alene
  try { fler = await kobleTil(firebaseConfig); }
  catch (e) { knapp('fler-av').innerHTML = '<p>Kunne ikke koble til Firebase. Sjekk nettet og firebase-config.js.</p>'; return; }
  knapp('fler-av').hidden = true;
  knapp('flerknapp').textContent = '👥 Logg inn og spill med andre';
  fler.påBruker(async u => {
    bruker = u;
    knapp('fler-ut').hidden = !!u; knapp('fler-inne').hidden = !u;
    if (!u) {                                                             // logget ut: tøm huset for andre
      iHuset = false;
      for (const uid of [...andre.keys()]) håndterSpiller('borte', uid);
      knapp('flerknapp').textContent = '👥 Logg inn og spill med andre';
      oppdaterOnline();
      return;
    }
    knapp('megnavn').textContent = u.navn || 'deg';
    knapp('flerknapp').textContent = '👥 Min figur';
    const p = await fler.hentProfil(u.uid).catch(() => null);
    if (p?.utseende && 'modell' in p.utseende && !('modell' in lagretUtseende)) byttUtseende(p.utseende);    // ny maskin: hent figuren fra kontoen
    if (!knapp('u-navn').value.trim()) knapp('u-navn').value = (p?.navn || u.navn || '').slice(0, 20);
    await gåInnIHuset().catch(e => { knapp('fler-feil').textContent = `Kunne ikke gå inn i huset: ${e.code || e.message}`; });
  });
}
startFlerspiller();

// ---------- Mobil: meny, hurtigknapper, styrespak og automatisk kvalitet ----------
const panel = knapp('panel');
panel.classList.add('lukket');                                          // menyen er lagt sammen fra start (☰ åpner den)
knapp('meny').onclick = () => panel.classList.toggle('lukket');
for (const b of document.querySelectorAll('#hurtig [data-etg]')) b.onclick = () => visEtasje(+b.dataset.etg - 1);
knapp('hurtig-kamera').onclick = () => settKamera(kamera.modus === 'bak' ? 'ovenfra' : 'bak');
// styrespak: dra knotten; utslaget gir retning og fart (i forhold til kameraet)
const stikke = { x: 0, y: 0 }, stikkeEl = knapp('stikke'), knott = stikkeEl.querySelector('i');
let stikkeId = null;
const flyttStikke = e => {
  const r = stikkeEl.getBoundingClientRect(), R = r.width / 2;
  let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  const død = l < 0.15;                                                    // litt dødsone i midten
  stikke.x = død ? 0 : x; stikke.y = død ? 0 : y;
  knott.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
};
stikkeEl.addEventListener('pointerdown', e => { stikkeId = e.pointerId; stikkeEl.setPointerCapture(e.pointerId); flyttStikke(e); e.preventDefault(); });
stikkeEl.addEventListener('pointermove', e => { if (e.pointerId === stikkeId) flyttStikke(e); });
const slippStikke = e => { if (e.pointerId !== stikkeId) return; stikkeId = null; stikke.x = stikke.y = 0; knott.style.transform = ''; };
stikkeEl.addEventListener('pointerup', slippStikke); stikkeEl.addEventListener('pointercancel', slippStikke);
// automatisk kvalitet: går det jevnt under ca. 28 bilder i sekundet (to målinger på rad), skrus først
// skyggeeffekten av, så oppløsningen ned til 1 og til slutt skyggekvaliteten. Oppløsningen går aldri under 1
// (det ga et kornete bilde), og den skrus opp igjen når det går lett. Pauser (bakgrunnsfane, innlasting)
// starter målingen på nytt, så et enkelt hakk ikke gir dårligere bilde resten av økta.
const fullOppløsning = renderer.getPixelRatio();
const kvalitet = { nivå: 0, bilder: 0, fra: performance.now() + 6000, sist: 0, lave: 0, høye: 0, hevet: false, av: new URLSearchParams(location.search).has('hd') };
function følgYtelse() {
  const nå = performance.now();
  if (kvalitet.av || nå < kvalitet.fra) return;                        // la huset og figuren laste først
  if (document.hidden || nå - kvalitet.sist > 1000) { kvalitet.bilder = 0; kvalitet.fra = kvalitet.sist = nå; return; }
  kvalitet.sist = nå; kvalitet.bilder++;
  if (nå - kvalitet.fra < 3000) return;
  const fps = kvalitet.bilder / ((nå - kvalitet.fra) / 1000);
  kvalitet.bilder = 0; kvalitet.fra = nå;
  kvalitet.lave = fps < 28 ? kvalitet.lave + 1 : 0;
  kvalitet.høye = fps > 50 ? kvalitet.høye + 1 : 0;
  if (kvalitet.lave >= 2) {
    kvalitet.lave = 0;
    if (ao.enabled) ao.enabled = false;
    else if (renderer.getPixelRatio() > 1) renderer.setPixelRatio(1);
    else if (sol.shadow.mapSize.x > 512) { sol.shadow.mapSize.set(512, 512); sol.shadow.map?.dispose(); sol.shadow.map = null; }
    else return;
    kvalitet.nivå++;
    console.info('Lavere kvalitet for jevnere bilde:', fps.toFixed(0), 'bilder/s');
  } else if (kvalitet.høye >= 3 && !kvalitet.hevet && renderer.getPixelRatio() < fullOppløsning) {
    kvalitet.hevet = true;                                               // bare én gang, så det ikke vipper fram og tilbake
    renderer.setPixelRatio(fullOppløsning); kvalitet.nivå--;
    console.info('Høyere oppløsning igjen:', fps.toFixed(0), 'bilder/s');
  } else return;
  settStørrelse();
}

// for testing og opptak
window.spill = { dag: () => dag, lys: () => lys, musikk: () => musikk, ANLEGG, dører, oppdaterDører: dørerTikk, tegnAndre, glassFlater, skjultTil: () => skjultTil, høye: () => høye, himmel: () => himmel, animerMeg, stikke, ikoner, kvalitet, FERDIGE, andre, meg, byttUtseende, flerTikk, fler: () => fler, THREE, scene, camera, renderer, controls, composer, tilstand, gåTil, steg, følg, visEtasje, gangbar, celle, gulv, sperret, settKamera, taster, kamera, planlegg, stoppHandling, HANDLINGER };
