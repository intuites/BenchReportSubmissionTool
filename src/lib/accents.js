// Curated accents, grouped by family. Each one is tested to read in light and dark (color.test.js):
// button labels, hover, text, tints and marks. No violet or lavender (taste rule).
// Each family runs as a ramp: by hue where it spans several, light to dark where it is one.
export const ACCENT_GROUPS = [
  ['Pinks', [['Raspberry', '#b5174f'], ['Blush', '#b5506a'], ['Petal', '#f4a6b8'], ['Berry', '#8e1c4a'], ['Card pink', '#d0106f'], ['Candy', '#ff6fa8'], ['Bubblegum', '#e8579a'], ['Hot pink', '#e0218a']]],
  ['Reds', [['Coral', '#d9480f'], ['Tomato', '#d63d2c'], ['Brick', '#a8322d'], ['Maroon', '#6d1a1a'], ['Ruby', '#9b111e'], ['Crimson', '#c8102e'], ['Clay pink', '#d98c8c'], ['Rose', '#e11d48'], ['Wine', '#722f37']]],
  ['Oranges', [['Melon', '#f7a072'], ['Tangerine', '#f28c28'], ['Peach', '#e8875c'], ['Ochre', '#cc7722'], ['Amber', '#b45309'], ['Burnt orange', '#c2410c'], ['Rust', '#b4441a']]],
  ['Browns', [['Biscuit', '#d9b48f'], ['Terracotta', '#b35a3a'], ['Clay', '#a0522d'], ['Brown', '#7c4a2d'], ['Mocha', '#6f4e37'], ['Cocoa', '#5a3a2a'], ['Espresso', '#4a2c20']]],
  ['Yellows and golds', [['Primrose', '#efe08a'], ['Lemon', '#f5d90a'], ['Pear', '#c9d65a'], ['Butter', '#e8c547'], ['Sunflower', '#f4b400'], ['Saffron', '#f4a300'], ['Old gold', '#cfb53b'], ['Marigold', '#eaa221'], ['Sand', '#c2a878'], ['Golden', '#d4a017'], ['Brass', '#b5a642'], ['Antique gold', '#b8860b'], ['Honey', '#b07d0a'], ['Mustard', '#9a7b0a'], ['Gold', '#a16207']]],
  ['Limes and olives', [['Chartreuse', '#8fb01b'], ['Lime', '#65a30d'], ['Avocado', '#6b8e23'], ['Olive', '#4d7c0f'], ['Khaki', '#6b6b2a'], ['Moss', '#556b2f']]],
  ['Greens', [['Mint leaf', '#7dd3b0'], ['Pistachio', '#7fae6f'], ['Kelly', '#4cbb17'], ['Mint', '#10a37f'], ['Spring', '#16a34a'], ['Jade', '#00876a'], ['Sage', '#5c7b61'], ['Emerald', '#047857'], ['Forest', '#2f6f3e'], ['Green', '#1f6b3a'], ['Pine', '#1f5f4f'], ['Jungle', '#1b4d3e']]],
  ['Teals', [['Turquoise', '#14b8a6'], ['Seaglass', '#5aa79a'], ['Aqua', '#06a3c4'], ['Glacier', '#4f778c'], ['Cyan', '#0e7490'], ['Teal', '#0f766e'], ['Petrol', '#155e75']]],
  ['Light blues', [['Ice', '#9ccfe6'], ['Sky light', '#7cc3f2'], ['Baby blue', '#6aa6dd'], ['Powder blue', '#5a87c5']]],
  ['Blues', [['Cornflower', '#4a6fd1'], ['Azure', '#0070e2'], ['Steel blue', '#3a6ea5'], ['Sky', '#0369a1'], ['Biro blue', '#1a4be0'], ['Ocean', '#1d4ed8'], ['Denim', '#2a4d8f'], ['Cobalt', '#0047ab'], ['Indigo', '#3730a3'], ['Navy', '#1e3a8a'], ['Prussian', '#1f3b5c'], ['Midnight', '#1c2a4f']]],
  ['Neutrals', [['Silver', '#b4b5b8'], ['Fog', '#9aa5b1'], ['Mushroom', '#9a8b7a'], ['Taupe', '#83705f'], ['Slate', '#475569'], ['Graphite', '#3f3f46'], ['Charcoal', '#333a40'], ['Ink', '#1f2937'], ['Black', '#141414']]],
]
export const ALL_ACCENTS = ACCENT_GROUPS.flatMap(([, items]) => items)
// kept for older imports: the full list
export const ACCENTS = ALL_ACCENTS
