// Hendene til figurene etter animasjonen: ting i hånda (fingrene krummes rundt dem), gitaren mellom hendene,
// tannbørsten og gaffelen mot munnen, glass og kopp som vippes, og arm-IK på 3D-modellens egne armbein.
// Alt gjelder én figur (r) om gangen, så det virker likt for egen figur og for andre spillere.
import * as THREE from 'three';
import { X_AKSE } from './figur.js';

const OPP = new THREE.Vector3(0, 1, 0);
// hvordan tingene holdes: skaft gjennom neven (ut = hvor langt de stikker ut på pekefingersiden) eller beger
// i hånda (radius og høyde); krum = hvor mye fingrene bøyes i de tre leddene
const TINGDEF = {
  gaffel: { type: 'skaft', ut: 0.035, krum: [1.05, 1.25, 0.9] },
  stekespade: { type: 'skaft', ut: 0.02, krum: [1.1, 1.3, 0.95] },
  tannbørste: { type: 'skaft', ut: 0.03, krum: [1.05, 1.25, 0.9] },
  glass: { type: 'beger', r: 0.035, h: 0.12, krum: [0.55, 0.75, 0.55] },
  koppHånd: { type: 'beger', r: 0.04, h: 0.09, krum: [0.6, 0.8, 0.6] },
};
const FINGRE = ['Index', 'Middle', 'Ring', 'Pinky'];
const retninger = r => { const h = r.figur.rotation.y; return [new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), new THREE.Vector3(-Math.cos(h), 0, Math.sin(h))]; };

// munnen: litt foran og under hodebenet (eller styreskjelettets hode uten 3D-modell)
function munnPunkt(r) {
  const hd = r.avatar?.rot.getObjectByName('Head');
  if (hd) return hd.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.01, 0.105).applyQuaternion(hd.getWorldQuaternion(new THREE.Quaternion())));
  const [fram] = retninger(r);
  return r.hodet.getWorldPosition(new THREE.Vector3()).addScaledVector(fram, 0.1).add(new THREE.Vector3(0, -0.03, 0));
}

// Med 3D-modell festes tingene i modellens høyre hånd (armV er figurens høyre arm), og fingrene krummes rundt
// den som vises. Fingrene bøyer seg om sin lokale x-akse (målt fra Mixamo-klippene), og håndflaten vender mot
// +z i håndens rom. Uten modell ligger de i styreskjelettets hånd (r.håndJust).
function oppdaterGrep(r) {
  const g = r.grep ??= { hånd: null, ben: null, på: false };
  const hånd = r.avatar?.rot.getObjectByName('RightHand') ?? null;
  if (hånd !== g.hånd) {                                                   // ny modell (eller ingen): flytt tingene
    g.hånd = hånd; g.ben = null; g.på = false;
    for (const [navn, o] of Object.entries(r.ting)) {
      const def = TINGDEF[navn];
      if (!hånd) { r.håndJust.add(o); o.position.copy(o.userData.opprinnelig[0]); o.quaternion.copy(o.userData.opprinnelig[1]); o.scale.setScalar(1); continue; }
      const ledd = n => hånd.getObjectByName('RightHand' + n)?.position;
      const i1 = ledd('Index1'), p1 = ledd('Pinky1'), m1 = ledd('Middle1');
      if (!i1 || !p1 || !m1) continue;
      const y = i1.clone().sub(p1).normalize();                            // fra lillefinger mot pekefinger: gjennom grepet
      const langs = m1.clone().normalize(), flate = new THREE.Vector3(0, 0, 1);
      const z = flate.addScaledVector(y, -flate.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
      const midt = m1.clone().multiplyScalar(0.6).addScaledVector(langs, 0.01);
      const pos = def.type === 'skaft'
        ? midt.clone().addScaledVector(z, 0.022).addScaledVector(y, def.ut)  // skaftet gjennom neven, tennene ut på pekefingersiden
        : midt.clone().addScaledVector(z, def.r + 0.012).addScaledVector(y, -def.h * 0.45);
      hånd.add(o); o.position.copy(pos);
      o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      o.scale.setScalar(1 / (r.avatar.rot.scale.x || 1));                   // modellen er skalert; tingene skal ha ekte størrelse
      o.userData.grep = null;                                              // nytt grep (se plasserHåndting)
    }
  }
  if (!hånd || !r.anim) return;
  g.ben ??= FINGRE.flatMap(f => [1, 2, 3].map(n => {
    const b = hånd.getObjectByName(`RightHand${f}${n}`), hv = r.anim.hvile.find(([bb]) => bb === b);
    return b && hv ? [b, hv[1], n - 1] : null;
  }).filter(Boolean));
  const holdt = Object.entries(r.ting).find(([, o]) => o.visible);
  if (holdt) {
    const krum = TINGDEF[holdt[0]].krum, q = new THREE.Quaternion();
    for (const [b, hvile, i] of g.ben) b.quaternion.copy(hvile).multiply(q.setFromAxisAngle(X_AKSE, krum[i]));
    g.på = true;
  } else if (g.på) {
    for (const [b, hvile] of g.ben) b.quaternion.copy(hvile);
    g.på = false;
  }
}

// gitaren: med 3D-modell mellom hendene (høyre hånd slår an over pickupene, halsen peker mot venstre hånd),
// ellers foran den tegnede figuren med halsen skrått opp mot venstre
function plasserGitar(r) {
  const gitar = r.gitar;
  if (!gitar?.visible) return;
  const rot = r.avatar?.rot, R = rot?.getObjectByName('RightHandMiddle1'), L = rot?.getObjectByName('LeftHandMiddle1');
  r.figur.updateMatrixWorld(true);
  if (R && L) {
    const pr = R.getWorldPosition(new THREE.Vector3()), pl = L.getWorldPosition(new THREE.Vector3());
    const x = pl.clone().sub(pr).normalize(), [fram] = retninger(r);
    const z = fram.addScaledVector(x, -fram.dot(x)).normalize(), y = new THREE.Vector3().crossVectors(z, x);
    gitar.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    gitar.position.copy(pr).addScaledVector(z, -0.085).addScaledVector(y, -0.02);    // strengene under fingrene, kroppen inntil magen
    // men aldri inni kroppen: baksiden (4,5 cm bak strengene) skal ligge foran magen, ca. 13 cm foran ryggraden
    const rygg = rot.getObjectByName('Spine');
    if (rygg) {
      const d = gitar.position.clone().sub(rygg.getWorldPosition(new THREE.Vector3())).dot(z);
      if (d < 0.19) gitar.position.addScaledVector(z, 0.19 - d);
    }
  } else {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(0.02, 1.0, 0.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.42)), new THREE.Vector3(1, 1, 1));
    m.premultiply(r.figur.matrixWorld).decompose(gitar.position, gitar.quaternion, gitar.scale);
  }
}

// tannbørsten i hånda dreies så bustene ligger i munnen, med bustene inn mot tennene
function plasserTannbørste(r) {
  const t = r.ting.tannbørste;
  if (!t.visible || !t.parent) return;
  const grep = t.userData.grep ??= new Map();                               // grepet i hånda (per hånd), utgangspunkt hver gang
  if (!grep.has(t.parent)) grep.set(t.parent, t.position.clone());
  t.position.copy(grep.get(t.parent)); t.parent.updateMatrixWorld(true);
  const munn = munnPunkt(r), p = t.getWorldPosition(new THREE.Vector3()), [fram] = retninger(r);
  const y = munn.clone().sub(p).normalize();
  const z = fram.negate().addScaledVector(y, fram.dot(y) * -1).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  const verden = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  t.quaternion.copy(t.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(verden));
  // bustene (17 cm ut langs skaftet fra grepet) skal være i munnen: skyv børsten langs skaftet om hånda er litt unna
  const avvik = munn.distanceTo(p) - 0.165;
  if (Math.abs(avvik) > 0.002) t.position.copy(t.parent.worldToLocal(p.addScaledVector(y, avvik)));
}

// armene på 3D-modellen legges direkte mot målene handlingen satte (a.mål, se spillets rekkMot): to-ledds IK på
// modellens egne armbein, så håndleddet treffer selv om styreskjelettet har andre armlengder og skuldre;
// albuen peker ned og litt ut
function rettHender(r) {
  const rot = r.avatar?.rot;
  const [fram, høyre] = retninger(r);
  for (const [a, side, ut] of [[r.armV, 'Right', 1], [r.armH, 'Left', -1]]) {
    const mål = a.brukt && a.mål; a.brukt = false;
    if (!mål || !rot) continue;
    const skulder = rot.getObjectByName(side + 'Arm'), albue = rot.getObjectByName(side + 'ForeArm'), hånd = rot.getObjectByName(side + 'Hand');
    if (!skulder || !albue || !hånd) continue;
    rot.updateMatrixWorld(true);
    const S = skulder.getWorldPosition(new THREE.Vector3()), E = albue.getWorldPosition(new THREE.Vector3()), W = hånd.getWorldPosition(new THREE.Vector3());
    const la = E.distanceTo(S), lb = W.distanceTo(E), mot = mål.clone().sub(S), d = Math.min(mot.length(), la + lb - 0.002);
    const dir = mot.normalize(), pol = OPP.clone().negate().addScaledVector(høyre, 0.45 * ut).addScaledVector(fram, -0.25);
    const vin = new THREE.Vector3().copy(pol).addScaledVector(dir, -pol.dot(dir)).normalize();
    const alfa = Math.acos(Math.min(1, Math.max(-1, (la * la + d * d - lb * lb) / (2 * la * d))));
    const nyE = S.clone().addScaledVector(dir, la * Math.cos(alfa)).addScaledVector(vin, la * Math.sin(alfa)), nyW = S.clone().addScaledVector(dir, d);
    const drei = (ben, fra, til) => {                                      // drei benet i verden så fra-retningen blir til-retningen
      const q = new THREE.Quaternion().setFromUnitVectors(fra.normalize(), til.normalize());
      const wq = ben.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
      ben.quaternion.copy(ben.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
      ben.updateMatrixWorld(true);
    };
    drei(skulder, E.clone().sub(S), nyE.clone().sub(S));
    const E2 = albue.getWorldPosition(new THREE.Vector3()), W2 = hånd.getWorldPosition(new THREE.Vector3());
    drei(albue, W2.sub(E2), nyW.sub(E2));
  }
}

// gaffel, glass og kopp: dreies og flyttes litt i hånda så de treffer maten og munnen (r.håndTing settes av
// handlingen hvert bilde: { o, type: 'skaft', tupp, retning, lengde } eller { o, type: 'beger', w, vipp, munn })
function plasserHåndting(r) {
  const k = r.håndTing; r.håndTing = null;
  if (!k || !k.o.visible || !k.o.parent || !r.avatar) return;
  const o = k.o, grep = o.userData.grep ??= new Map();
  if (!grep.has(o.parent)) grep.set(o.parent, [o.position.clone(), o.quaternion.clone()]);
  const [lp, lq] = grep.get(o.parent);
  o.position.copy(lp); o.quaternion.copy(lq); o.parent.updateMatrixWorld(true);
  const p = o.getWorldPosition(new THREE.Vector3()), forelderQ = o.parent.getWorldQuaternion(new THREE.Quaternion());
  const [fram, høyre] = retninger(r);
  let verden, mål;
  if (k.type === 'skaft') {                                                // tennene peker langs retningen, tuppen i maten eller munnen
    const y = k.retning.clone(), z = OPP.clone().addScaledVector(y, -OPP.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    verden = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    mål = k.tupp.clone().addScaledVector(y, -k.lengde);
  } else {                                                                 // står rett i hånda, vippes mot munnen med kanten ved leppene
    const vipp = new THREE.Quaternion().setFromAxisAngle(høyre, k.vipp);   // toppen vippes mot ansiktet
    verden = vipp.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(høyre.clone().negate(), OPP, fram)));
    const opp = OPP.clone().applyQuaternion(vipp), mot = fram.clone().negate().applyQuaternion(vipp);
    const def = TINGDEF[o.userData.ting];
    const vedMunn = k.munn.clone().addScaledVector(opp, -def.h).addScaledVector(mot, -def.r).addScaledVector(fram, 0.01);
    mål = p.clone().lerp(vedMunn, k.w);
  }
  o.quaternion.copy(forelderQ.clone().invert().multiply(verden));
  const flytt = mål.sub(p); if (flytt.length() > 0.08 && k.type === 'skaft') flytt.setLength(0.08);   // gaffelen blir i neven
  o.position.copy(o.parent.worldToLocal(p.add(flytt)));
}

// alt dette, i riktig rekkefølge, etter at figurens animasjon er regnet ut for bildet. Til slutt huskes figurens
// faktiske stilling og munn, som handlingene bruker neste bilde (se spillets iRigg).
function etterAnimasjon(r) {
  oppdaterGrep(r);
  plasserGitar(r);
  plasserTannbørste(r);
  rettHender(r);
  plasserHåndting(r);
  r.figur.updateMatrixWorld(true); r.ekteInv = r.figur.matrixWorld.clone().invert();
  r.munn = munnPunkt(r);
}

export { munnPunkt, etterAnimasjon };
