# Huldervegen

Interaktiv 3D-visning av huset, bygget fra romtegninger og bilder.

- `index.html` – selve 3D-modellen (én selvstendig fil)
- `kilder/` – originale tegninger og bilder. Ligger lokalt og er ignorert av git (se `.gitignore`)

### Status

- **1. etasje** er modellert: stue, kjøkken, entré, tek. rom, trapp, terrasse mot hagen (25 m²),
  inngangsterrasse (4 m²) og bod (5 m²). Mål er hentet fra meglerens planskisse (Cubicasa, ca. 67 px/m)
  og er omtrentlige; møblering og materialer er tolket fra bildene.
- **Trapp**: starter ved stua med vindeltrinn, går langs høyre vegg mot inngangen (tek. rom under)
  og svinger ut mot gangen i 2. etasje.
- **2. etasje** er modellert: tre soverom (13, 7 og 12 m²), bad (7,5 m²), gang med trapp (8,5 m²)
  og altan (4 m²) over inngangsterrassen.

## Claude-skills for Three.js

`.claude/skills/` inneholder seks Three.js-skills kopiert fra
[OpenAEC-Foundation/Three.js-Claude-Skill-Package](https://github.com/OpenAEC-Foundation/Three.js-Claude-Skill-Package)
(commit `6c190f0db95d6e4b77d7843d181c6d3325c09d0e`, 2026-03-30), uendret:
`threejs-core-math`, `threejs-core-raycaster`, `threejs-core-renderer`,
`threejs-core-scene-graph`, `threejs-syntax-loaders` og `threejs-syntax-controls`.
Lisens: MIT, se `.claude/skills/LICENSE-threejs-skills`.
