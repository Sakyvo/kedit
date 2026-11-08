"""Regenerate the shipped Latin subsets: python scripts/subset-lato.py (fonttools[woff])."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1] / 'src/assets/fonts'
ranges = [(0x20, 0x24F), (0x1E00, 0x1EFF), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2190, 0x21FF)]
for source in sorted(root.glob('lato-*.woff')):
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=[c for start, end in ranges for c in range(start, end + 1)])
    subsetter.subset(font)
    # OFL reserves Lato: modified font files carry a distinct internal name.
    for record in font['name'].names:
        if record.nameID in (1, 3, 4, 6, 16, 18, 21):
            record.string = record.toUnicode().replace('Lato', 'KeditLatin').encode(record.getEncoding())
    license_text = (root / 'OFL-Lato.txt').read_text(encoding='utf-8-sig').strip()
    font['name'].setName(license_text, 13, 3, 1, 0x409)
    font.flavor = 'woff2'
    target = root / source.name.replace('lato-', 'kedit-latin-').replace('.woff', '.woff2')
    font.save(target)
    print(f'{source.name}: {source.stat().st_size} -> {target.name}: {target.stat().st_size} bytes')
