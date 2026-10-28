// Animasjoner fra Mixamo for 3D-figurene: klippene spilles på et kildeskjelett og regnes om (retargeting)
// til modellens skjelett hvert bilde, med myke overganger mellom klipp og figurens egne bevegelser.
import * as THREE from 'three';
import { følgSkjelett, X_AKSE, Y_AKSE } from './figur.js';

// ---------- Animasjoner fra Mixamo (figurer/animasjoner.json, laget av FBX-filene i figurer/animasjoner/) ----------
// Med 3D-modell spilles ekte animasjoner der de finnes (stå, gå, løpe, sette seg, sitte, reise seg, ligge,
// piano, gitar, taste, se utover). Handlinger uten egen animasjon bruker figurens egne bevegelser som før;
// sittende handlinger med egne armbevegelser (spise, fjernkontroll, glass) får armene lagt oppå.
let animData = null;
const lastAnimasjoner = () => animData ??= fetch('figurer/animasjoner.json').then(r => r.ok ? r.json() : null).catch(() => null);
const FRAMBØY = { Spine: 3, Spine1: 3, Spine2: 3, Neck: -5 };              // grader fram for hvert ledd (se lagAnimasjoner)
const KLIPP_HANDLING = { piano: 'piano', gitar: 'gitar', playstation: 'taster', utsikt: 'utsikt' };
const ENGANG = ['setter_seg', 'reiser_seg', 'ligger'];
async function lagAnimasjoner(r) {
  const data = await lastAnimasjoner(), av = r.avatar;
  if (!data || !av || r.avatar !== av) return;
  const rot = av.rot, hips = rot.getObjectByName('Hips');
  if (!hips) return;
  const hvile = hips.position.clone(), handlinger = {}, anker = {};
  // Kildeskjelettet (Mixamo) i hvilestilling: animasjonene spilles på det, og hvert bilde regnes rotasjonene
  // om til modellens skjelett (retargeting): Gmodell = Gkilde · Gkilde,hvile⁻¹ · Gmodell,hvile, i forhold
  // til roten. Da blir holdningen riktig selv om de to skjelettene har ulike akser i hvilestillingen.
  const kilde = new THREE.Group(), kildeBen = new Map();
  for (const k of data.skjelett ?? []) {
    const b = new THREE.Bone(); b.name = k.navn; b.quaternion.fromArray(k.q);
    (k.forelder ? kildeBen.get(k.forelder) : kilde).add(b); kildeBen.set(k.navn, b);
  }
  const mixer = new THREE.AnimationMixer(data.skjelett ? kilde : rot);
  for (const k of data.klipp) {
    const spor = k.tracks.map(t => t.type === 'quaternion' ? new THREE.QuaternionKeyframeTrack(t.name, t.times, t.values)
      : new THREE.VectorKeyframeTrack(t.name, t.times, t.values.map((v, i) => hvile.getComponent(i % 3) + v * hvile.y)));
    const a = mixer.clipAction(new THREE.AnimationClip(k.name, k.duration, spor));
    if (ENGANG.includes(k.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    handlinger[k.name] = a;
    const p = spor.find(t => t.name === 'Hips.position'), n = p.values.length / 3;
    // hoftene der figuren «står» i animasjonen: slutten av å sette seg, starten av å reise seg, ellers første bilde
    anker[k.name] = new THREE.Vector3().fromArray(p.values, k.name === 'setter_seg' ? (n - 1) * 3 : 0);
  }
  const alle = [];
  rot.traverse(o => { if (o.isBone) alle.push([o, o.quaternion.clone(), o.position.clone()]); });
  // par av ben (forelder før barn) med hvilerotasjonene i forhold til roten, for kilde og modell
  const hvileLok = new Map(alle.map(([b, q]) => [b, q]));
  const globalHvile = (b, lok, rotObj) => {                              // produkt av lokale rotasjoner opp til roten
    const q = new THREE.Quaternion();
    for (let o = b; o && o !== rotObj; o = o.parent) q.premultiply(lok(o));
    return q;
  };
  // Modellens referanse er bindstillingen (T-stilling, fra skjelettets inverse bindmatriser); kildens hvilestilling
  // har armene ned. Derfor dreies armbena først så de peker samme vei som kildebenet i hvile (begge skjelettene
  // har benet langs lokal +Y): korr = Gkilde,hvile⁻¹ · S · Gmodell,bind, der S retter opp retningen.
  const retarget = [], bindG = new Map(), skjelett = rot.getObjectByProperty('isSkinnedMesh', true)?.skeleton;
  skjelett?.bones.forEach((b, i) => {
    const q = new THREE.Quaternion();
    new THREE.Matrix4().copy(skjelett.boneInverses[i]).invert().decompose(new THREE.Vector3(), q, new THREE.Vector3());
    bindG.set(b, q);
  });
  if (data.skjelett) {
    const kildeLok = o => o.quaternion, modellLok = o => hvileLok.get(o) ?? o.quaternion;
    for (const [b] of alle) {
      const kb = kildeBen.get(b.name);
      if (!kb) continue;
      const kG = globalHvile(kb, kildeLok, kilde), mG = bindG.get(b) ?? globalHvile(b, modellLok, rot);
      // bare armene rettes inn etter kildens retning (der er hvilestillingene ulike: T-stilling mot armene ned);
      // rygg, hode og bein har samme nøytrale stilling i begge, og Mixamos krumme rygg ville gitt bakoverlent figur
      const S = /Shoulder|Arm|Hand/.test(b.name) ? new THREE.Quaternion().setFromUnitVectors(Y_AKSE.clone().applyQuaternion(mG), Y_AKSE.clone().applyQuaternion(kG)) : new THREE.Quaternion();
      retarget.push({ b, kb, korr: kG.clone().invert().multiply(S).multiply(mG) });
    }
    // Avaturn-modellen står med hoftene fram og skuldrene bak; ryggen bøyes litt fram (fordelt på ryggvirvlene)
    // og nakken rettes opp igjen, så figuren står rett. Vinkelen summeres nedover i kjeden (overkroppen følger med).
    for (const r of retarget) {
      let v = 0;
      for (let o = r.b; o && o !== rot; o = o.parent) v += FRAMBØY[o.name] ?? 0;
      if (v) r.fram = new THREE.Quaternion().setFromAxisAngle(X_AKSE, v * Math.PI / 180);
    }
  }
  r.anim = { mixer, handlinger, anker, aktiv: null, modus: 'prosedyre', hvile: alle, hipsHvile: hvile, bland: null, kilde, kildeBen, retarget };
}
// regn om stillingen fra kildeskjelettet til modellen (se lagAnimasjoner)
function overførAnimasjon(r) {
  const A = r.anim;
  if (!A.retarget.length) return;
  const kG = new Map(), mG = new Map();
  const kildeG = b => { let g = kG.get(b); if (!g) { g = b.parent && b.parent !== A.kilde ? kildeG(b.parent).clone().multiply(b.quaternion) : b.quaternion.clone(); kG.set(b, g); } return g; };
  for (const { b, kb, korr, fram } of A.retarget) {
    const ønsket = kildeG(kb).clone().multiply(korr);                      // modellbenets rotasjon i forhold til roten
    if (fram) ønsket.premultiply(fram);
    // forelderens nåværende rotasjon i forhold til roten
    let fg;
    if (b.parent && mG.has(b.parent)) fg = mG.get(b.parent);
    else { fg = new THREE.Quaternion(); for (let o = b.parent; o && o !== r.avatar.rot; o = o.parent) fg.premultiply(o.quaternion); }
    b.quaternion.copy(fg.clone().invert().multiply(ønsket));
    mG.set(b, ønsket);
  }
  const kh = A.kildeBen.get('Hips'), mh = r.avatar.rot.getObjectByName('Hips');
  if (kh && mh) mh.position.copy(kh.position);                             // hoftene (allerede i modellens mål)
}
function byttModus(r, modus) {
  const A = r.anim;
  A.bland = { tid: 0, snap: A.hvile.map(([b]) => [b.quaternion.clone(), b.position.clone()]) };   // gli over fra stillingen nå
  if (modus === 'prosedyre') {
    A.mixer.stopAllAction(); A.aktiv = null;
    for (const [b, q, p] of A.hvile) { b.quaternion.copy(q); b.position.copy(p); }
    r.avatar.rot.position.set(0, 0, 0);
  }
  A.modus = modus;
}
function blandBen(r, dt) {
  const A = r.anim;
  if (!A?.bland) return;
  A.bland.tid += dt;
  const u = Math.min(1, A.bland.tid / 0.35);
  if (u >= 1) { A.bland = null; return; }
  const k = u * u * (3 - 2 * u), q = new THREE.Quaternion(), p = new THREE.Vector3();
  A.hvile.forEach(([b], i) => {
    const [sq, sp] = A.bland.snap[i];
    q.copy(b.quaternion); b.quaternion.slerpQuaternions(sq, q, k);
    p.copy(b.position); b.position.lerpVectors(sp, p, k);
  });
}
// valg = { klipp, tempo, y (gulvet), h (handlingen, for sete- og liggehøyde), armer (legg egne armbevegelser oppå) }
function animer(r, valg, dt) {
  const A = r.anim;
  if (!A || !valg.klipp || !A.handlinger[valg.klipp]) {
    if (A && A.modus === 'klipp') byttModus(r, 'prosedyre');
    følgSkjelett(r); if (A) blandBen(r, dt);
    return;
  }
  if (A.modus !== 'klipp') byttModus(r, 'klipp');
  const a = A.handlinger[valg.klipp];
  if (A.aktiv !== a) {
    a.reset(); a.setEffectiveWeight(1); a.play();
    if (A.aktiv) a.crossFadeFrom(A.aktiv, 0.3, false);
    A.aktiv = a;
  }
  a.timeScale = valg.tempo ?? 1;
  A.mixer.update(dt);
  overførAnimasjon(r);
  // plassering: modellen står på gulvet; i sofaen/senga legges hoftene på setet eller madrassen
  const f = r.figur, rot = r.avatar.rot, s = rot.scale.x, fs = f.scale.x, ank = A.anker[valg.klipp], h = valg.h;
  f.rotation.x = 0; f.rotation.z = 0; f.position.y = valg.y;
  rot.position.set(0, 0, 0);
  if (h?.holdning === 'sitt' || valg.klipp === 'reiser_seg') {
    const sete = h?.sete ?? 0.46;
    rot.position.set(-ank.x * s, (sete + 0.07) / fs - ank.y * s, -ank.z * s);
  } else if (valg.klipp === 'ligger') {
    rot.position.set(-ank.x * s, (h.liggehøyde + 0.1) / fs - ank.y * s, -0.93 - ank.z * s);   // hoftene der figurens hofter ligger
  }
  if (valg.armer) følgSkjelett(r, true);
  blandBen(r, dt);
}

export { KLIPP_HANDLING, lagAnimasjoner, animer };
