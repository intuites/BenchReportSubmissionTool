// Curated accents, grouped by family. Each one is tested to read in light and dark (color.test.js):
// button labels, hover, text, tints and marks. No violet or lavender (taste rule).
export const ACCENT_GROUPS = [
  ['Pinks and reds', [['Card pink', '#d0106f'], ['Rose', '#e11d48'], ['Raspberry', '#b5174f'], ['Berry', '#8e1c4a'], ['Crimson', '#c8102e'], ['Ruby', '#9b111e'], ['Tomato', '#d63d2c'], ['Coral', '#d9480f'], ['Hot pink', '#e0218a'], ['Blush', '#b5506a'], ['Brick', '#a8322d'], ['Wine', '#722f37']]],
  ['Oranges and browns', [['Rust', '#b4441a'], ['Burnt orange', '#c2410c'], ['Terracotta', '#b35a3a'], ['Amber', '#b45309'], ['Ochre', '#cc7722'], ['Clay', '#a0522d'], ['Brown', '#7c4a2d'], ['Mocha', '#6f4e37'], ['Tangerine', '#f28c28'], ['Peach', '#e8875c'], ['Espresso', '#4a2c20']]],
  ['Yellows and golds', [['Lemon', '#f5d90a'], ['Butter', '#e8c547'], ['Sunflower', '#f4b400'], ['Saffron', '#f4a300'], ['Marigold', '#eaa221'], ['Golden', '#d4a017'], ['Gold', '#a16207'], ['Old gold', '#cfb53b'], ['Antique gold', '#b8860b'], ['Brass', '#b5a642'], ['Honey', '#b07d0a'], ['Mustard', '#9a7b0a'], ['Sand', '#c2a878']]],
  ['Greens', [['Khaki', '#6b6b2a'], ['Olive', '#4d7c0f'], ['Moss', '#556b2f'], ['Green', '#1f6b3a'], ['Forest', '#2f6f3e'], ['Emerald', '#047857'], ['Jade', '#00876a'], ['Pine', '#1f5f4f'], ['Lime', '#65a30d'], ['Spring', '#16a34a'], ['Mint', '#10a37f'], ['Sage', '#5c7b61']]],
  ['Teals and blues', [['Teal', '#0f766e'], ['Petrol', '#155e75'], ['Cyan', '#0e7490'], ['Sky', '#0369a1'], ['Steel blue', '#3a6ea5'], ['Ocean', '#1d4ed8'], ['Biro blue', '#1a4be0'], ['Cobalt', '#0047ab'], ['Denim', '#2a4d8f'], ['Navy', '#1e3a8a'], ['Indigo', '#3730a3'], ['Turquoise', '#14b8a6'], ['Aqua', '#06a3c4'], ['Azure', '#0070e2'], ['Cornflower', '#4a6fd1'], ['Glacier', '#4f778c'], ['Midnight', '#1c2a4f']]],
  ['Neutrals', [['Slate', '#475569'], ['Charcoal', '#333a40'], ['Graphite', '#3f3f46'], ['Taupe', '#83705f'], ['Ink', '#1f2937']]],
]
export const ALL_ACCENTS = ACCENT_GROUPS.flatMap(([, items]) => items)
// kept for older imports: the full list
export const ACCENTS = ALL_ACCENTS
