# Redraws the digits 2 and 3 of assets/pixel.woff2 (Pixelify Sans) so they cannot be mistaken for 8 / a flipped S.
# usage: python3 tools/patch_font.py   (reads and rewrites assets/pixel.woff2; keep a copy of the original first)
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
P = 'assets/pixel.woff2'
GLYPHS = {
  'two':   ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  'three': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
}
X0, CW, YTOP, CH = 60, 93, 631, 92
f = TTFont(P); glyf = f['glyf']; gvar = f['gvar']
for name, rows in GLYPHS.items():
    pen = TTGlyphPen(f.getGlyphSet())
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != '#': continue
            x0, x1 = X0 + c * CW - 1, X0 + (c + 1) * CW + 1           # 1 unit of overlap hides seams between neighbouring pixels
            y1, y0 = YTOP - r * CH + 1, YTOP - (r + 1) * CH - 1
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    glyf[name] = pen.glyph()
    gvar.variations.pop(name, None)                                   # the bold master used the old outline; drop its deltas
f.flavor = 'woff2'; f.save(P)
