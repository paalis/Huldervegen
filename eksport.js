// Last ned huset som 3D-modell (glTF binær, .glb) rett fra nettleseren. Filene lages ved behov, så de ikke ligger i repoet.
// - lastNedModell(): meter, Y opp, navngitte materialer. Til SketchUp, Blender, Windows 3D-visning o.l.
// - lastNedHomeAssistant(): til floor3d-card i Home Assistant (se homeassistant/README.md): centimeter, etasjene
//   merket lvl000/lvl001/lvl002 så kortet får etasjeknapper, uten tak, med et gulvfelt per rom (room_…) og en
//   lampe per lyspunkt (lys_…) som entiteter kan kobles til med object_id.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, M, F, vis, oppdater, etg2, etg3 } from './hus.js';
import { ROM } from './spill/rom.js';
import { LAMPER } from './spill/lys.js';

// æ/ø/å o.l. blir ASCII, så navnene er lette å skrive i YAML og overlever glTF-lasteren
export const ascii = s => s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// rommene i spill/rom.js med korte id-er (samme som lampene i spill/lys.js bruker)
const ROM_ID = ['stue1', 'kjokken', 'entre', 'terrasse', 'inngang', null, 'sov13', 'sov7', 'bad', 'sov12', 'altan', 'gang2',
  'takterrasse', 'stue3', 'kontor', 'vaskerom', 'gang3'];
export const HA_ROM = ROM.map(([f, x1, z1, x2, z2, navn, areal], i) => ({ id: ROM_ID[i], f, x1, z1, x2, z2, navn, areal }))
  .filter(r => r.id);
const lampeNavn = (() => {
  const antall = {};
  return LAMPER.map(l => { const id = ascii(l.rom); antall[id] = (antall[id] || 0) + 1; return antall[id] > 1 ? `lys_${id}_${antall[id]}` : `lys_${id}`; });
})();
export const HA_LAMPER = LAMPER.map((l, i) => ({ ...l, navn: lampeNavn[i] }));

async function ventPåTeksturer() {                                       // ellers mangler bildene på veggene i fila
  const teksturer = [];
  scene.traverse(o => { const t = o.material?.map; if (t && !t.image) teksturer.push(t); });
  await Promise.all(teksturer.map(t => new Promise(ok => { const sjekk = () => (t.image ? ok() : setTimeout(sjekk, 100)); sjekk(); })));
  for (const [k, m] of Object.entries(M)) m.name ||= k;
}

// Synlige deler av huset med verdenskoordinater, i visningen `visning`. fn(mesh, etasje 0–2) for hver del.
function forHverDel(visning, fn) {
  const før = { ...vis };
  Object.assign(vis, { etasje: 3, lave: false, etiketter: false, ...visning }); oppdater();
  scene.updateMatrixWorld(true);
  scene.traverseVisible(o => {
    if (!o.isMesh || o.userData.pynt) return;                              // ikke himmel, fly og sky
    let f = 0;
    for (let p = o; p; p = p.parent) { if (p === etg3) { f = 2; break; } if (p === etg2) { f = 1; break; } }
    fn(o, f);
  });
  Object.assign(vis, før); oppdater();
}

function lastNed(data, filnavn) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  a.download = filnavn; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export async function lastNedModell(filnavn = 'huldervegen.glb') {
  await ventPåTeksturer();
  const ut = new THREE.Scene(); ut.name = 'Huldervegen';
  forHverDel({ tak: true }, o => {
    const m = o.clone(false);
    o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
    m.name = o.name || o.material.name || 'del';
    ut.add(m);
  });
  lastNed(await new GLTFExporter().parseAsync(ut, { binary: true, onlyVisible: true }), filnavn);
}

// Selve Home Assistant-scenen. Alt bakes inn i geometrien i centimeter, uten transformasjoner, fordi floor3d-card
// flytter hver del inn i sin etasjegruppe og regner romboksene ut fra geometrien.
export async function lagHomeAssistantScene() {
  await ventPåTeksturer();
  const CM = new THREE.Matrix4().makeScale(100, 100, 100);
  const ut = new THREE.Scene(); ut.name = 'Huldervegen';
  const legg = (geometri, materiale, f, navn) => {
    const m = new THREE.Mesh(geometri, materiale);
    m.name = `lvl00${f}${navn}`;
    ut.add(m);
    return m;
  };
  // Huset har rundt 1600 små deler. Hver for seg blir det like mange tegnekall, og det er tungt for et nettbrett
  // på veggen. Delene slås derfor sammen til én per materiale og etasje (navn som «lvl001vegg2»).
  const grupper = new Map();
  forHverDel({ tak: false }, (o, f) => {
    const nøkkel = `${f}|${o.material.uuid}`;
    if (!grupper.has(nøkkel)) grupper.set(nøkkel, { f, materiale: o.material, geoer: [] });
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(CM, o.matrixWorld));
    const tekstur = !!o.material.map;
    for (const navn of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(navn)) g.deleteAttribute(navn);
    if (!tekstur) g.deleteAttribute('uv');                               // uv trengs bare under bilder
    else if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups();
    grupper.get(nøkkel).geoer.push(g);
  });
  const brukt = {};
  for (const { f, materiale, geoer } of grupper.values()) {
    const like = geoer.every(g => !!g.index) ? geoer : geoer.map(g => (g.index ? g.toNonIndexed() : g));
    const geo = like.length > 1 ? mergeGeometries(like, false) : like[0];
    const base = ascii(materiale.name || 'del') || 'del', k = `${f}${base}`;
    brukt[k] = (brukt[k] || 0) + 1;
    legg(geo, materiale, f, brukt[k] > 1 ? `${base}_${brukt[k]}` : base);
  }

  // gulvfelt per rom: usynlige, men kan klikkes, og floor3d-card lager romboks og etikett ut fra dem
  const romMat = new THREE.MeshStandardMaterial({ name: 'rom', color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  for (const r of HA_ROM) {
    const y = r.f * F + 0.02;
    const g = new THREE.BoxGeometry(r.x2 - r.x1, 0.01, r.z2 - r.z1)
      .translate((r.x1 + r.x2) / 2, y, (r.z1 + r.z2) / 2).applyMatrix4(CM);
    legg(g, romMat, r.f, `room_${r.id}`);
  }

  // lampene: små kupler i taket (eller der lampa sitter), så lyset fra Home Assistant har et sted å komme fra
  const lampeMat = new THREE.MeshStandardMaterial({ name: 'lampe_ha', color: 0xfff6e8, roughness: 0.5, emissive: 0x332a1e });
  for (const l of HA_LAMPER) {
    const [x, y, z] = l.p;
    const g = new THREE.SphereGeometry(0.12, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).scale(1, 0.4, 1)
      .translate(x, l.f * F + y, z).applyMatrix4(CM);
    legg(g, lampeMat, l.f, l.navn);
  }
  return ut;
}

export async function lastNedHomeAssistant(filnavn = 'huldervegen-ha.glb') {
  const ut = await lagHomeAssistantScene();
  lastNed(await new GLTFExporter().parseAsync(ut, { binary: true }), filnavn);
}
