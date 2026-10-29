// Last ned huset som 3D-modell (glTF binær, .glb) rett fra nettleseren: meter, Y opp, navngitte materialer.
// Kan åpnes i SketchUp, Blender, Windows 3D-visning o.l. Fila lages ved behov, så den ikke ligger i repoet.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { scene, M, vis, oppdater } from './hus.js';

export async function lastNedModell(filnavn = 'huldervegen.glb') {
  // vent til bildene på veggene er lastet, ellers mangler de i fila
  const teksturer = [];
  scene.traverse(o => { const t = o.material?.map; if (t && !t.image) teksturer.push(t); });
  await Promise.all(teksturer.map(t => new Promise(ok => { const sjekk = () => (t.image ? ok() : setTimeout(sjekk, 100)); sjekk(); })));
  for (const [k, m] of Object.entries(M)) m.name ||= k;
  const før = { ...vis };
  Object.assign(vis, { etasje: 3, lave: false, tak: true, etiketter: false }); oppdater();
  scene.updateMatrixWorld(true);
  const ut = new THREE.Scene(); ut.name = 'Huldervegen';
  scene.traverseVisible(o => {
    if (!o.isMesh || o.userData.pynt) return;                              // ikke himmel, fly og sky
    const m = o.clone(false);
    o.matrixWorld.decompose(m.position, m.quaternion, m.scale);
    m.name = o.name || o.material.name || 'del';
    ut.add(m);
  });
  Object.assign(vis, før); oppdater();
  const data = await new GLTFExporter().parseAsync(ut, { binary: true, onlyVisible: true });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }));
  a.download = filnavn; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
