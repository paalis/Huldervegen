// Rekvisitter i spillet: ting figurene holder (gaffel, kopp, glass, tannbørste, stekespade og en rød
// Stratocaster), og ting som vises i huset under handlingene (middag, stekepanne, kaffekopp i maskinen,
// damp, vannstråler og «Zzz»).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { F, scene } from '../hus.js';

const π = Math.PI, G1 = 0, G2 = F;
const stål = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.8 });

// ---------- Ting i hånda ----------
// Hver figur får sitt eget sett (lagHåndting). Uten 3D-modell henger de i styreskjelettets hånd (hånda peker
// nedover langs underarmen, fingrene mot +z); med 3D-modell flyttes de til modellens hånd (se spillets oppdaterGrep).
function lagGaffel() {                                                    // skaft, hals og fire tenner langs +y
  const g = new THREE.Group();
  const skaft = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.12, 0.004, 2, 0.0018), stål); skaft.position.y = -0.02; g.add(skaft);
  const hals = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.003), stål); hals.position.y = 0.05; g.add(hals);
  for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.04, 0.0025), stål); t.position.set(-0.0075 + k * 0.005, 0.082, 0); g.add(t); }
  return g;
}
function lagKopp() {
  const k = new THREE.Group(), keramikk = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35 });
  const kar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.09, 24), keramikk); kar.position.y = 0.045; k.add(kar);
  const kaffe = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.2 }));
  kaffe.rotation.x = -π / 2; kaffe.position.y = 0.08; k.add(kaffe);
  const hank = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 16), keramikk); hank.position.set(0.045, 0.05, 0); k.add(hank);
  return k;
}
function lagGlass() {                                                     // glass med saft, bunnen i origo
  const glass = new THREE.Group();
  const g1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xdfeef2, roughness: 0.05, transparent: true, opacity: 0.45 }));
  g1.position.y = 0.06; glass.add(g1);
  const saft = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.028, 0.07, 20), new THREE.MeshStandardMaterial({ color: 0xe8a33a, roughness: 0.3 }));
  saft.position.y = 0.04; glass.add(saft);
  return glass;
}
function lagTannbørste() {                                                // skaft langs +y, bustene ytterst mot +z
  const t = new THREE.Group();
  const skaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x3a8fd6, roughness: 0.4 }));
  skaft.position.y = 0.06; t.add(skaft);
  const bust = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.012), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  bust.position.set(0, 0.14, 0.008); t.add(bust);
  return t;
}
function lagStekespade() {                                                // skaft langs +y, bladet ytterst
  const g = new THREE.Group(), svart = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.6 });
  const skaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 12), svart); skaft.position.y = 0.02; g.add(skaft);
  const blad = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.09, 0.004, 2, 0.0018), svart); blad.position.set(0, 0.16, 0.012); blad.rotation.x = 0.35; g.add(blad);
  return g;
}
// et sett ting til én figur, med plassering i styreskjelettets hånd; alle er skjult til de trengs
function lagHåndting() {
  const sett = (o, [x, y, z], rx) => { o.position.set(x, y, z); o.rotation.x = rx; o.visible = false; return o; };
  return {
    gaffel: sett(lagGaffel(), [0, -0.07, 0.05], 1.2),
    koppHånd: sett(lagKopp(), [0, -0.10, 0.06], π / 2),
    glass: sett(lagGlass(), [0, -0.09, 0.06], π / 2),
    tannbørste: sett(lagTannbørste(), [0, -0.08, 0.05], -1.9),
    stekespade: sett(lagStekespade(), [0, -0.07, 0.05], 0),
  };
}

// Rød Stratocaster: kropp med doble horn, hvit plekterplate, tre pickuper, kam, knotter, lønnehals med
// palisandergripebrett og bånd, Strat-hode med stemmeskruer og seks strenger. Lokalt: halsen langs +x,
// forsiden mot +z, origo der høyre hånd slår an (mellom pickupene). Plasseres hvert bilde (se plasserGitar).
function lagStratocaster() {
  const g = new THREE.Group();
  const lakk = new THREE.MeshPhysicalMaterial({ color: 0xa80f1a, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
  const hvit = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.4 });
  const krom = new THREE.MeshStandardMaterial({ color: 0xd8dadc, roughness: 0.2, metalness: 1 });
  const lønn = new THREE.MeshStandardMaterial({ color: 0xe2c08a, roughness: 0.45 });
  const palisander = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 });
  const form = (pkt, lukk = true) => { const f = new THREE.Shape(); f.moveTo(...pkt[0]); f.splineThru(pkt.slice(1).map(([x, y]) => new THREE.Vector2(x, y))); if (lukk) f.closePath(); return f; };
  const ekstruder = (f, dybde, fas, m, z) => {
    const geo = new THREE.ExtrudeGeometry(f, { depth: dybde, bevelEnabled: fas > 0, bevelSize: fas, bevelThickness: fas, bevelSegments: 3, curveSegments: 48 });
    const mesh = new THREE.Mesh(geo, m); mesh.position.z = z; mesh.castShadow = true; g.add(mesh); return mesh;
  };
  // kroppen (4,5 cm tykk, forsiden på z = 0)
  ekstruder(form([[0.06, 0.03], [0.10, 0.10], [0.085, 0.148], [0.035, 0.152], [-0.015, 0.12], [-0.07, 0.128], [-0.16, 0.158], [-0.26, 0.158],
    [-0.335, 0.11], [-0.36, 0.0], [-0.335, -0.115], [-0.26, -0.162], [-0.16, -0.155], [-0.075, -0.128], [-0.02, -0.122], [0.03, -0.142], [0.062, -0.118], [0.06, -0.03]]),
    0.033, 0.006, lakk, -0.039);
  // plekterplate
  ekstruder(form([[0.055, 0.032], [0.07, 0.08], [0.03, 0.115], [-0.04, 0.1], [-0.13, 0.11], [-0.2, 0.075], [-0.205, -0.02], [-0.17, -0.09], [-0.1, -0.11],
    [-0.03, -0.1], [0.04, -0.105], [0.055, -0.07], [0.055, -0.032]]), 0.002, 0, hvit, 0.001);
  // pickuper (den bakerste på skrå), kam og knotter
  [[0.0, 0], [-0.052, 0], [-0.11, 0.14]].forEach(([x, vri]) => {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.072, 0.009, 2, 0.004), hvit); p.position.set(x, 0, 0.006); p.rotation.z = vri; g.add(p);
  });
  const kam = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.088, 0.008), krom); kam.position.set(-0.165, 0, 0.005); g.add(kam);
  for (const [x, y] of [[-0.125, -0.085], [-0.155, -0.1], [-0.19, -0.105]]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.016, 20), hvit); k.rotation.x = π / 2; k.position.set(x, y, 0.009); g.add(k);
  }
  const bryter = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.014), hvit); bryter.position.set(-0.075, -0.098, 0.008); bryter.rotation.z = 0.6; g.add(bryter);
  // hals og gripebrett (mensur 64,8 cm: salen ved x = -0,178, sadelen ved x = 0,47)
  const hals = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.048, 0.022), lønn); hals.position.set(0.255, 0, -0.008); hals.castShadow = true; g.add(hals);
  const brett = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.05, 0.006), palisander); brett.position.set(0.265, 0, 0.006); g.add(brett);
  for (let n = 1; n <= 21; n++) {
    const x = 0.47 - 0.648 * (1 - Math.pow(2, -n / 12));
    if (x < 0.065) break;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.05, 0.0025), krom); b.position.set(x, 0, 0.0095); g.add(b);
  }
  for (const n of [3, 5, 7, 9, 12, 15]) {                                  // markeringer på gripebrettet
    const x = 0.47 - 0.648 * (1 - Math.pow(2, -(n - 0.5) / 12));
    for (const y of n === 12 ? [-0.012, 0.012] : [0]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 12), hvit); d.position.set(x, y, 0.0092); g.add(d); }
  }
  const sadel = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.048, 0.005), hvit); sadel.position.set(0.47, 0, 0.0095); g.add(sadel);
  // Strat-hode med seks stemmeskruer på én side
  ekstruder(form([[0.47, -0.024], [0.5, -0.03], [0.6, -0.022], [0.665, -0.03], [0.68, -0.012], [0.665, 0.01], [0.6, 0.035], [0.54, 0.052], [0.5, 0.04], [0.47, 0.024]]),
    0.012, 0.002, lønn, -0.014);
  for (let k = 0; k < 6; k++) {
    const x = 0.505 + k * 0.03, y = 0.03 - k * 0.0095;
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.012, 10), krom); s1.rotation.x = π / 2; s1.position.set(x, y, 0.004); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.006), krom); s2.position.set(x, y + 0.017, -0.018); g.add(s2);
  }
  // strengene
  const strenger = [];
  for (let k = 0; k < 6; k++) {
    const yB = (k - 2.5) * 0.0105, yN = (k - 2.5) * 0.0072;
    strenger.push(-0.168, yB, 0.011, 0.47, yN, 0.011, 0.47, yN, 0.011, 0.505 + (5 - k) * 0.03, 0.03 - (5 - k) * 0.0095, 0.009);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(strenger, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xe8e8e8 })));
  return g;
}

// ---------- Ting i huset ----------
const koppMaskin = lagKopp(); koppMaskin.position.set(1.545, 0.935, 9.30); koppMaskin.visible = false; scene.add(koppMaskin);
// middag på spisebordet: tallerken med mat og et glass vann
const middag = new THREE.Group();
{
  const hvit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const tallerken = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.02, 32), hvit); tallerken.position.y = 0.01; middag.add(tallerken);
  for (const [x, z, r, f] of [[-0.04, -0.02, 0.05, 0xd9b26a], [0.045, 0.02, 0.045, 0x5f8f3e], [0.0, 0.055, 0.04, 0x8a4a2c]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8), new THREE.MeshStandardMaterial({ color: f, roughness: 0.8 }));
    m.scale.y = 0.35; m.position.set(x, 0.025, z); middag.add(m);
  }
  const vannglass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xdfeef2, roughness: 0.05, transparent: true, opacity: 0.4 }));
  vannglass.position.set(0.22, 0.06, 0.05); middag.add(vannglass);
  middag.position.set(2.10, G1 + 0.75, 5.00); middag.visible = false; scene.add(middag);
}
// damp fra koppen og dusjen: noen myke, gjennomsiktige skyer som stiger og blir borte
const damp = new THREE.Group();
{
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tekstur = new THREE.CanvasTexture(c);
  for (let i = 0; i < 6; i++) damp.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tekstur, transparent: true, depthWrite: false })));
  damp.visible = false; scene.add(damp);
}
function visDamp(p, tt) {
  const stor = p.y > F + 1;                                               // dusjen damper mer enn koppen
  damp.visible = true;
  damp.children.forEach((sp, i) => {
    const u = (tt * 0.5 + i / 6) % 1;
    sp.position.set(p.x + Math.sin(i * 2.3 + tt) * (stor ? 0.25 : 0.02), p.y + u * (stor ? 0.6 : 0.18), p.z + Math.cos(i * 1.7 + tt) * (stor ? 0.25 : 0.02));
    const r = (stor ? 0.35 : 0.06) * (0.5 + u);
    sp.scale.set(r, r, 1); sp.material.opacity = (stor ? 0.45 : 0.6) * Math.sin(u * π);
  });
}
// vannstråler fra dusjhodet
const vann = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 }));
{
  const n = 70, pos = new Float32Array(n * 6);
  vann.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vann.userData.frø = Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12345.678 % 1, (i * 0.618) % 1]);
  vann.visible = false; vann.frustumCulled = false; scene.add(vann);
}
function oppdaterVann(tt) {
  const pos = vann.geometry.attributes.position.array, topp = G2 + 2.02;
  vann.userData.frø.forEach(([a, b, fase], i) => {
    const v = a * 2 * π, r = Math.abs(b) * 0.09, u = (tt * 2.2 + fase) % 1;
    const x = 0.52 + Math.cos(v) * r * (1 + u * 0.6), z = 5.05 + Math.sin(v) * r * (1 + u * 0.6), y = topp - u * 2.0;
    pos.set([x, y, z, x, y - 0.12, z], i * 6);
  });
  vann.geometry.attributes.position.needsUpdate = true;
}
// stekepanne på koketoppen mens figuren steker
const panne = new THREE.Group();
{
  const svart = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.04, 32), svart); p1.position.y = 0.02; panne.add(p1);
  const mat1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0xc58a4a, roughness: 0.8 }));
  mat1.position.y = 0.035; panne.add(mat1);
  const skaft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.03), svart); skaft.position.set(0.22, 0.035, 0); panne.add(skaft);
  panne.position.set(0.64, 0.91, 8.42); panne.visible = false; scene.add(panne);
}
// «Zzz» over hodet mens figuren sover
const zzz = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d'); g.font = 'bold 44px system-ui'; g.fillStyle = '#ffffff'; g.strokeStyle = '#4b3324'; g.lineWidth = 6;
  g.strokeText('Zzz', 8, 48); g.fillText('Zzz', 8, 48);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(0.4, 0.2, 1); sp.visible = false; scene.add(sp); return sp;
})();

export { lagHåndting, lagStratocaster, koppMaskin, middag, damp, visDamp, vann, oppdaterVann, panne, zzz };
