// Lys i huset: en lampe (eller to) i hvert rom og en bryter ved døra. Om kvelden slås lyset på av seg selv
// i alle rom, og om morgenen av igjen; trykker man på en bryter, gjelder det til neste kveld eller morgen.
// Lyset er noen få punktlys som flyttes til de nærmeste lampene som er på (fast antall, så ingen skygger
// eller materialer må lages på nytt), og lampene selv lyser når de er på.
import * as THREE from 'three';
import { F, H, M, scene, etg2, etg3 } from '../hus.js';

const etasje = f => [scene, etg2, etg3][f];
// lamper: rom, etasje, plassering (x, høyde over gulvet, z) og type (tak = taklampe, kule = rund papirlampe,
// pendel = lampa over spisebordet, vegg = utelampe på veggen)
const LAMPER = [
  { rom: 'stue1', f: 0, p: [3.6, H - 0.05, 2.4], type: 'tak' },
  { rom: 'stue1', f: 0, p: [1.55, 1.75, 5.35], type: 'pendel' },
  { rom: 'kjøkken', f: 0, p: [1.5, H - 0.05, 8.4], type: 'tak' },
  { rom: 'entré', f: 0, p: [4.0, H - 0.05, 8.5], type: 'tak' },
  { rom: 'terrasse', f: 0, p: [2.6, 2.1, -0.06], type: 'vegg', ute: true },
  { rom: 'inngang', f: 0, p: [2.62, 1.80, 9.97], type: 'finnes', ute: true },
  { rom: 'sov13', f: 1, p: [1.5, H - 0.05, 2.4], type: 'tak' },
  { rom: 'sov7', f: 1, p: [4.0, 2.05, 1.70], type: 'kule' },
  { rom: 'bad', f: 1, p: [1.4, H - 0.05, 5.9], type: 'tak' },
  { rom: 'sov12', f: 1, p: [2.6, H - 0.05, 8.5], type: 'tak' },
  { rom: 'gang2', f: 1, p: [3.9, H - 0.05, 4.4], type: 'tak' },
  { rom: 'stue3', f: 2, p: [2.2, H - 0.05, 5.1], type: 'tak' },
  { rom: 'kontor', f: 2, p: [1.5, H - 0.05, 8.2], type: 'tak' },
  { rom: 'vaskerom', f: 2, p: [4.0, H - 0.05, 8.5], type: 'tak' },
  { rom: 'takterrasse', f: 2, p: [2.6, 2.1, 3.30], type: 'vegg', ute: true },
];
// brytere: på veggen ved døra (x, z på veggflata), retningen inn i rommet, og navnet som vises
const BRYTERE = [
  { rom: 'stue1', navn: 'stua', f: 0, p: [4.05, 7.25], inn: [0, -1] },
  { rom: 'kjøkken', navn: 'kjøkkenet', f: 0, p: [2.28, 7.0], inn: [-1, 0] },
  { rom: 'entré', navn: 'entréen', f: 0, p: [4.05, 7.35], inn: [0, 1] },
  { rom: 'inngang', navn: 'utelyset ved inngangen', f: 0, p: [4.15, 9.65], inn: [0, -1] },
  { rom: 'terrasse', navn: 'utelyset på terrassen', f: 0, p: [4.3, 0.2], inn: [0, 1] },
  { rom: 'sov13', navn: 'soverommet', f: 1, p: [2.85, 3.46], inn: [-1, 0] },
  { rom: 'sov7', navn: 'soverommet', f: 1, p: [4.01, 3.2], inn: [0, -1] },
  { rom: 'bad', navn: 'badet', f: 1, p: [2.85, 5.18], inn: [-1, 0] },
  { rom: 'sov12', navn: 'soverommet', f: 1, p: [2.92, 7.3], inn: [0, 1] },
  { rom: 'gang2', navn: 'gangen', f: 1, p: [2.94, 4.75], inn: [1, 0] },
  { rom: 'stue3', navn: 'stua', f: 2, p: [2.0, 6.9], inn: [0, -1] },
  { rom: 'kontor', navn: 'kontoret', f: 2, p: [0.60, 6.9], inn: [0, 1] },
  { rom: 'vaskerom', navn: 'vaskerommet', f: 2, p: [4.0, 7.36], inn: [0, 1] },
  { rom: 'takterrasse', navn: 'utelyset på takterrassen', f: 2, p: [3.5, 3.35], inn: [0, 1] },
];
const VARM = 0xffd9a8, BRYTERHØYDE = 1.05;

export function lagLys({ mobil }) {
  const rom = new Map();                                                 // rom → { på, manuell, lamper: [] }
  const glødMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.5, emissive: VARM, emissiveIntensity: 0 });
  const kuleMat = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9, emissive: VARM, emissiveIntensity: 0, side: THREE.DoubleSide });
  LAMPER.forEach(l => {
    const [x, y, z] = l.p, gulv = l.f * F, p = new THREE.Vector3(x, gulv + y, z);
    let lys = p.clone();
    const mål = etasje(l.f);
    if (l.type === 'tak') {                                                // flat taklampe: kuppel i opal glass
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), glødMat.clone());
      m.rotation.x = Math.PI; m.scale.y = 0.4; m.position.copy(p); mål.add(m); l.mesh = m;
      lys = p.clone().add(new THREE.Vector3(0, -0.25, 0));
    } else if (l.type === 'kule') {                                        // papirlampen: lyser innenfra
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 14), kuleMat.clone()); m.position.copy(p); mål.add(m); l.mesh = m;
    } else if (l.type === 'vegg') {                                        // utelampe på husveggen
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.08), glødMat.clone()); m.position.copy(p); mål.add(m); l.mesh = m;
      lys = p.clone().add(new THREE.Vector3(0, -0.1, z < 1 ? -0.4 : 0.4));
    } else if (l.type === 'pendel') {                                      // glasskulene over spisebordet
      lys = p.clone().add(new THREE.Vector3(0, -0.15, 0));
      M.kugle.emissive?.set(VARM); l.mesh = { material: M.kugle };
    } else {                                                               // lampa ved inngangsdøra
      lys = p.clone().add(new THREE.Vector3(0, 0, 0.3));
      l.mesh = { material: M.lampe };
    }
    if (!rom.has(l.rom)) rom.set(l.rom, { på: false, manuell: null, lamper: [] });
    const r = { ...l, lys, styrke: l.ute ? 7 : l.type === 'pendel' ? 10 : 14 };
    rom.get(l.rom).lamper.push(r);
  });
  // bryterne: en liten hvit plate på veggen
  const plateGeo = new THREE.BoxGeometry(0.08, 0.12, 0.012), plateMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.45 });
  const brytere = BRYTERE.map(b => {
    const [x, z] = b.p, [ix, iz] = b.inn, y = b.f * F + BRYTERHØYDE;
    const m = new THREE.Mesh(plateGeo, plateMat);
    m.position.set(x + ix * 0.008, y, z + iz * 0.008); m.rotation.y = Math.atan2(ix, iz);
    etasje(b.f).add(m);
    const vippe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.01), plateMat); vippe.position.set(0, 0, 0.008); m.add(vippe);
    return { ...b, mesh: m, vippe, punkt: new THREE.Vector3(x, y, z), står: [x + ix * 0.42, z + iz * 0.42], retning: Math.atan2(-ix, -iz) };
  });
  // punktlysene (fast antall)
  const N = mobil ? 3 : 6, pool = [];
  for (let i = 0; i < N; i++) {
    const p = new THREE.PointLight(VARM, 0, 8, 2); p.castShadow = false; scene.add(p); pool.push(p);
  }
  let kveld = null;                                                       // sist kjente: true = kveld, false = dag
  function settRom(id, på) {
    const r = rom.get(id);
    if (!r) return;
    r.på = på;
    for (const l of r.lamper) {
      if (l.mesh) l.mesh.material.emissiveIntensity = på ? (l.type === 'kule' ? 1.2 : l.type === 'pendel' ? 0.6 : 2.2) : l.type === 'finnes' ? 0.25 : 0;
    }
    for (const b of brytere) if (b.rom === id) b.vippe.rotation.x = på ? -0.25 : 0.25;
  }
  for (const id of rom.keys()) settRom(id, false);
  return {
    brytere,
    erPå: id => !!rom.get(id)?.på,
    // trykk på bryteren: gjelder til neste kveld eller morgen
    vipp(id) { const r = rom.get(id); if (!r) return; r.manuell = !r.på; settRom(id, !r.på); },
    // hvert bilde: dagslys 0–1, etasjen som vises, hvor figuren er og høyden der «lave vegger» kutter
    oppdater(dagslys, synligEtasje, figur, kutt = Infinity) {
      for (const l of LAMPER) if (l.mesh?.isMesh) l.mesh.visible = l.mesh.position.y < kutt;   // ikke svevende lamper over lave vegger
      const nå = dagslys < 0.35 ? true : dagslys > 0.55 ? false : kveld;   // litt slingringsmonn rundt skumringen
      if (nå !== kveld && nå !== null) {                                   // kveld eller morgen: alt slås på eller av
        kveld = nå;
        for (const [id, r] of rom) { r.manuell = null; settRom(id, kveld); }
      }
      // punktlysene til de nærmeste lampene som er på, i etasjer som vises (og utelys)
      const kand = [];
      for (const [, r] of rom) if (r.på) for (const l of r.lamper) if (l.f <= synligEtasje) kand.push([l, l.lys.distanceToSquared(figur) + (l.f === synligEtasje ? 0 : 40)]);
      kand.sort((a, b) => a[1] - b[1]);
      pool.forEach((p, i) => {
        const l = kand[i]?.[0];
        if (!l) { p.intensity = 0; return; }
        p.position.copy(l.lys); p.intensity = l.styrke * (1 - dagslys * 0.7);
      });
    },
  };
}
