// Kamerakuttet toner ting ut og inn i stedet for å skjule dem brått: mens en del er på vei bort eller
// tilbake, tegnes den med en gjennomsiktig kopi av materialet (delt mellom alle deler med samme materiale
// og samme trinn, så det ikke blir mange nye materialer). Helt borte = usynlig, helt tilbake = vanlig materiale.
const TRINN = 6, FART = 1 / 0.22;                                         // ca. 0,2 s inn eller ut
const kopier = new Map();                                                // materiale → [kopi per trinn]
const tilstand = new Map();                                              // del → { nivå 0–1, orig }
function kopi(m, trinn) {
  let liste = kopier.get(m);
  if (!liste) { liste = []; kopier.set(m, liste); }
  if (!liste[trinn]) {
    const k = m.clone(); k.transparent = true; k.depthWrite = false; k.opacity = m.opacity * trinn / TRINN;
    k.userData.toning = true; liste[trinn] = k;
  }
  return liste[trinn];
}
// bort: settet med deler som skal være borte nå. Alle andre som er tonet ut, tones inn igjen.
export function toneHvert(bort, dt) {
  for (const o of bort) if (!tilstand.has(o)) tilstand.set(o, { nivå: o.visible ? 1 : 0, orig: o.material });
  for (const [o, t] of tilstand) {
    const mål = bort.has(o) ? 0 : 1;
    t.nivå += Math.sign(mål - t.nivå) * Math.min(Math.abs(mål - t.nivå), dt * FART);
    if (t.nivå >= 1) { o.material = t.orig; o.visible = true; tilstand.delete(o); continue; }
    if (t.nivå <= 0) { o.material = t.orig; o.visible = false; continue; }
    o.visible = true;
    o.material = kopi(t.orig, Math.max(1, Math.round(t.nivå * TRINN)));
  }
}
// vis alt med en gang (bytte av kameramodus)
export function visAlt() {
  for (const [o, t] of tilstand) { o.material = t.orig; o.visible = true; }
  tilstand.clear();
}
// er delen tonet bort eller på vei bort/tilbake (kameraet skal behandle den som skjult)
export const toning = o => tilstand.has(o);
