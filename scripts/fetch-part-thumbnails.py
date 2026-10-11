"""Cache lesson part images as 96px WebP (Pillow required).

python3 scripts/fetch-part-thumbnails.py pairs.json [--refresh]
Pairs: [{partId, colorCode, rbColor, candidates: [...], figure?: bool}].
Existing manifest keys are preserved; --refresh retries supplied keys only.
CSV element and design IDs come from --elements (Rebrickable CSV/CSV.gz).
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

from PIL import Image, UnidentifiedImageError

OUT = Path('public/courses/part-thumbs')
MANIFEST = Path('lib/courses/part-thumbnails.json')
COMMON_COLORS = (15, 4, 14, 1, 71, 72, 0)  # LDraw, not Rebrickable IDs
# Reviewed LDraw -> BrickLink colours used by the figure components.
BRICKLINK_COLORS = {0: 11, 1: 7, 4: 5, 7: 9, 8: 10, 14: 3, 15: 1, 71: 86, 72: 85}
FIGURES = {'47199', '47203', '47203p03', '47204', '47205', '47206p01', '47207', '47198p03', '63710'}
REPRESENTATIVES = ['47511pr0001', '47510pr0002']
USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'


def load_elements(path):
    parts, designs = {}, {}
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', newline='') as source:
        for row in csv.DictReader(source):
            item = (row['element_id'], row['color_id'])
            parts.setdefault(row['part_num'], []).append(item)
            if row.get('design_id'):
                designs.setdefault(row['design_id'], []).append(item)
    return parts, designs


@lru_cache(maxsize=4096)
def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read() if response.status == 200 else None
    except (OSError, ValueError):
        return None


def render(part, color):
    return f'https://cdn.rebrickable.com/media/parts/ldraw/{color}/{part}.png'


def photos(elements, rb_color):
    exact = [(el, c) for el, c in elements if c == str(rb_color)]
    # Try every Rebrickable element before moving to LEGO, in each colour tier.
    for group in (exact, [item for item in elements if item not in exact]):
        for host in ('rebrickable', 'lego'):
            for el, color in group:
                url = (f'https://cdn.rebrickable.com/media/parts/elements/{el}.jpg'
                       if host == 'rebrickable' else
                       f'https://www.lego.com/cdn/product-assets/element.img.lod5photo.192x192/{el}.jpg')
                yield url, color == str(rb_color)


def urls(pair, parts, designs):
    base = pair['partId'].removesuffix('.dat')
    figure = pair.get('figure', False) or base in FIGURES
    candidates = list(dict.fromkeys(([base] if figure else []) + pair['candidates'] + [base]))
    color, rb_color = pair['colorCode'], pair.get('rbColor')
    for part in candidates:
        yield render(part, color), True
    elements = list(dict.fromkeys(item for part in candidates for item in parts.get(part, [])))
    yield from photos(elements, rb_color)
    for part in candidates:
        for fallback in COMMON_COLORS:
            yield render(part, fallback), fallback == color
    # LDraw-only local parts can still have real element photos via design_id.
    design_elements = list(dict.fromkeys(item for part in candidates for item in designs.get(part, [])))
    yield from photos(design_elements, rb_color)
    if figure:
        for part in candidates:
            if color in BRICKLINK_COLORS:
                yield f'https://img.bricklink.com/ItemImage/PN/{BRICKLINK_COLORS[color]}/{part}.png', True
            yield f'https://img.bricklink.com/ItemImage/PL/{part}.png', False
        # A complete figure is illustrative only, even if its colour ID matches.
        for part in REPRESENTATIVES:
            for url, _ in photos(parts.get(part, []), rb_color):
                yield url, False
            for fallback in COMMON_COLORS:
                yield render(part, fallback), False


def work(pair, parts, designs):
    key = f"{pair['partId']}|{pair['colorCode']}"
    seen = set()
    for url, exact in urls(pair, parts, designs):
        if url in seen:
            continue
        seen.add(url)
        data = fetch(url)
        if not data:
            continue
        try:
            with Image.open(io.BytesIO(data)) as source:
                img = source.convert('RGBA')
                img.thumbnail((96, 96), Image.Resampling.LANCZOS)
        except (UnidentifiedImageError, OSError, ValueError):
            continue  # HTML errors / corrupt images must not stop later fallbacks.
        name = hashlib.sha256((key + url).encode()).hexdigest()[:20] + '.webp'
        img.save(OUT / name, 'WEBP', quality=72, method=6)
        print(f'{key}: {url} exactColor={exact}', flush=True)
        return key, {'src': f'/courses/part-thumbs/{name}', 'exactColor': exact}
    print(f'{key}: exhausted {len(seen)} image URLs (unreachable or invalid)', flush=True)
    return key, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pairs', type=Path)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--elements', type=Path, default=Path('/workspace/rebrickable-data/elements.csv.gz'))
    args = parser.parse_args()
    parts, designs = load_elements(args.elements)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    pairs = json.loads(args.pairs.read_text())
    pairs.append({'partId': '__duplo_child_figure__.dat', 'colorCode': 15, 'rbColor': 15,
                  'candidates': REPRESENTATIVES, 'figure': True})
    pending = {f"{p['partId']}|{p['colorCode']}": p for p in pairs
               if args.refresh or f"{p['partId']}|{p['colorCode']}" not in manifest}
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(8) as executor:
        results = list(executor.map(lambda pair: work(pair, parts, designs), pending.values()))
    # Failed refreshes keep the previous usable image. Unrelated keys always survive.
    manifest.update({key: value for key, value in results if value})
    temp = MANIFEST.with_suffix('.json.tmp')
    temp.write_text(json.dumps(dict(sorted(manifest.items())), ensure_ascii=False, indent=1) + '\n')
    temp.replace(MANIFEST)
    print('requested', len(pending), 'downloaded', sum(v is not None for _, v in results),
          'manifest', len(manifest), 'missing', [k for k, v in results if not v])


if __name__ == '__main__':
    main()
