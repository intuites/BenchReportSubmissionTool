// Curated accents, grouped by family. Each one is tested to read in light and dark (color.test.js):
// button labels, hover, text, tints and marks. No violet or lavender (taste rule).
// Each family runs as a ramp: by hue where it spans several, light to dark where it is one.
export const ACCENT_GROUPS = [
  ['Pinks and reds', [['Coral', '#d9480f'], ['Tomato', '#d63d2c'], ['Brick', '#a8322d'], ['Ruby', '#9b111e'], ['Crimson', '#c8102e'], ['Rose', '#e11d48'], ['Wine', '#722f37'], ['Raspberry', '#b5174f'], ['Blush', '#b5506a'], ['Berry', '#8e1c4a'], ['Card pink', '#d0106f'], ['Hot pink', '#e0218a']]],
  ['Oranges and browns', [['Ochre', '#cc7722'], ['Tangerine', '#f28c28'], ['Mocha', '#6f4e37'], ['Brown', '#7c4a2d'], ['Amber', '#b45309'], ['Clay', '#a0522d'], ['Peach', '#e8875c'], ['Espresso', '#4a2c20'], ['Terracotta', '#b35a3a'], ['Rust', '#b4441a'], ['Burnt orange', '#c2410c']]],
  ['Yellows and golds', [['Lemon', '#f5d90a'], ['Butter', '#e8c547'], ['Sunflower', '#f4b400'], ['Saffron', '#f4a300'], ['Old gold', '#cfb53b'], ['Marigold', '#eaa221'], ['Sand', '#c2a878'], ['Golden', '#d4a017'], ['Brass', '#b5a642'], ['Antique gold', '#b8860b'], ['Honey', '#b07d0a'], ['Mustard', '#9a7b0a'], ['Gold', '#a16207']]],
  ['Greens', [['Pine', '#1f5f4f'], ['Jade', '#00876a'], ['Mint', '#10a37f'], ['Emerald', '#047857'], ['Green', '#1f6b3a'], ['Sage', '#5c7b61'], ['Spring', '#16a34a'], ['Forest', '#2f6f3e'], ['Lime', '#65a30d'], ['Olive', '#4d7c0f'], ['Moss', '#556b2f'], ['Khaki', '#6b6b2a']]],
  ['Teals', [['Turquoise', '#14b8a6'], ['Aqua', '#06a3c4'], ['Glacier', '#4f778c'], ['Cyan', '#0e7490'], ['Teal', '#0f766e'], ['Petrol', '#155e75']]],
  ['Blues', [['Cornflower', '#4a6fd1'], ['Azure', '#0070e2'], ['Steel blue', '#3a6ea5'], ['Sky', '#0369a1'], ['Biro blue', '#1a4be0'], ['Ocean', '#1d4ed8'], ['Denim', '#2a4d8f'], ['Cobalt', '#0047ab'], ['Indigo', '#3730a3'], ['Navy', '#1e3a8a'], ['Midnight', '#1c2a4f']]],
  ['Neutrals', [['Taupe', '#83705f'], ['Slate', '#475569'], ['Graphite', '#3f3f46'], ['Charcoal', '#333a40'], ['Ink', '#1f2937']]],
]
export const ALL_ACCENTS = ACCENT_GROUPS.flatMap(([, items]) => items)
// kept for older imports: the full list
export const ACCENTS = ALL_ACCENTS
