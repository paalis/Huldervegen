// Ytelse i spillet, særlig på mobil: huset består av nesten 2000 små deler, og hver del er et eget tegnekall
// (to med skygge). Faste deler med samme materiale som står nær hverandre slås derfor sammen til én del, så
// det blir langt færre tegnekall. Kamerakuttet skjuler fortsatt det som står i veien, bare i litt større biter.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RUTE = 1.0, LAG = 1.0;                                             // klyngene: ca. 1 × 1 m, 1 m høye lag

// slå sammen faste deler. kandidater: delene som kan slås sammen (husets egne), hopp: deler som må stå alene
// (dører, figurer, ting som flyttes eller skjules hver for seg). Bare søsken (samme forelder) slås sammen,
// så grupper som flyttes eller skjules (vaskemaskinen, bilder, tak) fortsatt virker.
export function slåSammen(scene, kandidater, hopp = () => false) {
  scene.updateMatrixWorld(true);
  const klynger = new Map(), b = new THREE.Box3(), c = new THREE.Vector3();
  for (const o of kandidater) {
    if (!o.isMesh || o.isSkinnedMesh || !o.parent || !o.visible || o.name || hopp(o)) continue;
    const m = o.material;
    if (Array.isArray(m) || m.transparent || m.clippingPlanes || o.userData.dør || o.userData.pynt) continue;
    b.setFromObject(o).getCenter(c);
    const nøkkel = [o.parent.uuid, m.uuid, o.castShadow, o.receiveShadow, Math.floor(c.x / RUTE), Math.floor(c.z / RUTE), Math.floor(c.y / LAG)].join();
    if (!klynger.has(nøkkel)) klynger.set(nøkkel, []);
    klynger.get(nøkkel).push(o);
  }
  let før = 0, etter = 0;
  for (const deler of klynger.values()) {
    if (deler.length < 2) continue;
    const geoer = deler.map(o => {
      o.updateMatrix();
      const g = o.geometry.clone().applyMatrix4(o.matrix);               // i forelderens rom
      for (const navn of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(navn)) g.deleteAttribute(navn);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.clearGroups();
      return g;
    });
    const like = geoer.every(g => !!g.index) ? geoer : geoer.map(g => (g.index ? g.toNonIndexed() : g));
    const geo = mergeGeometries(like, false);
    if (!geo) continue;
    const ny = new THREE.Mesh(geo, deler[0].material);
    ny.castShadow = deler[0].castShadow; ny.receiveShadow = deler[0].receiveShadow;
    ny.userData.sammenslått = deler.length;
    deler[0].parent.add(ny);
    for (const o of deler) o.removeFromParent();
    før += deler.length; etter++;
  }
  // de faste delene trenger ikke regne om plasseringen sin hvert bilde (vegger kortes ned av «lave vegger»
  // og står derfor utenfor), og små detaljer kaster ingen synlig skygge
  scene.traverse(o => {
    if (!o.isMesh || o.material.clippingPlanes || hopp(o) || o.userData.pynt) return;
    if (o.userData.sammenslått || kandidater.has(o)) { o.updateMatrix(); o.matrixAutoUpdate = false; }
    if (o.castShadow && o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere();
    if (o.castShadow && o.geometry.boundingSphere.radius < 0.06) o.castShadow = false;
  });
  return { før, etter };
}

// skyggene tegnes på nytt hvert bilde på PC, annethvert på mobil (figuren flytter seg lite fra bilde til bilde)
export function skyggeTakt(renderer, mobil) {
  renderer.shadowMap.autoUpdate = false;
  let n = 0;
  return () => { if (!mobil || n++ % 2 === 0) renderer.shadowMap.needsUpdate = true; };
}
