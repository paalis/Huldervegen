// Lyder som lages i nettleseren (Web Audio) for handlingene som ikke har en lydfil i lyder/: dusj, tannpuss,
// kaffe, middag, Netflix, garderobe, jakke og stemningen ute (vind, fugler, trafikk langt unna). Finnes det en
// ekte fil (se lyder/README.md), brukes den i stedet – disse er bare en reserve.
let ctx = null, støy = null;
function klar() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  if (!støy) {                                                             // to sekunder rosa-aktig støy, brukt i løkke
    støy = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = støy.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 3; }
  }
  return ctx;
}
// støykilde gjennom et filter, med egen styrke
function støykilde(ut, type, frek, q, styrke) {
  const k = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  k.buffer = støy; k.loop = true; k.loopStart = Math.random(); f.type = type; f.frequency.value = frek; f.Q.value = q; g.gain.value = styrke;
  k.connect(f).connect(g).connect(ut); k.start();
  return { k, f, g };
}
// en kort tone (klirr, fuglekvitter): frekvens fra → til, med rask demping
function pling(ut, t, fra, til, varighet, styrke, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(fra, t); o.frequency.exponentialRampToValueAtTime(til, t + varighet);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(styrke, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + varighet);
  o.connect(g).connect(ut); o.start(t); o.stop(t + varighet + 0.02);
}
// planlegger hendelser litt fram i tid (klirr, kvitter, stavelser) så lenge lyden går
function gjenta(fn, ms = 100) { const id = setInterval(fn, ms); return () => clearInterval(id); }
const tilfeldig = (a, b) => a + Math.random() * (b - a);

const LAGE = {
  dusj(ut) {                                                               // brus av vann mot fliser
    const a = støykilde(ut, 'bandpass', 2600, 0.6, 0.55), b = støykilde(ut, 'lowpass', 500, 0.7, 0.35);
    const stopp = gjenta(() => { a.f.frequency.setTargetAtTime(tilfeldig(2000, 3400), ctx.currentTime, 0.3); }, 400);
    return () => { stopp(); a.k.stop(); b.k.stop(); };
  },
  tenner(ut) {                                                             // korte børstestrøk, med pauser
    const a = støykilde(ut, 'highpass', 3500, 0.8, 0);
    let neste = ctx.currentTime;
    const stopp = gjenta(() => {
      while (neste < ctx.currentTime + 0.3) {
        const strøk = Math.random() < 0.08 ? 0.5 : 0.11;                    // innimellom en liten pause
        a.g.gain.setValueAtTime(0.02, neste); a.g.gain.linearRampToValueAtTime(strøk > 0.3 ? 0.02 : 0.32, neste + strøk * 0.4);
        a.g.gain.linearRampToValueAtTime(0.03, neste + strøk); neste += strøk;
      }
    });
    return () => { stopp(); a.k.stop(); };
  },
  kaffe(ut) {                                                              // kvern, så pumpe og kaffe som renner
    const t = ctx.currentTime, kvern = støykilde(ut, 'bandpass', 900, 1.2, 0), o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 95; og.gain.value = 0; o.connect(og).connect(ut); o.start();
    for (const g of [kvern.g.gain, og.gain]) { g.setValueAtTime(0, t + 0.9); g.linearRampToValueAtTime(g === og.gain ? 0.05 : 0.3, t + 1.0); g.setValueAtTime(g === og.gain ? 0.05 : 0.3, t + 3.2); g.linearRampToValueAtTime(0, t + 3.4); }
    const renn = støykilde(ut, 'bandpass', 700, 2, 0);
    renn.g.gain.setValueAtTime(0, t + 3.4); renn.g.gain.linearRampToValueAtTime(0.25, t + 3.8); renn.g.gain.setValueAtTime(0.25, t + 5.6); renn.g.gain.linearRampToValueAtTime(0, t + 6.2);
    const stopp = gjenta(() => { if (ctx.currentTime > t + 3.4 && ctx.currentTime < t + 6) renn.f.frequency.setTargetAtTime(tilfeldig(500, 1100), ctx.currentTime, 0.05); }, 90);
    return () => { stopp(); kvern.k.stop(); renn.k.stop(); o.stop(); };
  },
  middag(ut) {                                                             // bestikk mot tallerkenen, rolig rom
    const rom = støykilde(ut, 'lowpass', 400, 0.5, 0.05);
    const stopp = gjenta(() => {
      if (Math.random() < 0.09) { const t = ctx.currentTime + 0.05, f = tilfeldig(2600, 3600); pling(ut, t, f, f * 0.98, 0.25, 0.08); pling(ut, t, f * 1.61, f * 1.6, 0.15, 0.04); }
    });
    return () => { stopp(); rom.k.stop(); };
  },
  netflix(ut) {                                                            // stemmer fra TV-en (stavelser) og litt filmmusikk
    const tale = støykilde(ut, 'bandpass', 600, 1.5, 0);
    const pad = [220, 277, 330].map(f => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.012; o.connect(g).connect(ut); o.start(); return o; });
    let neste = ctx.currentTime;
    const stopp = gjenta(() => {
      while (neste < ctx.currentTime + 0.3) {
        const pause = Math.random() < 0.12, l = pause ? tilfeldig(0.4, 1.2) : tilfeldig(0.09, 0.2);
        if (!pause) { tale.f.frequency.setValueAtTime(tilfeldig(350, 1100), neste); tale.g.gain.setValueAtTime(0.0, neste); tale.g.gain.linearRampToValueAtTime(0.22, neste + l * 0.3); tale.g.gain.linearRampToValueAtTime(0.02, neste + l); }
        neste += l;
      }
    });
    return () => { stopp(); tale.k.stop(); pad.forEach(o => o.stop()); };
  },
  klær(ut) {                                                               // skapdøra knirker, så klær som rasler
    const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t + 0.3); o.frequency.linearRampToValueAtTime(260, t + 1.0);
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 8; g.gain.setValueAtTime(0, t + 0.3); g.gain.linearRampToValueAtTime(0.06, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 1.0);
    o.connect(f).connect(g).connect(ut); o.start(); o.stop(t + 1.1);
    return LAGE.jakke(ut, 1.2);
  },
  jakke(ut, fra = 0) {                                                     // tøy som rasler i korte rykk
    const r = støykilde(ut, 'highpass', 2200, 0.7, 0), start = ctx.currentTime + fra;
    const stopp = gjenta(() => { if (ctx.currentTime > start && Math.random() < 0.35) { const t = ctx.currentTime + 0.02, l = tilfeldig(0.08, 0.25); r.g.gain.setValueAtTime(0, t); r.g.gain.linearRampToValueAtTime(tilfeldig(0.1, 0.22), t + l * 0.3); r.g.gain.linearRampToValueAtTime(0, t + l); } });
    return () => { stopp(); r.k.stop(); };
  },
  ute(ut, sterk = 0.5) {                                                   // vind i kast og fugler som kvitrer
    const vind = støykilde(ut, 'lowpass', 500, 0.5, 0.12 * sterk * 2), trafikk = støykilde(ut, 'lowpass', 160, 0.7, 0.05);
    const stopp = gjenta(() => {
      vind.f.frequency.setTargetAtTime(tilfeldig(300, 900), ctx.currentTime, 1.2);
      vind.g.gain.setTargetAtTime(tilfeldig(0.05, 0.22) * sterk * 2, ctx.currentTime, 1.5);
      if (Math.random() < 0.06) {                                          // en fugl: noen raske kvitter
        const t = ctx.currentTime + 0.05, f = tilfeldig(2800, 5200), n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) pling(ut, t + i * tilfeldig(0.08, 0.14), f * tilfeldig(0.9, 1.15), f * tilfeldig(1.1, 1.4), 0.07, 0.035);
      }
    }, 250);
    return () => { stopp(); vind.k.stop(); trafikk.k.stop(); };
  },
  takterrasse(ut) { return LAGE.ute(ut, 0.8); },
  utsikt(ut) { return LAGE.ute(ut, 0.65); },
};
LAGE.netflix3 = LAGE.netflix;

export const harLyd = id => id in LAGE;
// start lyden for en handling; gir et objekt med pause() (som en Audio), så spillet kan stoppe den likt
export function lagLyd(id, styrke = 0.7) {
  if (!LAGE[id]) return null;
  klar();
  const ut = ctx.createGain(); ut.gain.value = 0; ut.connect(ctx.destination);
  ut.gain.linearRampToValueAtTime(styrke, ctx.currentTime + 0.4);          // tones inn
  const stopp = LAGE[id](ut);
  return {
    pause() {
      const t = ctx.currentTime; ut.gain.cancelScheduledValues(t); ut.gain.setValueAtTime(ut.gain.value, t); ut.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => { stopp(); ut.disconnect(); }, 450);
    },
    addEventListener() {},
  };
}
