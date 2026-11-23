# Huldervegen

Interaktiv 3D-visning av huset, bygget fra romtegninger og bilder.

- `stil.css` – felles utseende (farger, font, knapper) for 3D-visningen og spillet
- `index.html` – startside og 3D-modellen med knapper for etasjer, visninger og video, og «⬇ Last ned 3D-modell»
  (`eksport.js` lager en .glb av huset i nettleseren, til SketchUp, Blender o.l.)
- `spill.html` – gå rundt i huset med en figur (klikk for å gå, piltaster/WASD, trapper mellom etasjene)
  og handlinger: piano, gitar, PlayStation, Netflix (1. og 3. etasje), vaskemaskin, gå på do, vaske hendene, steke mat, sove,
  spise middag, lage kaffe, slappe av ute og på takterrassen, gå inn og ut, dusje, pusse tennene,
  skifte T-skjorte og se utover fra altanen
  - Dagsrytme (klokka nede til høyre: rask dag på 24 minutter, ekte tid eller alltid dag), lys i alle rom med
    brytere ved dørene (slås på av seg selv om kvelden), og musikkanlegg i stua og på kontoret (🎵) med lo-fi,
    jazz eller egen musikk (se `musikk/README.md`)
  - Koden ligger i `spill/`: `main.js` (oppsett, handlinger, kamera og flerspiller), `gangkart.js` (gangbare
    ruter, trapper og veifinning), `figur.js` (figurer og 3D-modell), `animasjon.js` (Mixamo-animasjoner),
    `hender.js` (ting i hånda og arm-IK), `rekvisitter.js`, `dorer.js`, `rom.js`, `dag.js`, `lys.js`,
    `musikk.js`, `lyder.js` (lyder som lages når lydfila mangler), `toning.js` (kamerakuttet toner ting ut), `ytelse.js` (slår sammen faste deler) og `laster.js`
- `flerspiller.js`, `firebase-config.js`, `database.rules.json` – flerspiller: logg inn og gå rundt sammen med andre,
  med egen figur (se `FLERSPILLER.md` for oppsett av Firebase)
- `figurer/` – 3D-modeller av figurer (GLB med Mixamo-skjelett, f.eks. fra Avaturn) som kan velges i spillet
  - `figurer/animasjoner/` – Mixamo-animasjoner (FBX). De er samlet og komprimert i `figurer/animasjoner.json`,
    som spillet bruker; legges det til nye FBX-filer, må JSON-fila lages på nytt
- `lyder/` – lydfiler til handlingene i spillet (se `lyder/README.md` for filnavnene)
- `musikk/` – egen musikk til musikkanleggene i spillet (valgfritt)
- `vercel.json` – mellomlagring av figurer, lyder og bilder i nettleseren
- `hus.js` – selve huset (geometri, materialer, lys og romnavn), delt mellom `index.html` og `spill.html`
- `kilder/` – originale tegninger og bilder. Ligger lokalt og er ignorert av git (se `.gitignore`)
- `video/` – videoer laget med `/brag-slim` fra selve 3D-modellen, åpnes med knappen «Se video» øverst til høyre:
  omvisning i øyehøyde fra hoveddøra gjennom alle rom (1:31) og en kort presentasjon (0:22)
  - `video/tv-fjord.mp4` – dronefilm over en fjord (laget med Higgsfield) som vises på TV-ene når noen ser Netflix;
    lyset fra skjermen får fargen bildet har
- `bilder/` – bilder i huset og rundt det:
  - `kunst.jpg` – fire malerier i ett bilde (2 × 2, Higgsfield): over sofaen, over pianoet og over senga i soverom 12
  - `nordlys.jpg` – nordlys (Higgsfield) som tones inn på himmelen mot nord om natta (`himmel.js`)
  - `omgivelser.jpg` – panorama av et rekkehusnabolag (Higgsfield), brukt som miljøkart så blanke flater speiler
    omgivelsene; dempes om natta
  - `start-pc.jpg`, `start-mobil.jpg` – kveldsbilder fra 3D-modellen med nordlys, bakgrunn på startsiden
  - `love.jpg`, `hommelvik.jpg`, `levanger.jpg` – løvebildet og kartplakatene

### Status

- **1. etasje** er modellert: stue, kjøkken, entré, tek. rom, trapp, terrasse mot hagen (25 m²),
  inngangsterrasse (4 m²) og bod (5 m²). Mål er hentet fra meglerens planskisse (Cubicasa, ca. 67 px/m)
  og er omtrentlige; møblering og materialer er tolket fra bildene.
- **Trapp**: starter ved stua med vindeltrinn, går langs høyre vegg mot inngangen (tek. rom under)
  og svinger ut mot gangen i 2. etasje.
- **2. etasje** er modellert: tre soverom (13, 7 og 12 m²), bad (7,5 m²), gang med trapp (8,5 m²)
  og altan (4 m²) over inngangsterrassen.
- **3. etasje** er modellert: stue (15,5 m²), soverom (8 m²), vaskerom (4,5 m²), bod (1 m², hevet gulv
  over trappa) og takterrasse (17 m²). Trappa fra 2. til 3. etasje ligger rett over den nederste.
- Sideveggene på terrassen i 1. etasje og på takterrassen er høye inntil huset og skrår ned utover.

## Claude-skills for Three.js

`.claude/skills/` inneholder seks Three.js-skills kopiert fra
[OpenAEC-Foundation/Three.js-Claude-Skill-Package](https://github.com/OpenAEC-Foundation/Three.js-Claude-Skill-Package)
(commit `6c190f0db95d6e4b77d7843d181c6d3325c09d0e`, 2026-03-30), uendret:
`threejs-core-math`, `threejs-core-raycaster`, `threejs-core-renderer`,
`threejs-core-scene-graph`, `threejs-syntax-loaders` og `threejs-syntax-controls`.
Lisens: MIT, se `.claude/skills/LICENSE-threejs-skills`.
