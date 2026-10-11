"""Offline regression checks: python3 -m unittest discover -s scripts -p 'test_fetch_part_thumbnails.py'."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

spec = importlib.util.spec_from_file_location('thumbnails', Path(__file__).with_name('fetch-part-thumbnails.py'))
thumbs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(thumbs)


class ThumbnailTests(unittest.TestCase):
    def test_all_elements_and_source_order(self):
        pair = {'partId': 'x.dat', 'colorCode': 14, 'rbColor': 99, 'candidates': ['x']}
        sources = list(thumbs.urls(pair, {'x': [('first', '99'), ('second', '99'), ('other', '4')]}, {}))
        self.assertEqual(sources[:5], [
            (thumbs.render('x', 14), True),
            ('https://cdn.rebrickable.com/media/parts/elements/first.jpg', True),
            ('https://cdn.rebrickable.com/media/parts/elements/second.jpg', True),
            ('https://www.lego.com/cdn/product-assets/element.img.lod5photo.192x192/first.jpg', True),
            ('https://www.lego.com/cdn/product-assets/element.img.lod5photo.192x192/second.jpg', True),
        ])
        self.assertIn(('https://cdn.rebrickable.com/media/parts/elements/other.jpg', False), sources)
        self.assertIn((thumbs.render('x', 0), False), sources)

    def test_design_ids_and_figure_representative_are_supported(self):
        pair = {'partId': '76395.dat', 'colorCode': 0, 'rbColor': 0, 'candidates': []}
        self.assertIn(('https://cdn.rebrickable.com/media/parts/elements/element.jpg', True),
                      list(thumbs.urls(pair, {}, {'76395': [('element', '0')]})))
        pair.update(partId='47199.dat', figure=True)
        sources = list(thumbs.urls(pair, {'47511pr0001': [('figure', '0')]}, {}))
        self.assertIn(('https://img.bricklink.com/ItemImage/PN/11/47199.png', True), sources)
        self.assertIn(('https://cdn.rebrickable.com/media/parts/elements/figure.jpg', False), sources)

    def test_corrupt_first_image_continues_to_second_element(self):
        pair = {'partId': 'x.dat', 'colorCode': 4, 'rbColor': 4, 'candidates': ['x']}
        image = io.BytesIO()
        Image.new('RGB', (192, 144), 'red').save(image, 'PNG')
        def fetch(url):
            return image.getvalue() if url.endswith('/second.jpg') else b'not an image'
        with tempfile.TemporaryDirectory() as directory, patch.object(thumbs, 'OUT', Path(directory)), patch.object(thumbs, 'fetch', side_effect=fetch):
            _, result = thumbs.work(pair, {'x': [('first', '4'), ('second', '4')]}, {})
            self.assertTrue(result['exactColor'])
            with Image.open(Path(directory) / Path(result['src']).name) as saved:
                self.assertEqual(saved.format, 'WEBP')
                self.assertEqual(saved.size, (96, 72))

    def test_merge_and_refresh_preserve_unrelated_and_failed_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, pairs = root / 'manifest.json', root / 'pairs.json'
            old = {'src': '/old.webp', 'exactColor': True}
            new = {'src': '/new.webp', 'exactColor': False}
            original = {'keep|4': old, 'retry|4': old, '__duplo_child_figure__.dat|15': old}
            manifest.write_text(json.dumps(original))
            pairs.write_text(json.dumps([{'partId': 'retry', 'colorCode': 4}]))
            with patch.object(thumbs, 'MANIFEST', manifest), patch.object(thumbs, 'OUT', root), patch.object(thumbs, 'load_elements', return_value=({}, {})), patch.object(thumbs, 'work', return_value=('retry|4', new)) as work:
                with patch('sys.argv', ['fetch', str(pairs)]):
                    thumbs.main()
                work.assert_not_called()
                self.assertEqual(json.loads(manifest.read_text()), original)
                with patch('sys.argv', ['fetch', str(pairs), '--refresh']):
                    thumbs.main()
                self.assertEqual(json.loads(manifest.read_text())['retry|4'], new)
                self.assertEqual(json.loads(manifest.read_text())['keep|4'], old)
                work.return_value = ('retry|4', None)
                with patch('sys.argv', ['fetch', str(pairs), '--refresh']):
                    thumbs.main()
                self.assertEqual(json.loads(manifest.read_text())['retry|4'], new)
