// Figurene i spillet: den tegnede figuren (styreskjelett med ledd i skulder, albue, hofte og kne) og
// 3D-modellen (GLB med Mixamo-skjelett, f.eks. fra Avaturn) som følger styreskjelettet.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// alle deler av figurene (også 3D-modellene og det de holder): hoppes over av gangkartet og kamerastrålene
const figurdeler = new Set();
// spillet kobler seg på her: kalles når en 3D-modell er lastet og koblet til styreskjelettet
const figurHendelser = { nyModell: r => {} };

// ---------- Figurer ----------
// Hver figur bygges av lagFigur(utseende). Standard er mannen etter bildene: ca. 1,82 m, kort mørkebrunt
// hår med sideskill, lys hud, lett skjeggstubb, mørk turkisgrønn T-skjorte, mørk olabukse og hvite
// joggesko. Menneskelige proporsjoner (hodet ca. 1/8 av høyden), formet overkropp og ledd i skulder,
// albue, hofte og kne for en naturlig gange. Utseendet kan endres (farger, frisyre, skjegg og høyde).
const STANDARD_UTSEENDE = { hud: '#e3b79b', hår: '#3f2a1d', skjorte: '#1f5a56', bukse: '#2b3448', sko: '#f2f0ea', frisyre: 'kort', skjegg: 'stubb', høyde: 1.82, kropp: 'mann' };
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const profil = [[0.150, 0.92], [0.158, 0.98], [0.150, 1.05], [0.158, 1.15], [0.175, 1.28], [0.178, 1.38], [0.160, 1.45], [0.10, 1.50], [0.055, 1.52]]
  .map(([r, y]) => new THREE.Vector2(r, y));
function lagFigur(u = STANDARD_UTSEENDE) {
  const m = {
    hud: mat(0xe3b79b, 0.62), skjorte: mat(0x1f5a56, 0.92), bukse: mat(0x2b3448, 0.88), sko: mat(0xf2f0ea, 0.55), hår: mat(0x3f2a1d, 0.75),
    stubb: new THREE.MeshStandardMaterial({ color: 0x7a5c4a, roughness: 0.95, transparent: true, opacity: 0.16, depthWrite: false }),
  };
  const såle = mat(0xd8d2c6, 0.7), iris = mat(0x4a5560, 0.3), pupill = mat(0x101010, 0.2), hvitt = mat(0xf4f1ec, 0.35);
  const lepper = mat(0xb27a6c, 0.55), bryn = mat(0x3a281c, 0.8);
  const figur = new THREE.Group();
  const del = (geo, mt, x, y, z, foreldre = figur) => {
    const mesh = new THREE.Mesh(geo, mt); mesh.position.set(x, y, z);
    mesh.castShadow = true; foreldre.add(mesh); return mesh;
  };
  const ledd = (x, y, z, foreldre = figur) => { const g = new THREE.Group(); g.position.set(x, y, z); foreldre.add(g); return g; };
  // avsmalnende lem fra leddet og nedover (r1 øverst, r2 nederst)
  const lem = (r1, r2, l, mt, foreldre) => {
    del(new THREE.CylinderGeometry(r1, r2, l, 16), mt, 0, -l / 2, 0, foreldre);
    del(new THREE.SphereGeometry(r2, 14, 10), mt, 0, -l, 0, foreldre);
  };
  // overkropp: dreid profil (midje, bryst, skuldre) i T-skjorte, flatere forfra og bakfra
  const kropp = del(new THREE.LatheGeometry(profil, 28), m.skjorte, 0, 0, 0);
  kropp.scale.set(1.12, 1, 0.66);
  del(new THREE.CylinderGeometry(0.168, 0.165, 0.07, 28), m.bukse, 0, 0.92, 0).scale.set(1.12, 1, 0.68);   // linning
  del(new THREE.CylinderGeometry(0.046, 0.054, 0.10, 14), m.hud, 0, 1.56, 0.005);                       // hals
  const skuldre = [-1, 1].map(sx => del(new THREE.SphereGeometry(0.058, 16, 12), m.skjorte, sx * 0.185, 1.435, 0));   // skuldre
  for (const d of skuldre) d.scale.set(1, 0.75, 0.85);
  const linning = figur.children[1];
  // ben: hofte → lår → kne → legg → sko
  const ben = sx => {
    const hofte = ledd(sx * 0.088, 0.93, 0);
    lem(0.078, 0.058, 0.44, m.bukse, hofte);
    const kne = ledd(0, -0.44, 0, hofte);
    lem(0.056, 0.042, 0.42, m.bukse, kne);
    const fot = ledd(0, -0.43, 0, kne);
    del(new THREE.SphereGeometry(0.06, 14, 10), m.sko, 0, -0.03, 0.05, fot).scale.set(0.85, 0.6, 2.0);
    del(new THREE.BoxGeometry(0.095, 0.022, 0.27), såle, 0, -0.058, 0.05, fot);
    return { hofte, kne };
  };
  // armer: skulder → overarm med kort erme → albue → underarm → hånd med tommel
  const arm = sx => {
    const skulder = ledd(sx * 0.205, 1.43, 0);
    skulder.rotation.z = sx * 0.08;
    del(new THREE.CylinderGeometry(0.058, 0.054, 0.15, 14), m.skjorte, 0, -0.06, 0, skulder);   // erme
    lem(0.044, 0.037, 0.29, m.hud, skulder);
    const albue = ledd(0, -0.29, 0, skulder);
    lem(0.037, 0.028, 0.25, m.hud, albue);
    const hånd = ledd(0, -0.27, 0, albue);
    del(new RoundedBoxGeometry(0.03, 0.09, 0.07, 2, 0.013), m.hud, 0, -0.03, 0.005, hånd);
    del(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), m.hud, -sx * 0.012, -0.02, 0.04, hånd).rotation.x = 0.6;
    return { skulder, albue, hånd };
  };
  const benV = ben(-1), benH = ben(1), armV = arm(-1), armH = arm(1);
  // hode: hodeskalle og kjeve, ører, øyne med iris og pupill, bryn, nese, lepper og skjeggstubb
  const hodet = ledd(0, 1.70, 0.01);
  del(new THREE.SphereGeometry(0.1, 32, 24), m.hud, 0, 0.012, 0, hodet).scale.set(0.82, 1.08, 0.98);
  del(new THREE.SphereGeometry(0.07, 24, 16), m.hud, 0, -0.04, 0.008, hodet).scale.set(0.95, 0.85, 1.0);    // kjeve og hake
  const stubb = del(new THREE.SphereGeometry(0.0712, 24, 16, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.4), m.stubb, 0, -0.04, 0.009, hodet);
  stubb.scale.set(0.955, 0.86, 1.0);                                                                 // lett skjeggstubb
  const skjegg = del(new THREE.SphereGeometry(0.074, 24, 16, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.52, Math.PI * 0.45), m.hår, 0, -0.042, 0.008, hodet);
  skjegg.scale.set(0.97, 0.92, 1.03);                                                                // fullskjegg
  for (const sx of [-1, 1]) {
    del(new THREE.SphereGeometry(0.02, 12, 10), m.hud, sx * 0.083, 0.005, -0.008, hodet).scale.set(0.45, 1.15, 0.8);   // ører
    del(new THREE.SphereGeometry(0.0105, 14, 10), hvitt, sx * 0.031, 0.022, 0.084, hodet).scale.set(1.25, 0.75, 0.6);
    del(new THREE.SphereGeometry(0.0055, 12, 8), iris, sx * 0.031, 0.022, 0.0905, hodet);
    del(new THREE.SphereGeometry(0.0026, 8, 6), pupill, sx * 0.031, 0.022, 0.0955, hodet);
    const b = del(new THREE.BoxGeometry(0.03, 0.0055, 0.008), bryn, sx * 0.032, 0.041, 0.09, hodet);
    b.rotation.z = -sx * 0.12;
  }
  del(new THREE.SphereGeometry(0.012, 12, 10), m.hud, 0, -0.004, 0.093, hodet).scale.set(0.75, 1.7, 1.0);   // nese
  del(new THREE.SphereGeometry(0.01, 10, 8), m.hud, 0, -0.02, 0.096, hodet).scale.set(1.3, 0.75, 0.85);
  del(new RoundedBoxGeometry(0.032, 0.006, 0.008, 2, 0.0028), lepper, 0, -0.045, 0.082, hodet);         // munn
  // kort hår: tett kalott, litt mer volum på toppen med sideskill, kortere i nakken og ved ørene
  const kort = [
    del(new THREE.SphereGeometry(0.104, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.42), m.hår, 0, 0.016, -0.004, hodet),
    del(new THREE.SphereGeometry(0.102, 24, 14, Math.PI, Math.PI, Math.PI * 0.38, Math.PI * 0.27), m.hår, 0, 0.01, -0.006, hodet),
    del(new THREE.SphereGeometry(0.088, 24, 14), m.hår, 0.008, 0.083, 0.014, hodet),
  ];
  kort[0].scale.set(0.84, 1.1, 1.0); kort[1].scale.set(0.83, 1.09, 0.99);
  kort[2].scale.set(0.8, 0.22, 0.98); kort[2].rotation.z = -0.12;
  // langt hår: kalotten pluss hår som faller ned bak og på sidene til skuldrene
  const langt = [
    del(new THREE.SphereGeometry(0.108, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.45), m.hår, 0, 0.016, -0.004, hodet),
    del(new THREE.CylinderGeometry(0.098, 0.115, 0.26, 28, 1, true, Math.PI * 0.3, Math.PI * 1.4), m.hår, 0, -0.07, -0.012, hodet),
  ];
  langt[0].scale.set(0.86, 1.1, 1.02); langt[1].scale.set(0.9, 1, 0.92);
  langt[1].material = m.hår; langt[1].geometry.computeVertexNormals();
  // jakke til å gå ut: mørk vindjakke utenpå T-skjorta, med lange ermer og krage (skjult inne)
  const jakkeStoff = mat(0x23262b, 0.7), jakke = [];
  {
    const j = del(new THREE.LatheGeometry(profil.map(v => new THREE.Vector2(v.x + 0.012, v.y)), 28), jakkeStoff, 0, -0.02, 0);
    j.scale.set(1.12, 1, 0.70); jakke.push(j);
    jakke.push(del(new THREE.CylinderGeometry(0.06, 0.068, 0.07, 20), jakkeStoff, 0, 1.53, 0.0));   // krage
    for (const a of [armV, armH]) {
      jakke.push(del(new THREE.CylinderGeometry(0.062, 0.05, 0.31, 14), jakkeStoff, 0, -0.15, 0, a.skulder));
      jakke.push(del(new THREE.CylinderGeometry(0.048, 0.04, 0.23, 14), jakkeStoff, 0, -0.11, 0, a.albue));
    }
    for (const d of jakke) d.visible = false;
  }
  langt[1].material.side = THREE.DoubleSide;
  figur.traverse(o => { if (o.isMesh) o.userData.proxy = true; });       // den tegnede figuren (skjules bak en 3D-modell)
  figur.rotation.order = 'YXZ';
  const rigg = { figur, benV, benH, armV, armH, hodet, m, kort, langt, stubb, skjegg, jakke, kropp, skuldre, linning, gange: 0 };
  settUtseende(rigg, u);
  return rigg;
}
// ferdige figurer å velge mellom
const FERDIGE = {
  'Pablo Andrés': { ...STANDARD_UTSEENDE, modell: '' },
  'Pablo Andrés (3D)': { ...STANDARD_UTSEENDE, modell: 'figurer/pablo.glb', høyde: 1.85 },
  'Ingeridia': { hud: '#efc6ab', hår: '#9a6a3c', skjorte: '#c2577a', bukse: '#33415e', sko: '#f2f0ea', frisyre: 'langt', skjegg: 'ingen', høyde: 1.68, kropp: 'kvinne' },
};
function settUtseende(r, u) {
  u = { ...STANDARD_UTSEENDE, ...u };
  for (const k of ['hud', 'hår', 'skjorte', 'bukse', 'sko']) r.m[k].color.set(u[k]);
  r.m.stubb.color.set(u.hår).lerp(new THREE.Color(u.hud), 0.35);
  for (const d of r.kort) d.visible = u.frisyre === 'kort';
  for (const d of r.langt) d.visible = u.frisyre === 'langt';
  r.stubb.visible = u.skjegg === 'stubb';
  r.skjegg.visible = u.skjegg === 'skjegg';
  const s = Math.min(2.05, Math.max(1.4, +u.høyde || 1.82)) / 1.82;
  r.figur.scale.setScalar(s);
  // kvinnekropp: smalere skuldre og bryst, litt bredere hofter
  const kvinne = u.kropp === 'kvinne', sk = kvinne ? 0.165 : 0.185;
  r.kropp.scale.set(kvinne ? 1.0 : 1.12, 1, kvinne ? 0.70 : 0.66);
  r.linning.scale.set(kvinne ? 1.16 : 1.12, 1, kvinne ? 0.72 : 0.68);
  r.skuldre.forEach((d, i) => { d.position.x = (i ? 1 : -1) * sk; d.scale.set(kvinne ? 0.85 : 1, 0.75, 0.85); });
  for (const [a, sx] of [[r.armV, -1], [r.armH, 1]]) a.skulder.position.x = sx * (kvinne ? 0.183 : 0.205);
  for (const [b, sx] of [[r.benV, -1], [r.benH, 1]]) b.hofte.position.x = sx * (kvinne ? 0.092 : 0.088);
  r.jakke[0].scale.set(kvinne ? 1.0 : 1.12, 1, kvinne ? 0.74 : 0.70);
  r.utseende = u;
  if ((u.modell || null) !== (r.modellSti || null)) settModell(r, u.modell || null);
}

// ---------- 3D-modell (GLB fra Avaturn/Mixamo-skjelett) ----------
// Modellen henges inn i figurgruppa, og den vanlige figuren blir et usynlig «styreskjelett»: alle
// bevegelser (gange, trapp, handlinger) regnes ut på den som før, og hvert bilde overføres rotasjonene
// i hofter, knær, skuldre, albuer og hode til de tilsvarende knoklene i modellen.
const modellCache = new Map();
const lastModell = sti => {
  if (!modellCache.has(sti)) modellCache.set(sti, new GLTFLoader().loadAsync(sti));
  return modellCache.get(sti);
};
function proxySynlig(r, på) {
  r.figur.traverse(o => { if (o.isMesh && o.userData.proxy) o.layers.set(på ? 0 : 1); });   // lag 1 tegnes ikke
}
async function settModell(r, sti) {
  r.modellSti = sti;
  if (r.avatar) { r.figur.remove(r.avatar.rot); r.avatar = null; r.anim = null; proxySynlig(r, true); }
  if (!sti) return;
  proxySynlig(r, false);                                                   // ikke vis den tegnede figuren mens modellen lastes
  let gltf;
  try { gltf = await lastModell(sti); } catch (e) { console.warn('Kunne ikke laste', sti, e); if (r.modellSti === sti) proxySynlig(r, true); return; }
  if (r.modellSti !== sti) return;                                        // byttet igjen mens den lastet
  const rot = SkeletonUtils.clone(gltf.scene);
  rot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; figurdeler.add(o); } });
  // samme høyde som styreskjelettet (1,82 m før figurens egen skalering)
  const boks = new THREE.Box3().setFromObject(rot, true), h = boks.max.y - Math.min(0, boks.min.y);
  rot.scale.setScalar(1.82 / h);
  // hvilinger: styreskjelettet i grunnstilling, modellen i sin T-positur
  const lagret = [];
  for (const b of [r.benV, r.benH]) lagret.push([b.hofte.rotation.clone(), b.kne.rotation.clone()]);
  for (const a of [r.armV, r.armH]) lagret.push([a.skulder.rotation.clone(), a.albue.rotation.clone()]);
  const rx = r.figur.rotation.clone(), hr = r.hodet.rotation.clone();
  for (const b of [r.benV, r.benH]) { b.hofte.rotation.set(0, 0, 0); b.kne.rotation.set(0, 0, 0); }
  for (const [a, sx] of [[r.armV, -1], [r.armH, 1]]) { a.skulder.rotation.set(0, 0, sx * 0.08); a.albue.rotation.set(-0.1, 0, 0); }
  r.figur.rotation.set(0, 0, 0); r.hodet.rotation.set(0, 0, 0);
  r.figur.add(rot); r.figur.updateMatrixWorld(true);
  const relQ = o => r.figur.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  const relP = o => r.figur.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  // figuren ser mot +z; venstre side av figuren er +x
  const side = x => (x < 0 ? 'Right' : 'Left');
  const par = [];
  const legg = (ledd, navn, barn, rett) => {
    const ben = rot.getObjectByName(navn);
    if (!ben) return;
    let hvile = relQ(ben);
    if (rett) {                                                            // armene: fra T-positur til hengende
      const fra = relP(rot.getObjectByName(barn)).sub(relP(ben)).normalize();
      const til = relP(rett.barn).sub(relP(rett.ledd)).normalize();
      rett.q = new THREE.Quaternion().setFromUnitVectors(fra, til);
    }
    if (rett?.q) hvile = rett.q.clone().multiply(hvile);
    par.push({ ledd, ben, leddHvile: relQ(ledd), benHvile: hvile });
  };
  for (const b of [r.benV, r.benH]) {
    const sd = side(relP(b.hofte).x);
    legg(b.hofte, sd + 'UpLeg'); legg(b.kne, sd + 'Leg');
  }
  for (const a of [r.armV, r.armH]) {
    const sd = side(relP(a.skulder).x), rett = { ledd: a.skulder, barn: a.albue };
    legg(a.skulder, sd + 'Arm', sd + 'ForeArm', rett);
    const rett2 = { ledd: a.albue, barn: a.hånd };
    legg(a.albue, sd + 'ForeArm', sd + 'Hand', rett2);
  }
  legg(r.hodet, 'Head');
  // sett styreskjelettet tilbake slik det var
  r.figur.rotation.copy(rx); r.hodet.rotation.copy(hr);
  let i = 0;
  for (const b of [r.benV, r.benH]) { const [h1, k] = lagret[i++]; b.hofte.rotation.copy(h1); b.kne.rotation.copy(k); }
  for (const a of [r.armV, r.armH]) { const [sk, al] = lagret[i++]; a.skulder.rotation.copy(sk); a.albue.rotation.copy(al); }
  const rygg = rot.getObjectByName('Spine1');
  r.avatar = { rot, par, rygg, ryggHvile: rygg?.quaternion.clone() };
  proxySynlig(r, false);
  figurHendelser.nyModell(r);
}
// overfør styreskjelettets stilling til modellens knokler (kalles etter at stillingen er regnet ut)
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qF = new THREE.Quaternion(), Y_AKSE = new THREE.Vector3(0, 1, 0), X_AKSE = new THREE.Vector3(1, 0, 0);
function følgSkjelett(r, kunArmer = false) {
  if (!r.avatar) return;
  const { rygg, ryggHvile } = r.avatar;                                   // overkroppen vrir seg når figuren går
  if (rygg && !kunArmer) rygg.quaternion.copy(ryggHvile).multiply(qA.setFromAxisAngle(Y_AKSE, -(r.figur.userData.vri || 0)));
  r.figur.updateMatrixWorld(true);
  r.figur.getWorldQuaternion(qF); const fInv = qF.clone().invert();
  for (const { ledd, ben, leddHvile, benHvile } of r.avatar.par) {
    if (kunArmer && /Leg$/.test(ben.name)) continue;                       // bena styres av animasjonen
    const nå = fInv.clone().multiply(ledd.getWorldQuaternion(qA));         // leddet nå, i figurens rom
    const ønsket = nå.multiply(leddHvile.clone().invert()).multiply(benHvile);
    const forelder = fInv.clone().multiply(ben.parent.getWorldQuaternion(qB));
    ben.quaternion.copy(forelder.invert().multiply(ønsket));
    ben.updateMatrixWorld(true);
  }
}

export { STANDARD_UTSEENDE, lagFigur, FERDIGE, settUtseende, figurdeler, figurHendelser, følgSkjelett, X_AKSE, Y_AKSE };
