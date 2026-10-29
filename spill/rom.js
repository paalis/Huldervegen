// Rommene i huset: etasje (0–2), utstrekning (x1, z1, x2, z2), navn og areal.
export const ROM = [
  [0, 0.2, 0.2, 5.07, 7.25, 'Stue og spisestue', '35 m²'], [0, 0.2, 7.25, 2.88, 9.65, 'Kjøkken', '8 m²'],
  [0, 2.98, 7.35, 5.07, 9.65, 'Entré', '4,5 m²'], [0, 0, -4.7, 5.27, 0, 'Terrasse', '25 m²'],
  [0, 2.8, 9.85, 5.27, 11.7, 'Inngang', '4 m²'], [0, -1, 9.85, 2.8, 15, 'Gårdsplass', ''],
  [1, 0.2, 0.2, 2.85, 4.55, 'Soverom', '13 m²'], [1, 2.94, 0.2, 5.07, 3.2, 'Soverom', '7 m²'],
  [1, 0.2, 4.64, 2.85, 7.18, 'Bad', '7,5 m²'], [1, 0.2, 7.3, 5.07, 9.65, 'Soverom', '12 m²'],
  [1, 2.8, 9.85, 5.27, 11.7, 'Altan', '4 m²'], [1, 2.94, 3.2, 5.07, 7.3, 'Gang', '8,5 m²'],
  [2, 0, 0, 5.27, 3.15, 'Takterrasse', '17 m²'], [2, 0.2, 3.35, 4.12, 6.9, 'Stue', '15,5 m²'],
  [2, 0.2, 6.9, 2.9, 9.65, 'Soverom', '8 m²'], [2, 2.95, 7.36, 5.07, 9.65, 'Vaskerom', '4,5 m²'],
  [2, 2.9, 6.6, 5.07, 7.36, 'Gang', ''],
];

// rommet et punkt i en etasje ligger i
export const finnRom = (f, p) => ROM.find(([rf, x1, z1, x2, z2]) => rf === f && p.x >= x1 && p.x <= x2 && p.z >= z1 && p.z <= z2);
