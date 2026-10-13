// Flerspiller for spill.html: innlogging og sanntid via Firebase (Authentication + Realtime Database).
// Hver innlogget spiller har en node spillere/{uid} med navn, utseende og posisjon. Noden fjernes av
// serveren når nettleseren lukkes eller mister nettet (onDisconnect). Utseendet lagres i profiler/{uid}.
// Med { test: true } som konfigurasjon brukes en lokal erstatning (BroadcastChannel) mellom faner i samme
// nettleser, uten Firebase – for testing.
const V = '10.14.1', CDN = `https://www.gstatic.com/firebasejs/${V}/`;

export async function kobleTil(config) {
  if (config?.test) return testKobling();
  const [{ initializeApp }, A, D] = await Promise.all([
    import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-database.js'),
  ]);
  const app = initializeApp(config), auth = A.getAuth(app), db = D.getDatabase(app);
  let minRef = null, sist = null, tilkoblet = null;
  const api = {
    påBruker: cb => A.onAuthStateChanged(auth, u => cb(u && { uid: u.uid, navn: u.displayName || (u.email || '').split('@')[0] })),
    google: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    epost: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    nyKonto: (e, p) => A.createUserWithEmailAndPassword(auth, e, p),
    glemtPassord: e => A.sendPasswordResetEmail(auth, e),
    async loggUt() { await api.forlat(); await A.signOut(auth); },
    hentProfil: async uid => (await D.get(D.ref(db, `profiler/${uid}`))).val(),
    lagreProfil: (uid, p) => D.set(D.ref(db, `profiler/${uid}`), p),
    // gå inn i huset: skriv egen node og be serveren fjerne den når forbindelsen brytes
    async bliMed(uid, data) {
      minRef = D.ref(db, `spillere/${uid}`); sist = data;
      await D.onDisconnect(minRef).remove();
      await D.set(minRef, { ...data, tid: D.serverTimestamp() });
      // etter et brudd har serveren fjernet noden: skriv den på nytt når forbindelsen er tilbake
      tilkoblet ??= D.onValue(D.ref(db, '.info/connected'), s => {
        if (s.val() && minRef) { D.onDisconnect(minRef).remove(); D.set(minRef, { ...sist, tid: D.serverTimestamp() }); }
      });
    },
    send(data) {
      if (!minRef) return;
      sist = { ...sist, ...data };
      D.update(minRef, { ...data, tid: D.serverTimestamp() }).catch(() => {});
    },
    async forlat() {
      if (!minRef) return;
      const r = minRef; minRef = null;
      await D.onDisconnect(r).cancel(); await D.set(r, null);
    },
    // cb('ny' | 'endret', uid, data) og cb('borte', uid)
    lytt(cb) {
      const r = D.ref(db, 'spillere');
      D.onChildAdded(r, s => cb('ny', s.key, s.val()));
      D.onChildChanged(r, s => cb('endret', s.key, s.val()));
      D.onChildRemoved(r, s => cb('borte', s.key));
    },
  };
  return api;
}

// Lokal erstatning for testing: samme grensesnitt, meldinger mellom faner via BroadcastChannel.
function testKobling() {
  const kanal = new BroadcastChannel('huldervegen-test'), spillere = new Map();
  let bruker = null, minData = null, brukerCb = () => {}, lytter = () => {};
  const loggInn = navn => { bruker = { uid: 'u' + Math.random().toString(36).slice(2, 8), navn }; brukerCb(bruker); };
  kanal.onmessage = ({ data: m }) => {
    if (m.type === 'hei' && minData) kanal.postMessage({ type: 'data', uid: bruker.uid, data: minData });
    if (m.type === 'data') { const ny = !spillere.has(m.uid); spillere.set(m.uid, m.data); lytter(ny ? 'ny' : 'endret', m.uid, m.data); }
    if (m.type === 'borte') { spillere.delete(m.uid); lytter('borte', m.uid); }
  };
  addEventListener('pagehide', () => api.forlat());
  const api = {
    påBruker: cb => { brukerCb = cb; cb(bruker); },
    google: async () => loggInn('Google-test'),
    epost: async e => loggInn(e.split('@')[0]),
    nyKonto: async e => loggInn(e.split('@')[0]),
    glemtPassord: async () => {},
    async loggUt() { await api.forlat(); bruker = null; brukerCb(null); },
    hentProfil: async () => null,
    lagreProfil: async () => {},
    async bliMed(uid, data) { minData = data; kanal.postMessage({ type: 'data', uid, data }); },
    send(data) { if (!minData) return; minData = { ...minData, ...data }; kanal.postMessage({ type: 'data', uid: bruker.uid, data: minData }); },
    async forlat() { if (minData && bruker) kanal.postMessage({ type: 'borte', uid: bruker.uid }); minData = null; },
    lytt(cb) { lytter = cb; kanal.postMessage({ type: 'hei' }); },
  };
  return api;
}
