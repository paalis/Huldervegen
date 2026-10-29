// Håndgrep på 3D-modellen: fingrene og tommelen bøyes etter en grepstype, tingen festes på riktig sted i
// hånda, og hånda kan dreies så tingen peker dit den skal (gaffelen inn i munnen, kniven ned i maten).
//
// Alt regnes i håndens eget rom, utledet fra knoklenes plassering i hvile, så det virker for begge hender:
//   s = mot tommelsiden (fra lillefinger mot pekefinger), f = langs fingrene, n = ut fra håndflaten.
// Fingrene bøyes om aksen f × n (fingertuppene mot håndflaten). Tommelen dreies om aksene s, f og n.
import * as THREE from 'three';

const FINGRE = ['Index', 'Middle', 'Ring', 'Pinky'];
// grep: bøy (radianer) i de tre leddene for hver finger, tommelens tre ledd som dreiing om (s, f, n), og hvor
// tingen ligger: punkt (s, f, n) i meter, retning langs tingen (s, f, n) og tingens forside (s, f, n)
export const GREP = {
  hvile: { fingre: [[0.2, 0.25, 0.15], [0.25, 0.3, 0.2], [0.3, 0.35, 0.2], [0.35, 0.35, 0.2]], tommel: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
  // pekefinger på ryggen (kniv og gaffel): pekefingeren nesten rett langs ryggen, de andre rundt skaftet,
  // tommelen mot siden av skaftet
  pekefinger: {
    fingre: [[0.18, 0.12, 0.06], [1.3, 1.4, 1.0], [1.4, 1.45, 1.0], [1.45, 1.4, 1.0]],
    tommel: [[0, 0.6, 0.4], [0, 0, 0.15], [0, 0, 0.1]],
    ting: { punkt: [0.026, 0.135, 0.014], langs: [0.37, 1, -0.03], forside: [0, 0, 1] },
  },
  // knyttneve med tommelen langs skaftet (tannbørste): skaftet på tvers av håndflaten, hodet ut på tommelsiden
  neve: {
    fingre: [[1.0, 1.25, 0.85], [1.1, 1.35, 0.9], [1.2, 1.4, 0.9], [1.3, 1.35, 0.9]],
    tommel: [[0.2, 0.25, 0.1], [0, 0, -0.1], [0, 0, -0.1]],
    ting: { punkt: [0.0, 0.06, 0.03], langs: [1, 0.35, 0.1], forside: [0, 1, 0] },
  },
  // rundt et beger (glass, kopp, tube)
  beger: {
    fingre: [[0.55, 0.7, 0.5], [0.6, 0.75, 0.5], [0.65, 0.75, 0.5], [0.7, 0.7, 0.45]],
    tommel: [[0.55, 0, 0.1], [0, 0, 0.25], [0, 0, 0.2]],
    ting: { punkt: [0.0, 0.07, 0.05], langs: [0, 0, 0], forside: [0, 0, 1] },
  },
};

// håndens rom og knoklene, regnet ut én gang per hånd (hvile = lokale rotasjoner i hvile, fra animasjonen)
export function håndrom(hånd, hvile) {
  if (hånd.userData.håndrom) return hånd.userData.håndrom;
  const side = hånd.name.replace('Hand', '');                               // 'Right' eller 'Left'
  const b = n => hånd.getObjectByName(`${side}Hand${n}`);
  const hv = new Map(hvile.map(([bb, q]) => [bb, q]));
  const p = n => b(n).position.clone();
  const f = p('Middle1').normalize();
  const s = p('Index1').sub(p('Pinky1')); s.addScaledVector(f, -s.dot(f)).normalize();
  let n = new THREE.Vector3().crossVectors(s, f);
  if (n.dot(p('Thumb1')) < 0) n.negate();                                  // tommelen sitter på håndflatesiden
  // hvilerotasjonen til hver knokkel i forhold til hånda (produkt av hvilerotasjonene fra hånda og ut)
  const ledd = [];
  const legg = (navn, finger, i) => {
    const ben = b(navn);
    if (!ben || !hv.has(ben)) return;
    const R = new THREE.Quaternion();
    for (let o = ben; o && o !== hånd; o = o.parent) R.premultiply(hv.get(o) ?? o.quaternion);
    ledd.push({ ben, hvile: hv.get(ben).clone(), R, finger, i });
  };
  FINGRE.forEach((fi, k) => [1, 2, 3].forEach(i => legg(`${fi}${i}`, k, i - 1)));
  [1, 2, 3].forEach(i => legg(`Thumb${i}`, 'tommel', i - 1));
  // speilvendt hånd (venstre/høyre har speilvendte rom): tommelens dreiinger snus, så grepene blir like
  const c = Math.sign(new THREE.Vector3().crossVectors(s, f).dot(n)) || 1;
  const rom = { side, s, f, n, c, ledd, bøy: new THREE.Vector3().crossVectors(f, n).normalize() };
  hånd.userData.håndrom = rom;
  return rom;
}
// vektor (s, f, n) → håndens lokale rom
export const iHånd = (rom, [a, b, c]) => new THREE.Vector3().addScaledVector(rom.s, a).addScaledVector(rom.f, b).addScaledVector(rom.n, c);

// bøy fingrene og tommelen etter grepet (vekt 0 = hvile fra animasjonen, 1 = helt grep)
export function settGrep(hånd, hvile, grep, vekt = 1) {
  const rom = håndrom(hånd, hvile), q = new THREE.Quaternion(), akse = new THREE.Vector3();
  for (const l of rom.ledd) {
    l.ben.quaternion.copy(l.hvile);
    if (!grep || vekt <= 0) continue;
    const inv = l.R.clone().invert();
    if (l.finger === 'tommel') {
      const [a, b, c] = grep.tommel[l.i];
      for (const [v, ax] of [[a, rom.s], [b, rom.f], [c, rom.n]]) {
        if (!v) continue;
        akse.copy(ax).applyQuaternion(inv).normalize();
        l.ben.quaternion.multiply(q.setFromAxisAngle(akse, v * vekt * rom.c));
      }
    } else {
      akse.copy(rom.bøy).applyQuaternion(inv).normalize();
      l.ben.quaternion.multiply(q.setFromAxisAngle(akse, grep.fingre[l.finger][l.i] * vekt));
    }
  }
}

// fest en ting i hånda etter grepet. Tingens lokale +y er langs tingen og +z er forsiden; ankeret (punktet i
// tingen som skal ligge i grepet) er i tingens rom.
export function festTing(hånd, hvile, grep, ting, anker = new THREE.Vector3()) {
  const rom = håndrom(hånd, hvile), t = grep.ting;
  const y = iHånd(rom, t.langs).normalize(), z0 = iHånd(rom, t.forside);
  const z = z0.addScaledVector(y, -z0.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  hånd.add(ting);
  ting.quaternion.copy(q);
  ting.scale.setScalar(1 / hånd.getWorldScale(new THREE.Vector3()).x);     // tingen har ekte størrelse
  ting.position.copy(iHånd(rom, t.punkt)).sub(anker.clone().applyQuaternion(q).multiplyScalar(ting.scale.x));
}

// Hvor hånda skal være og hvordan den skal vende for at et punkt på tingen (tupp, i tingens rom) skal ligge i
// mål og tingen peke langs retning med forsiden mot forside. Gir håndleddets plass og rotasjon i verden.
export function håndFor(hånd, ting, tupp, mål, retning, forside) {
  const tq = ting.quaternion, ty = new THREE.Vector3(0, 1, 0).applyQuaternion(tq), tz = new THREE.Vector3(0, 0, 1).applyQuaternion(tq);
  const ramme = (y, z0) => { const z = z0.clone().addScaledVector(y, -z0.dot(y)).normalize(); return new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z); };
  const iH = ramme(ty.normalize(), tz), iV = ramme(retning.clone().normalize(), forside);
  const rot = new THREE.Quaternion().setFromRotationMatrix(iV.multiply(iH.clone().invert()));
  const sk = hånd.getWorldScale(new THREE.Vector3()).x;
  const tuppIHånd = tupp.clone().multiplyScalar(ting.scale.x).applyQuaternion(tq).add(ting.position);   // i håndens rom
  const plass = mål.clone().sub(tuppIHånd.multiplyScalar(sk).applyQuaternion(rot));
  return { plass, rot };
}
