// Musikk i huset: musikkanlegg (i stua i 1. etasje og på kontoret) som spiller lo-fi, jazz eller egen musikk.
// Lo-fi og jazz lages mens de spilles (Web Audio: elpiano, bass og trommer etter faste akkordrekker), så det
// trengs ingen filer. Egen musikk: legg mp3-filer i musikk/ og list dem i musikk/liste.json. Lyden kommer
// fra anlegget: den blir svakere lenger unna og dempet gjennom gulv og tak.
import * as THREE from 'three';

const STASJONER = [
  { id: 'av', navn: 'Av' },
  { id: 'lofi', navn: 'Lo-fi' },
  { id: 'jazz', navn: 'Jazz' },
  { id: 'egen', navn: 'Egen musikk' },
];
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);                       // MIDI-nummer → frekvens

// ---------- Generert musikk ----------
// en enkel sekvenser: legger noter et lite stykke fram i tid, akkord for akkord
function lagSekvenser(ctx, ut, stil) {
  const lofi = stil === 'lofi';
  const tempo = lofi ? 76 : 132, slag = 60 / tempo;
  // akkorder som MIDI-toner (grunntone først); lo-fi: Fmaj7 Em7 Dm7 Cmaj7, jazz: ii-V-I-VI i C
  const AKKORDER = lofi
    ? [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    : [[50, 53, 57, 60], [43, 47, 50, 53], [48, 52, 55, 59], [45, 49, 52, 55]];
  const støy = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  { const d = støy.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const tone = (frek, t, varighet, styrke, type = 'sine', filter = 4000) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = frek; f.type = 'lowpass'; f.frequency.value = filter;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(styrke, t + 0.012);
    g.gain.exponentialRampToValueAtTime(styrke * 0.35, t + varighet * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + varighet);
    o.connect(f).connect(g).connect(ut); o.start(t); o.stop(t + varighet + 0.05);
  };
  const elpiano = (n, t, v, s) => { tone(NOTE(n), t, v, s, 'sine', 3000); tone(NOTE(n) * 2.003, t, v * 0.6, s * 0.18, 'triangle', 2500); };
  const slagverk = (t, type, s) => {
    if (type === 'tromme') {                                                // stortromme: sinus som faller i tone
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      g.gain.setValueAtTime(s, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(ut); o.start(t); o.stop(t + 0.32); return;
    }
    const k = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    k.buffer = støy; f.type = type === 'hihat' || type === 'ride' ? 'highpass' : 'bandpass';
    f.frequency.value = type === 'hihat' ? 7000 : type === 'ride' ? 5000 : 1800;
    const l = type === 'hihat' ? 0.05 : type === 'ride' ? 0.35 : 0.16;
    g.gain.setValueAtTime(s, t); g.gain.exponentialRampToValueAtTime(0.001, t + l);
    k.connect(f).connect(g).connect(ut); k.start(t, Math.random() * 0.5); k.stop(t + l + 0.02);
  };
  let neste = ctx.currentTime + 0.1, takt = 0;
  const legg = () => {                                                      // én takt (fire slag)
    const ak = AKKORDER[takt % AKKORDER.length], t0 = neste, sv = lofi ? 0.08 : 0.12;   // svikt (swing) på åttendelene
    const åtte = k => t0 + (k >> 1) * slag + (k & 1 ? slag * (0.5 + sv) : 0);
    if (lofi) {
      for (const n of ak) elpiano(n + 12, t0 + Math.random() * 0.02, slag * 3.8, 0.07);
      if (takt % 2) for (const n of ak.slice(1)) elpiano(n + 12, åtte(5), slag * 1.2, 0.04);
      tone(NOTE(ak[0] - 12), t0, slag * 1.7, 0.22, 'sine', 400); tone(NOTE(ak[0] - 12), t0 + slag * 2.5, slag * 1.2, 0.16, 'sine', 400);
      slagverk(t0, 'tromme', 0.5); slagverk(åtte(5), 'tromme', 0.35);
      slagverk(t0 + slag, 'skarptromme', 0.18); slagverk(t0 + slag * 3, 'skarptromme', 0.18);
      for (let k = 0; k < 8; k++) slagverk(åtte(k), 'hihat', k & 1 ? 0.05 : 0.08);
      if (Math.random() < 0.6) {                                            // en liten melodi i pentaton over
        const skala = [72, 74, 76, 79, 81, 84];
        for (let k = 0; k < 3; k++) if (Math.random() < 0.6) elpiano(skala[(Math.random() * skala.length) | 0], åtte(2 + k * 2), slag * 0.9, 0.05);
      }
    } else {
      // gående bass i fjerdedeler, ride-mønster, piano som komper på offslag
      const bass = [ak[0], ak[1], ak[2], ak[2] + 2 - (Math.random() < 0.5 ? 3 : 0)];
      bass.forEach((n, k) => tone(NOTE(n - 12), t0 + k * slag, slag * 0.95, 0.24, 'triangle', 700));
      for (const k of [0, 2, 3, 4, 6, 7]) slagverk(åtte(k), 'ride', k === 3 || k === 7 ? 0.04 : 0.07);
      slagverk(t0 + slag, 'hihat', 0.06); slagverk(t0 + slag * 3, 'hihat', 0.06);
      for (const k of [1, 3, 5, 6]) if (Math.random() < 0.45) for (const n of ak.slice(1)) elpiano(n + 12, åtte(k), slag * 0.7, 0.045);
      if (Math.random() < 0.7) for (let k = 0; k < 8; k++) if (Math.random() < 0.35) elpiano(ak[k % 4] + 24 + (k % 3 ? 2 : 0), åtte(k), slag * 0.45, 0.04);
    }
    neste += slag * 4; takt++;
  };
  const tikk = () => { while (neste < ctx.currentTime + 0.4) legg(); };
  tikk();
  const id = setInterval(tikk, 120);
  return () => clearInterval(id);
}

// ---------- Anleggene ----------
export function lagMusikk({ anlegg }) {
  let ctx = null, egenListe = null;
  const hentListe = () => egenListe ??= fetch('musikk/liste.json').then(r => (r.ok ? r.json() : [])).catch(() => []);
  const lag = () => {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    for (const a of anlegg) if (!a.ut) {
      a.ut = ctx.createGain(); a.filter = ctx.createBiquadFilter(); a.panner = ctx.createPanner();
      a.filter.type = 'lowpass'; a.filter.frequency.value = 18000;
      Object.assign(a.panner, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 1.6, rolloffFactor: 1.3, maxDistance: 40 });
      a.panner.positionX.value = a.punkt.x; a.panner.positionY.value = a.punkt.y; a.panner.positionZ.value = a.punkt.z;
      a.ut.connect(a.filter).connect(a.panner).connect(ctx.destination);
    }
  };
  function stopp(a) {
    a.stoppSekvenser?.(); a.stoppSekvenser = null;
    if (a.lydfil) { a.lydfil.pause(); a.lydfil = null; }
  }
  async function spill(a) {
    stopp(a);
    const st = STASJONER[a.stasjon].id;
    if (st === 'lofi' || st === 'jazz') a.stoppSekvenser = lagSekvenser(ctx, a.ut, st);
    else if (st === 'egen') {
      const liste = await hentListe();
      if (!liste.length) return false;
      let i = (Math.random() * liste.length) | 0;
      const el = new Audio(); el.crossOrigin = 'anonymous';
      const kilde = ctx.createMediaElementSource(el); kilde.connect(a.ut);
      const neste = () => { el.src = `musikk/${encodeURIComponent(liste[i++ % liste.length])}`; el.play().catch(() => {}); };
      el.addEventListener('ended', neste); neste();
      a.lydfil = el;
    }
    return true;
  }
  addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  return {
    anlegg, STASJONER,
    stasjon: a => STASJONER[a.stasjon],
    // neste stasjon på anlegget (av → lo-fi → jazz → egen → av); egen hoppes over om musikk/liste.json mangler
    async neste(a) {
      lag();
      for (let forsøk = 0; forsøk < STASJONER.length; forsøk++) {
        a.stasjon = (a.stasjon + 1) % STASJONER.length;
        if (STASJONER[a.stasjon].id === 'av') { stopp(a); a.led && (a.led.material.emissiveIntensity = 0); return STASJONER[a.stasjon]; }
        if (await spill(a)) { a.led && (a.led.material.emissiveIntensity = 2); return STASJONER[a.stasjon]; }
      }
      return STASJONER[a.stasjon];
    },
    // hvert bilde: lytteren er kameraet; gjennom gulv og tak blir det svakere og mer dempet
    oppdater(kamera, f) {
      if (!ctx) return;
      const l = ctx.listener, p = kamera.position, fram = new THREE.Vector3(0, 0, -1).applyQuaternion(kamera.quaternion);
      if (l.positionX) { l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z; l.forwardX.value = fram.x; l.forwardY.value = fram.y; l.forwardZ.value = fram.z; }
      else { l.setPosition(p.x, p.y, p.z); l.setOrientation(fram.x, fram.y, fram.z, 0, 1, 0); }
      for (const a of anlegg) if (a.ut) {
        const etg = Math.abs(a.f - f);
        a.ut.gain.setTargetAtTime(etg === 0 ? 1 : etg === 1 ? 0.35 : 0.12, ctx.currentTime, 0.2);
        a.filter.frequency.setTargetAtTime(etg === 0 ? 18000 : etg === 1 ? 900 : 500, ctx.currentTime, 0.2);
      }
    },
  };
}
