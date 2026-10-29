// Dagsrytme: en klokke styrer sola over himmelen (opp i øst om morgenen, høyest i sør, ned i vest om
// kvelden), himmelens farger, stjerner og måne om natta, og hvor lyst det er ute og inne. Klokka har tre
// moduser (velges med klokkeknappen): «rask dag» (et døgn på 24 minutter, lik for alle spillere fordi den
// regnes ut fra klokkeslettet), «ekte tid» (klokka på maskinen) og «alltid dag» (13:00).
import * as THREE from 'three';

const MODUSER = [
  { id: 'rask', navn: 'Rask dag (et døgn på 24 minutter)' },
  { id: 'ekte', navn: 'Ekte tid' },
  { id: 'dag', navn: 'Alltid dag' },
];
const OPP = 5.5, NED = 21.5, MIDDAG = (OPP + NED) / 2, HØYDE = 52 * Math.PI / 180;   // sommer i Trøndelag
const glatt = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

export function lagDag({ scene, sol, himmel, midt }) {
  const hemi = scene.children.find(o => o.isHemisphereLight);
  const dagHemi = hemi.intensity, dagSol = sol.intensity, solFarge = sol.color.clone();
  const bakgrunn = scene.background?.isColor ? scene.background.clone() : null;
  let modus = (() => { try { return localStorage.getItem('huldervegen-klokke') || 'rask'; } catch { return 'rask'; } })();
  if (!MODUSER.some(m => m.id === modus)) modus = 'rask';
  const tilstand = { time: 13, dagslys: 1, gylden: 0, retning: new THREE.Vector3() };

  let fast = null;                                                        // satt klokke (testing)
  function klokke() {                                                     // timer etter midnatt, 0–24
    if (fast !== null) return fast;
    if (modus === 'dag') return 13;
    if (modus === 'ekte') { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
    return (Date.now() / 60000 + 10) % 24;                                 // ett døgn = 24 minutter, lik for alle
  }
  function oppdater() {
    const t = klokke();
    tilstand.time = t;
    // solas høyde og retning: buen går fra nordøst via sør (−z, mot hagen) til nordvest
    const dag = (t - OPP) / (NED - OPP);
    const h = Math.sin(Math.PI * dag) * HØYDE - (dag < 0 || dag > 1 ? 0.25 : 0);
    const a = Math.PI * (t - MIDDAG) / 12;                                 // 0 = sør, økende vestover
    tilstand.retning.set(-Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h)).normalize();
    const grader = h * 180 / Math.PI;
    tilstand.dagslys = glatt(-7, 9, grader);
    tilstand.gylden = glatt(-6, 2, grader) * (1 - glatt(6, 16, grader));
    // lyset: sola er oppe eller under horisonten, himmellyset blir blått og svakt om natta
    const s = Math.max(tilstand.retning.y, 0.12);                          // skyggene blir lange, men ikke uendelige
    sol.position.copy(midt).add(new THREE.Vector3(tilstand.retning.x, s, tilstand.retning.z).normalize().multiplyScalar(18));
    sol.target.position.copy(midt); sol.target.updateMatrixWorld();
    sol.intensity = dagSol * glatt(-1, 8, grader);
    sol.color.copy(solFarge).lerp(new THREE.Color(0xffa860), tilstand.gylden * 0.8);
    hemi.intensity = 0.16 + (dagHemi - 0.16) * tilstand.dagslys;
    hemi.color.setRGB(0.55 + 0.45 * tilstand.dagslys, 0.62 + 0.38 * tilstand.dagslys, 0.85 + 0.15 * tilstand.dagslys);
    if (bakgrunn) scene.background.copy(new THREE.Color(0x0b1226)).lerp(bakgrunn, tilstand.dagslys);
    himmel?.settDag(tilstand.dagslys, tilstand.gylden, tilstand.retning);
  }
  const tekst = () => {
    const t = tilstand.time, hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
    const ikon = tilstand.dagslys < 0.3 ? '🌙' : tilstand.gylden > 0.4 ? '🌅' : '☀️';
    return `${ikon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  return {
    tilstand, oppdater, tekst,
    get modus() { return MODUSER.find(m => m.id === modus); },
    nesteModus() {
      modus = MODUSER[(MODUSER.findIndex(m => m.id === modus) + 1) % MODUSER.length].id;
      try { localStorage.setItem('huldervegen-klokke', modus); } catch { /* privat modus */ }
      oppdater();
    },
    // for testing: sett klokka direkte (null = følg modusen igjen)
    settTime(t) { fast = t; oppdater(); },
  };
}
