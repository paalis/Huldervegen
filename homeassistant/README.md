# Huldervegen i Home Assistant

3D-modellen av huset kan brukes som et interaktivt display i Home Assistant med
[floor3d-card](https://github.com/adizanni/floor3d-card): lampene lyser i modellen når de er på i huset, man
kan bytte etasje med knapper i kortet, og et klikk på en lampe slår den av og på (med `click: 'yes'`;
ellers dobbeltklikk).

## 1. Lag modellen

Åpne `index.html` (3D-modellen) og trykk **⬇ Home Assistant**. Da lastes `huldervegen-ha.glb` ned (ca. 18 MB).

Fila er laget for floor3d-card og skiller seg fra den vanlige «Last ned 3D-modell»:

- **Centimeter** og Y opp, som kortet regner med. Origo er hjørnet ute på hagesiden til venstre.
- **Etasjene** er merket `lvl000` (1. etasje med hage, terrasse og inngang), `lvl001` (2. etasje) og
  `lvl002` (3. etasje med takterrasse). Kortet får dermed én knapp per etasje og en for alle.
- **Uten tak**, så man ser rett ned i rommene.
- **Slått sammen** til én del per materiale og etasje (151 deler i stedet for rundt 1600), så det går
  greit på et nettbrett på veggen.
- **Lamper** (`lys_…`) og **rom** (`room_…`) er egne deler med faste navn, så entiteter kan kobles til dem.

## 2. Legg fila i Home Assistant

1. Installer **floor3d-card** via HACS (Frontend → søk «floor3d»).
2. Kopier `huldervegen-ha.glb` til `/config/www/huldervegen/` (f.eks. med File editor, Samba eller Studio Code
   Server). Mappa `www` vises i Home Assistant som `/local/`.
3. Lag et nytt kort på et dashbord, velg «Manual» og lim inn innholdet i [`floor3d.yaml`](floor3d.yaml).
   Bytt `light.…`- og `sensor.…`-entitetene med dine egne, og fjern lampene du ikke har.

Tips: dobbeltklikk på en del i kortet i redigeringsmodus for å se navnet (object_id) på den. Dobbeltklikk
på bakgrunnen for å lagre kameravinkelen (`camera_position`, `camera_rotate`, `camera_target`).

## Navn i modellen

Lamper (`type3d: light`), etter lampene i spillet:

| object_id | Lampe |
|---|---|
| `lys_stue1` | Stue, taklampe |
| `lys_stue1_2` | Stue, glasskulene over spisebordet |
| `lys_kjokken` | Kjøkken |
| `lys_entre` | Entré |
| `lys_terrasse` | Terrasse mot hagen, vegglampe |
| `lys_inngang` | Lampa ved inngangsdøra |
| `lys_sov13` | Soverom 13 m² (2. etg.) |
| `lys_sov7` | Soverom 7 m² (2. etg.), papirlampe |
| `lys_bad` | Bad, taklampe |
| `lys_bad_2` | Bad, lysrøret over speilet |
| `lys_sov12` | Soverom 12 m² (2. etg.) |
| `lys_gang2` | Gang med trapp (2. etg.) |
| `lys_stue3` | Stue (3. etg.) |
| `lys_kontor` | Soverom/kontor 8 m² (3. etg.) |
| `lys_vaskerom` | Vaskerom (3. etg.) |
| `lys_takterrasse` | Takterrasse, vegglampe |

Rom (`type3d: room`, gir en farget boks over gulvet med en verdi som etikett, f.eks. temperatur):
`room_stue1`, `room_kjokken`, `room_entre`, `room_terrasse`, `room_inngang`, `room_sov13`, `room_sov7`,
`room_bad`, `room_sov12`, `room_altan`, `room_gang2`, `room_takterrasse`, `room_stue3`, `room_kontor`,
`room_vaskerom` og `room_gang3`.

Resten av huset heter etter materialet, f.eks. `kledning`, `vegg2` eller `eik`. Disse kan brukes med
`type3d: hide`, `show` eller `color`, men gjelder da alt med det materialet i den etasjen.

Navnene er laget i `eksport.js` (`lagHomeAssistantScene`), rommene kommer fra `spill/rom.js` og lampene fra
`spill/lys.js`. Flytter man en lampe der, følger den med neste gang modellen lastes ned.
