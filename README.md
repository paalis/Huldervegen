# Huldervegen

Interaktiv 3D-visning av huset, bygget fra romtegninger og bilder.

- `index.html` – selve 3D-modellen (én selvstendig fil)
- `kilder/` – originale tegninger og bilder. Ligger lokalt og er ignorert av git (se `.gitignore`)
- `video/` – videoer laget med `/brag-slim` fra selve 3D-modellen, åpnes med knappen «Se video» øverst til høyre:
  omvisning i øyehøyde fra hoveddøra gjennom alle rom (1:31) og en kort presentasjon (0:22)

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
