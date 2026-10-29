// Dører som åpner seg i spillet.
import * as THREE from 'three';
import { scene, M } from '../hus.js';
import { base } from './gangkart.js';

// I spillet svinger dørene opp på hengslene når noen nærmer seg døråpningen, og lukker seg igjen når de har
// gått forbi. Da går ingen gjennom en lukket dør, og åpne dører står ikke ute i rommene og i veien.
// Hver dør: dørbladets midtpunkt (for å finne det), hengselet, døråpningens midtpunkt og hvor mye bladet må
// dreies fra slik det står i modellen for å være lukket og åpent (radianer om loddrett akse).
const DØRER = [
  { f: 0, blad: [3.14, 7.74], hengsel: [3.14, 7.35], åpning: [3.50, 7.30], lukket: Math.PI / 2, åpen: 0 },           // stue | entré
  { f: 0, blad: [3.525, 9.80], hengsel: [3.17, 9.80], åpning: [3.525, 9.75], lukket: 0, åpen: Math.PI / 2, ytter: true },   // ytterdøra
  { f: 1, blad: [2.47, 4.37], hengsel: [2.85, 4.37], åpning: [2.90, 4.01], lukket: -Math.PI / 2, åpen: 0 },          // soverom 13
  { f: 1, blad: [3.10, 2.82], hengsel: [3.10, 3.20], åpning: [3.46, 3.25], lukket: -Math.PI / 2, åpen: 0 },          // soverom 7
  { f: 1, blad: [2.895, 5.73], hengsel: [2.915, 6.02], åpning: [2.90, 5.73], lukket: 0, åpen: -Math.PI / 2 },        // bad (slår ut i gangen)
  { f: 1, blad: [3.82, 7.665], hengsel: [3.82, 7.30], åpning: [3.47, 7.24], lukket: -Math.PI / 2, åpen: 0 },         // soverom 12
  { f: 2, blad: [1.15, 6.95], hengsel: [1.50, 6.95], åpning: [1.15, 6.95], lukket: 0, åpen: Math.PI / 2 },           // kontoret
  { f: 2, blad: [3.75, 7.705], hengsel: [3.75, 7.36], åpning: [3.42, 7.31], lukket: -Math.PI / 2, åpen: 0 },         // vaskerommet
];
const dører = [];
function lagDører() {
  const kandidater = [];
  scene.traverse(o => { if (o.isMesh && (o.material === M.hvitDør || o.material === M.ytterdør)) kandidater.push(o); });
  for (const d of DØRER) {
    const y0 = base(d.f), c = new THREE.Vector3();
    const blad = kandidater.find(o => { new THREE.Box3().setFromObject(o).getCenter(c); return Math.abs(c.x - d.blad[0]) < 0.06 && Math.abs(c.z - d.blad[1]) < 0.06 && c.y > y0 && c.y < y0 + 2; });
    if (!blad) { console.warn('Fant ikke dør', d); continue; }
    const hengsel = new THREE.Object3D(); hengsel.position.set(d.hengsel[0], 0, d.hengsel[1]);
    blad.parent.add(hengsel); hengsel.updateMatrixWorld(true); hengsel.attach(blad);
    blad.userData.dør = true;
    if (d.ytter) {                                                         // koøyet i ytterdøra følger med
      const øye = [];
      scene.traverse(o => { if (o.isMesh && o.geometry.type === 'CircleGeometry' && Math.abs(o.position.x - 3.525) < 0.01 && Math.abs(o.position.y - 1.5) < 0.01) øye.push(o); });
      for (const o of øye) { hengsel.attach(o); o.userData.dør = true; }
    }
    dører.push({ ...d, hengsel, vinkel: d.lukket, y0 });
    hengsel.rotation.y = d.lukket;
  }
}
// hvert bilde: dører med noen i nærheten åpnes, de andre lukkes. folk: [{ f: etasje, p: posisjon }]
function oppdaterDører(dt, folk) {
  for (const d of dører) {
    const nær = folk.some(({ f, p }) => f === d.f && Math.hypot(p.x - d.åpning[0], p.z - d.åpning[1]) < 1.25);
    const mål = nær ? d.åpen : d.lukket, diff = mål - d.vinkel;
    if (Math.abs(diff) < 1e-3) continue;
    d.vinkel += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.2);      // ca. et halvt sekund for å åpne
    d.hengsel.rotation.y = d.vinkel;
  }
}

export { dører, lagDører, oppdaterDører };
