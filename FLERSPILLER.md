# Flerspiller i spillet (Firebase)

I `spill.html` kan flere logge inn samtidig og gå rundt i huset sammen. Hver person har sin egen figur,
og navnet står over hodet. Alle ser hverandre gå, ta trappene og gjøre handlinger. En plass som en
annen bruker, for eksempel sofaen eller pianokrakken, er merket «opptatt».

Innlogging og sanntid går via **Firebase** fra Google. Gratisplanen («Spark») krever ikke
betalingskort og holder godt til familie og venner.

Så lenge `firebase-config.js` inneholder `null`, virker spillet som før, bare alene. Under
**👥 Spill med andre** kan du likevel lage din egen figur.

## Oppsett (ca. 10 minutter, én gang)

### 1. Opprett et Firebase-prosjekt
1. Gå til <https://console.firebase.google.com> og logg inn med Google-kontoen din.
2. Velg **Opprett et prosjekt** (Create a project). Kall det for eksempel `huldervegen`.
3. Google Analytics trengs ikke og kan slås av. Velg **Opprett prosjekt**.

### 2. Slå på innlogging
1. I menyen til venstre velger du **Build → Authentication → Kom i gang** (Get started).
2. Åpne fanen **Sign-in method** og slå på:
   - **Google**: velg e-postadressen din som støtteadresse og lagre.
   - **E-post/passord** (Email/Password): slå på den første bryteren og lagre. Spillet bruker denne
     for innlogging med brukernavn og passord (brukernavnet gjøres om til en usynlig adresse
     `brukernavn@huldervegen.spill`, så ingen trenger å oppgi e-post).
3. Åpne fanen **Settings → Authorized domains** og velg **Add domain**. Legg til `huldervegen.vercel.app`.

### 3. Opprett sanntidsdatabasen
1. Gå til **Build → Realtime Database → Opprett database** (Create database).
2. Velg lokasjonen **Belgium (europe-west1)**, som er nærmest Norge.
3. Velg **Start i låst modus** (locked mode).
4. Åpne fanen **Regler** (Rules) og erstatt alt med innholdet i
   [`database.rules.json`](database.rules.json) her i repoet. Trykk **Publiser**.

Reglene betyr:
- Bare innloggede kan se hvem som er i huset.
- Hver bruker kan bare endre sin egen figur.
- Figurprofilen din er privat.

### 4. Registrer nettsiden og hent konfigurasjonen
1. Trykk tannhjulet øverst til venstre og velg **Prosjektinnstillinger** (Project settings).
2. Under **Dine apper** (Your apps) trykker du web-ikonet **`</>`**. Kall appen `huldervegen`.
   Firebase Hosting trengs ikke.
3. Du får se et kodeutdrag med `const firebaseConfig = { ... }`. Kopier verdiene til
   [`firebase-config.js`](firebase-config.js), slik at fila ser omtrent slik ut:

   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "huldervegen-xxxx.firebaseapp.com",
     databaseURL: "https://huldervegen-xxxx-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "huldervegen-xxxx",
     storageBucket: "huldervegen-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```

   Sjekk at **`databaseURL`** er med. Mangler den, finner du adressen øverst på siden
   **Realtime Database**.

Du kan også bare sende verdiene til Claude, så legger Claude dem inn og publiserer. Verdiene er
ikke hemmelige, for tilgangen styres av reglene i steg 3.

## Bruk
- Trykk **👥 Logg inn og spill med andre** i panelet.
- Logg inn med Google, eller med brukernavn og passord. Første gang trykker man «Lag ny bruker».
- Glemt passord: slett brukeren under **Authentication → Users** i Firebase-konsollen
  (den heter `brukernavn@huldervegen.spill`), så kan personen lage den på nytt.
- Under **Din figur** velger du navn, hudfarge, hårfarge og frisyre, skjegg, klær og høyde.
  🎲 gir en tilfeldig figur. Figuren lagres på kontoen din og i nettleseren.
- Øverst til høyre ser du hvem som er i huset, hvilken etasje de er i, og hva de gjør.
- Lukker du siden eller mister nettet, forsvinner figuren din for de andre etter noen sekunder.

## Bare for familien?
Med reglene over kan alle som har en Google-konto, eller som lager en konto, logge inn. Slik
begrenser du tilgangen til bestemte personer:

1. La hver person logge inn én gang.
2. Finn ID-en deres under **Authentication → Users**, i kolonnen «User UID».
3. Under **Realtime Database → Data** lager du en node `tillatte` med én linje per person:
   `UID: true`.
4. Bytt ut `"auth != null"` i reglene med
   `"auth != null && root.child('tillatte').child(auth.uid).exists()"`.

## Teknisk
- `flerspiller.js` håndterer innlogging og sanntid. Firebase-biblioteket lastes fra gstatic.com,
  versjon 10.14.1.
- Hver spiller ligger i `spillere/{uid}` med navn, utseende, etasje, posisjon, retning og handling.
  Den oppdateres ca. 8 ganger i sekundet når figuren beveger seg, ellers hvert 4. sekund. Serveren
  fjerner noden når forbindelsen brytes (`onDisconnect`).
- Utseende og navn lagres i `profiler/{uid}`.
- Gratiskvoten er ca. 100 samtidige tilkoblinger og 10 GB nedlasting i måneden. Til en håndfull
  spillere brukes bare en liten del av den.
