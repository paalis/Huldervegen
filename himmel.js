// Himmel for spillet: blå himmel med gradient, sol i samme retning som sollyset, skyer som driver sakte,
// og et lite fly som av og til flyr rundt huset med et banner: «Huldervegen – Ranheims svar på Mekka!».
// Alt her er bare pynt: det kaster ikke skygge, kan ikke klikkes på og stenger ikke veien for figuren.
import * as THREE from 'three';

const BANNERTEKST = 'Huldervegen – Ranheims svar på Mekka!';
const urørlig = o => { o.traverse(d => { d.raycast = () => {}; d.castShadow = false; d.receiveShadow = false; d.userData.pynt = true; }); return o; };
const lerret = (b, h, tegn) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  tegn(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
// flate som alltid vender mot kameraet (i stedet for Sprite, så skyggeeffekten ikke farger den)
const tavle = (tekstur, b, h, opasitet = 1) => new THREE.Mesh(new THREE.PlaneGeometry(b, h),
  new THREE.MeshBasicMaterial({ map: tekstur, transparent: true, opacity: opasitet, depthWrite: false, fog: false, toneMapped: false }));

export function lagHimmel(scene, sol, midt) {
  const gruppe = new THREE.Group();
  scene.add(gruppe);

  // himmelkuppel: dyp blå øverst, lys dis ved horisonten, dempet grønt under
  const kuppel = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true, fog: false, toneMapped: false,
    uniforms: { topp: { value: new THREE.Color('#3f86d8') }, horisont: { value: new THREE.Color('#d4e8f6') }, bunn: { value: new THREE.Color('#a9b99c') } },
    vertexShader: 'varying vec3 vRetning; void main() { vRetning = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 topp; uniform vec3 horisont; uniform vec3 bunn; varying vec3 vRetning;
      void main() {
        float y = vRetning.y;
        vec3 c = y > 0.0 ? mix(horisont, topp, pow(clamp(y * 1.6, 0.0, 1.0), 0.7)) : mix(horisont, bunn, clamp(-y * 6.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  kuppel.renderOrder = -10;
  gruppe.add(kuppel);

  // sola: varm kjerne med glød, der sollyset kommer fra
  const solRetning = new THREE.Vector3().subVectors(sol.position, sol.target.position).normalize();
  const solskive = tavle(lerret(256, 256, (g, b) => {
    const gr = g.createRadialGradient(b / 2, b / 2, 0, b / 2, b / 2, b / 2);
    gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.12, 'rgba(255,250,220,1)'); gr.addColorStop(0.2, 'rgba(255,230,160,0.55)');
    gr.addColorStop(0.5, 'rgba(255,220,150,0.15)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, b, b);
  }), 60, 60);
  solskive.renderOrder = -9;
  gruppe.add(solskive);

  // skyer: myke dotter tegnet av mange overlappende sirkler
  const skyTekstur = lerret(512, 256, (g, b, h) => {
    for (let i = 0; i < 40; i++) {
      const x = b * (0.15 + 0.7 * Math.random()), y = h * (0.45 + 0.25 * Math.random() - 0.1 * Math.abs(x / b - 0.5)), r = h * (0.12 + 0.18 * Math.random());
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  });
  const skyer = [];
  for (let i = 0; i < 16; i++) {
    const v = (i / 16) * Math.PI * 2 + Math.random() * 0.3, r = 55 + Math.random() * 70, s = 26 + Math.random() * 30;
    const sky = tavle(skyTekstur, s, s * 0.5, 0.75 + Math.random() * 0.2);
    sky.position.set(midt.x + Math.cos(v) * r, 32 + Math.random() * 30, midt.z + Math.sin(v) * r);
    sky.renderOrder = -8;
    skyer.push(sky); gruppe.add(sky);
  }

  // flyet med banner
  const fly = new THREE.Group();
  {
    const hvit = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.4 }), rød = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
    const kropp = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 3.2, 6, 14), hvit); kropp.rotation.z = Math.PI / 2; fly.add(kropp);
    const vinge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 6.4), hvit); vinge.position.set(0.4, 0.15, 0); fly.add(vinge);
    const hale = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.2), hvit); hale.position.set(-1.9, 0.2, 0); fly.add(hale);
    const ror = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.08), rød); ror.position.set(-1.9, 0.65, 0); fly.add(ror);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.92), rød); stripe.position.set(0.1, 0, 0); fly.add(stripe);
    const propell = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.16), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    propell.position.set(2.15, 0, 0); fly.add(propell); fly.userData.propell = propell;
  }
  const bannerB = 22, bannerH = 2.6;
  const bannerGeo = new THREE.PlaneGeometry(bannerB, bannerH, 24, 1);
  const banner = new THREE.Mesh(bannerGeo, new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide, roughness: 0.8,
    map: lerret(2048, 256, (g, b, h) => {
      g.fillStyle = '#fffaf0'; g.fillRect(0, 0, b, h);
      g.strokeStyle = '#c0392b'; g.lineWidth = 14; g.strokeRect(7, 7, b - 14, h - 14);
      g.font = '800 128px "Arial Black", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#4b3324'; g.fillText(BANNERTEKST, b / 2, h / 2 + 6, b - 80);
    }),
  }));
  const tau = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x555555 }));
  tau.frustumCulled = false;
  const flyGruppe = new THREE.Group();
  flyGruppe.add(fly, banner, tau);
  urørlig(gruppe); urørlig(flyGruppe);
  flyGruppe.visible = false;
  scene.add(flyGruppe);
  const bannerX = bannerGeo.attributes.position.array.filter((_, i) => i % 3 === 0);

  // flyrute: en sirkel rundt huset; flyet kommer etter 8 sekunder og deretter hvert annet minutt
  const R = 42, HØYDE = 26, OMLØP = 34, PAUSE = 120;
  let tid = PAUSE - 8;
  const p = new THREE.Vector3(), sentrum = new THREE.Vector3(midt.x, HØYDE, midt.z);
  const punkt = v => p.set(midt.x + Math.cos(v) * R, HØYDE + Math.sin(v * 2) * 1.5, midt.z + Math.sin(v) * R).clone();
  const retning = v => new THREE.Vector3(-Math.sin(v), 0, Math.cos(v));       // fartsretning for økende vinkel

  return {
    gruppe, flyGruppe,
    oppdater(dt, kamera) {
      kuppel.position.copy(kamera.position);
      solskive.position.copy(kamera.position).addScaledVector(solRetning, 150);
      solskive.quaternion.copy(kamera.quaternion);
      for (const sky of skyer) {
        sky.position.x += dt * 0.6;                                            // svak vind
        if (sky.position.x > midt.x + 130) sky.position.x -= 260;
        sky.quaternion.copy(kamera.quaternion);
      }
      // fly
      tid += dt;
      const fase = tid % PAUSE;
      flyGruppe.visible = fase < OMLØP;
      if (!flyGruppe.visible) return;
      const v = (fase / OMLØP) * Math.PI * 2 + Math.PI;                        // starter bak huset
      const fp = punkt(v), fr = retning(v);
      fly.position.copy(fp);
      fly.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fr);
      fly.rotateX(-0.35);                                                     // krenger innover i svingen
      fly.userData.propell.rotation.x += dt * 40;
      fly.updateMatrixWorld();
      // banneret henger etter på sirkelen, med teksten mot huset
      const vb = v - (6 + bannerB / 2) / R, bp = punkt(vb), mot = new THREE.Vector3().subVectors(sentrum, bp).setY(0).normalize();
      banner.position.copy(bp);
      const x = retning(vb), z = mot, y = new THREE.Vector3().crossVectors(z, x);
      banner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      // banneret blafrer litt, mest bakerst
      const pos = bannerGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = bannerX[i], bak = (bannerB / 2 - bx) / bannerB;
        pos.setZ(i, Math.sin(bx * 0.55 + tid * 7) * 0.35 * bak);
      }
      pos.needsUpdate = true; bannerGeo.computeVertexNormals();
      banner.updateMatrixWorld();
      const front = new THREE.Vector3(bannerB / 2, 0, 0).applyMatrix4(banner.matrixWorld);
      const hale = new THREE.Vector3(-2.2, 0, 0).applyMatrix4(fly.matrixWorld);
      tau.geometry.attributes.position.setXYZ(0, hale.x, hale.y, hale.z);
      tau.geometry.attributes.position.setXYZ(1, front.x, front.y, front.z);
      tau.geometry.attributes.position.needsUpdate = true;
    },
  };
}
