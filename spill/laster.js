// Innlasting med fremdrift: huset bygges mens figuren (ca. 3 MB) og animasjonene (ca. 1 MB) lastes ned,
// og lasteskjermen viser hvor langt det har kommet. Filene mellomlagres av nettleseren (se vercel.json).
const deler = new Map();                                                 // navn → { vekt, andel }
let el = null;
function tegn() {
  el ??= document.getElementById('laster');
  if (!el) return;
  let sum = 0, vekt = 0;
  for (const d of deler.values()) { sum += d.vekt * d.andel; vekt += d.vekt; }
  const andel = vekt ? sum / vekt : 0, aktiv = [...deler].find(([, d]) => d.andel < 1);
  el.querySelector('.stolpe > i')?.style.setProperty('width', `${Math.round(andel * 100)}%`);
  const tekst = el.querySelector('.tekst');
  if (tekst) tekst.textContent = aktiv ? aktiv[0] : 'Klar';
}
// meld en del; returnerer en funksjon som tar andelen som er ferdig (0–1)
export function del(navn, vekt = 1) {
  deler.set(navn, { vekt, andel: 0 });
  tegn();
  return andel => { const d = deler.get(navn); if (d) { d.andel = Math.min(1, Math.max(d.andel, andel)); tegn(); } };
}
// hent en fil med fremdrift (som ArrayBuffer)
export async function hent(url, navn, vekt) {
  const meld = del(navn, vekt);
  const svar = await fetch(url);
  if (!svar.ok) { meld(1); throw new Error(`${url}: ${svar.status}`); }
  const total = +svar.headers.get('content-length') || 0;
  if (!svar.body || !total) { const b = await svar.arrayBuffer(); meld(1); return b; }
  const leser = svar.body.getReader(), biter = [];
  let lest = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    biter.push(value); lest += value.length; meld(lest / total);
  }
  meld(1);
  const ut = new Uint8Array(lest); let i = 0;
  for (const b of biter) { ut.set(b, i); i += b.length; }
  return ut.buffer;
}
// fjern lasteskjermen når alt er ferdig, eller senest etter maks millisekunder
export function nårFerdig(fn, maks = 25000) {
  const start = performance.now();
  const sjekk = () => {
    if ([...deler.values()].every(d => d.andel >= 1) || performance.now() - start > maks) fn();
    else setTimeout(sjekk, 100);
  };
  sjekk();
}
