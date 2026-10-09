# Huldervegen

Interaktiv 3D-visning av huset, bygget fra romtegninger og bilder.

- `index.html` – selve 3D-modellen (én selvstendig fil)
- `kilder/` – originale tegninger og bilder. Ligger lokalt og er ignorert av git (se `.gitignore`)

## Claude-skills for Three.js

`.claude/skills/` inneholder seks Three.js-skills kopiert fra
[OpenAEC-Foundation/Three.js-Claude-Skill-Package](https://github.com/OpenAEC-Foundation/Three.js-Claude-Skill-Package)
(commit `6c190f0db95d6e4b77d7843d181c6d3325c09d0e`, 2026-03-30), uendret:
`threejs-core-math`, `threejs-core-raycaster`, `threejs-core-renderer`,
`threejs-core-scene-graph`, `threejs-syntax-loaders` og `threejs-syntax-controls`.
Lisens: MIT, se `.claude/skills/LICENSE-threejs-skills`.
