// Hendene til figurene etter animasjonen: ting i hånda med ordentlig grep (grep.js), gitaren mellom hendene,
// arm-IK på 3D-modellens egne armbein, styring av håndleddet så tingen peker riktig, og ryggen som bøyes
// (når figuren bøyer seg over vasken). Alt gjelder én figur (r) om gangen, så det virker likt for egen figur
// og for andre spillere.
import * as THREE from 'three';
import { GREP, settGrep, festTing, håndFor } from './grep.js';

const OPP = new THREE.Vector3(0, 1, 0);
// hvilken hånd og hvilket grep tingene holdes med, og ankeret (punktet i tingen som ligger i grepet)
const TINGDEF = {
  gaffel: { hånd: 'Left', grep: 'pekefinger' },
  kniv: { hånd: 'Right', grep: 'pekefinger' },
  stekespade: { hånd: 'Right', grep: 'neve', anker: [0, -0.04, 0] },
  tannbørste: { hånd: 'Right', grep: 'neve', anker: [0, -0.03, 0] },
  tube: { hånd: 'Left', grep: 'beger', anker: [0, 0, 0] },
  glass: { hånd: 'Right', grep: 'beger', anker: [0, 0.055, 0] },
  koppHånd: { hånd: 'Right', grep: 'beger', anker: [0, 0.045, 0] },
};
const retninger = r => { const h = r.figur.rotation.y; return [new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), new THREE.Vector3(-Math.cos(h), 0, Math.sin(h))]; };

// munnen: litt foran og under hodebenet (eller styreskjelettets hode uten 3D-modell)
function munnPunkt(r) {
  const hd = r.avatar?.rot.getObjectByName('Head');
  if (hd) return hd.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.01, 0.105).applyQuaternion(hd.getWorldQuaternion(new THREE.Quaternion())));
  const [fram] = retninger(r);
  return r.hodet.getWorldPosition(new THREE.Vector3()).addScaledVector(fram, 0.1).add(new THREE.Vector3(0, -0.03, 0));
}

// Tingene festes i 3D-modellens hender med grepet sitt, og fingrene bøyes rundt den tingen som vises. Uten
// modell ligger de i styreskjelettets høyre hånd (r.håndJust) som før.
function oppdaterGrep(r) {
  const rot = r.avatar?.rot, g = r.grep ??= { rot: null, holder: {} };
  if (rot !== g.rot) {                                                     // ny modell (eller ingen): flytt tingene
    g.rot = rot; g.holder = {};
    for (const [navn, o] of Object.entries(r.ting)) {
      const def = TINGDEF[navn], hånd = rot?.getObjectByName(def.hånd + 'Hand');
      if (!hånd || !r.anim) { r.håndJust.add(o); o.position.copy(o.userData.opprinnelig[0]); o.quaternion.copy(o.userData.opprinnelig[1]); o.scale.setScalar(1); continue; }
      festTing(hånd, r.anim.hvile, GREP[def.grep], o, new THREE.Vector3(...(def.anker ?? [0, 0, 0])));
    }
  }
  if (!rot || !r.anim) return;
  for (const side of ['Right', 'Left']) {
    const holdt = Object.entries(r.ting).find(([navn, o]) => o.visible && TINGDEF[navn].hånd === side);
    const grep = holdt ? GREP[TINGDEF[holdt[0]].grep] : (r.håndform?.[side] ? GREP[r.håndform[side]] : null);
    const hånd = rot.getObjectByName(side + 'Hand');
    if (grep) { settGrep(hånd, r.anim.hvile, grep); g.holder[side] = true; }
    else if (g.holder[side]) { settGrep(hånd, r.anim.hvile, null); g.holder[side] = false; }
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

// ryggen bøyes fram (r.bøy radianer, fordelt på ryggvirvlene) og nakken litt ned, rundt figurens høyreakse
// (uten animasjonsklipp stilles ikke ryggen tilbake av animasjonen, så forrige bildes bøy tas bort først)
function bøyRygg(r) {
  const rot = r.avatar?.rot, v = r.bøy || 0;
  if (!rot) return;
  if (r.ryggFør && r.anim?.modus !== 'klipp') for (const [b, q0] of r.ryggFør) b.quaternion.copy(q0);
  r.ryggFør = null;
  if (Math.abs(v) < 1e-3) return;
  const [, høyre] = retninger(r), q = new THREE.Quaternion();
  r.ryggFør = [];
  for (const [navn, andel] of [['Spine', 0.3], ['Spine1', 0.35], ['Spine2', 0.35], ['Neck', 0.25]]) {
    const b = rot.getObjectByName(navn);
    if (!b) continue;
    r.ryggFør.push([b, b.quaternion.clone()]);
    const verden = b.getWorldQuaternion(new THREE.Quaternion());
    q.setFromAxisAngle(høyre, -v * andel).multiply(verden);                 // drei i verden om høyreaksen (fram)
    b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
    b.updateMatrixWorld(true);
  }
}

// Armene på 3D-modellen legges mot målene handlingen satte: a.mål (håndleddet dit, se spillets rekkMot)
// eller r.håndMål[side] = { ting, tupp, mål, retning, forside } (et punkt på tingen dit, tingen langs retning
// med forsiden mot forside; hånda dreies etter det). To-ledds IK på modellens egne armbein; albuen peker ned
// og litt ut.
function rettHender(r) {
  const rot = r.avatar?.rot;
  const [fram, høyre] = retninger(r);
  for (const [a, side, ut] of [[r.armV, 'Right', 1], [r.armH, 'Left', -1]]) {
    const hm = r.håndMål?.[side];
    let mål = a.brukt && a.mål; a.brukt = false;
    if (r.håndMål) r.håndMål[side] = null;
    if (!rot || !(mål || hm)) continue;
    const skulder = rot.getObjectByName(side + 'Arm'), albue = rot.getObjectByName(side + 'ForeArm'), hånd = rot.getObjectByName(side + 'Hand');
    if (!skulder || !albue || !hånd) continue;
    rot.updateMatrixWorld(true);
    let håndRot = null;
    if (hm && hm.ting.parent === hånd) { const s = håndFor(hånd, hm.ting, hm.tupp, hm.mål, hm.retning, hm.forside); mål = s.plass; håndRot = s.rot; }
    if (!mål) continue;
    const S = skulder.getWorldPosition(new THREE.Vector3()), E = albue.getWorldPosition(new THREE.Vector3()), W = hånd.getWorldPosition(new THREE.Vector3());
    const la = E.distanceTo(S), lb = W.distanceTo(E), mot = mål.clone().sub(S), d = Math.min(mot.length(), la + lb - 0.002);
    // albuen: ned og litt ut; når hånda er oppe ved ansiktet (over skulderen), mer ned og fram enn ut
    const høy = Math.min(1, Math.max(0, (mål.y - S.y + 0.15) / 0.25));
    const dir = mot.normalize(), pol = OPP.clone().negate().addScaledVector(høyre, (0.75 - 0.6 * høy) * ut).addScaledVector(fram, -0.25 + 0.3 * høy);
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
    if (håndRot) {                                                         // håndleddet: tingen peker dit den skal
      // vridningen om underarmen fordeles: 70 % tas av underarmen, så mansjetten ikke vris i stykker ved håndleddet
      const lok = albue.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(håndRot);
      const akse = hånd.position.clone().normalize(), proj = akse.clone().multiplyScalar(akse.dot(new THREE.Vector3(lok.x, lok.y, lok.z)));
      const vri = new THREE.Quaternion(proj.x, proj.y, proj.z, lok.w).normalize();
      albue.quaternion.multiply(new THREE.Quaternion().slerp(vri, 0.7)); albue.updateMatrixWorld(true);
      hånd.quaternion.copy(albue.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(håndRot));
      hånd.updateMatrixWorld(true);
    }
  }
}

// alt dette, i riktig rekkefølge, etter at figurens animasjon er regnet ut for bildet. Til slutt huskes figurens
// faktiske stilling og munn, som handlingene bruker neste bilde (se spillets iRigg).
function etterAnimasjon(r) {
  bøyRygg(r);
  oppdaterGrep(r);
  plasserGitar(r);
  rettHender(r);
  r.figur.updateMatrixWorld(true); r.ekteInv = r.figur.matrixWorld.clone().invert();
  r.munn = munnPunkt(r);
  r.håndform = null; r.bøy = 0;
}

export { munnPunkt, etterAnimasjon, TINGDEF };
