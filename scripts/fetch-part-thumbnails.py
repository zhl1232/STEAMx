"""一次性抓取积木课零件缩略图（Rebrickable LDraw 渲染图），压成 96px webp 随仓库发布。

用法：python3 scripts/fetch-part-thumbnails.py <pairs.json>
pairs.json：[{partId, colorCode, rbColor, candidates:[...]}]，由课程 BOM 生成。
输出：public/courses/part-thumbs/*.webp 与 lib/courses/part-thumbnails.json（key=`partId|colorCode`）。
国内访问 Rebrickable CDN 不稳定，所以不在页面上直接外链。
"""
import csv, gzip, io, json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

OUT = Path('public/courses/part-thumbs'); OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = Path('lib/courses/part-thumbnails.json')
pairs = json.load(open(sys.argv[1]))
ELEMENTS_CSV = Path('/workspace/rebrickable-data/elements.csv.gz')
elements = {}
if ELEMENTS_CSV.exists():
    for row in csv.DictReader(gzip.open(ELEMENTS_CSV, 'rt')):
        elements.setdefault((row['part_num'], row['color_id']), row['element_id'])
        elements.setdefault((row['part_num'], '*'), row['element_id'])
extra = [{'partId': '__duplo_child_figure__.dat', 'colorCode': 15, 'rbColor': 15, 'candidates': ['47511pr0001', '47510pr0002']}]

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'steamx-thumbs/1.0'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read() if r.status == 200 else None
    except Exception:
        return None

def urls(p):
    colors = [c for c in [p['rbColor'], p['colorCode']] if c is not None]
    for cand in p['candidates']:
        for c in dict.fromkeys(colors):
            yield f'https://cdn.rebrickable.com/media/parts/ldraw/{c}/{cand}.png', cand, c
    # 元件实拍图（管道、小人等没有 LDraw 渲染）
    for cand in p['candidates']:
        for c in dict.fromkeys(colors):
            el = elements.get((cand, str(c)))
            if el: yield f'https://cdn.rebrickable.com/media/parts/elements/{el}.jpg', cand, c
    for cand in p['candidates']:
        el = elements.get((cand, '*'))
        if el: yield f'https://cdn.rebrickable.com/media/parts/elements/{el}.jpg', cand, 'any'
    # 退而求其次：同形状任意常见色（页面会叠加正确色块）
    for cand in p['candidates']:
        for c in (15, 4, 14, 1, 71):
            yield f'https://cdn.rebrickable.com/media/parts/ldraw/{c}/{cand}.png', cand, c

def work(p):
    for url, cand, c in urls(p):
        data = fetch(url)
        if not data: continue
        img = Image.open(io.BytesIO(data)).convert('RGBA')
        img.thumbnail((96, 96))
        name = f'{cand}-{c}.webp'
        img.save(OUT / name, 'WEBP', quality=72, method=6)
        exact = c in (p['rbColor'], p['colorCode'])
        return f"{p['partId']}|{p['colorCode']}", {'src': f'/courses/part-thumbs/{name}', 'exactColor': exact}
    return f"{p['partId']}|{p['colorCode']}", None

with ThreadPoolExecutor(8) as ex:
    results = list(ex.map(work, pairs + extra))
manifest = {k: v for k, v in sorted(results) if v}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
print('pairs', len(results), 'with image', len(manifest), 'missing', [k for k, v in results if not v])
