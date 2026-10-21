"""Generate synthetic-only browser fixtures with the MIT-licensed MeloTTS zh_en model.

Requires sherpa-onnx==1.12.26 and numpy in an isolated Python environment.
No microphone, external TTS API, credentials, user recordings or dataset audio.
"""
import argparse
import json
import wave
from pathlib import Path

import numpy as np
import sherpa_onnx

parser = argparse.ArgumentParser()
parser.add_argument('--model-dir', type=Path, required=True)
parser.add_argument('--out-dir', type=Path, default=Path('e2e/building-kws/audio'))
parser.add_argument('--speed', type=float, default=1.0)
parser.add_argument('--continuous', action='store_true', help='Omit the comma after the wake name')
args = parser.parse_args()
model = args.model_dir
config = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=str(model / 'model.onnx'), lexicon=str(model / 'lexicon.txt'),
            tokens=str(model / 'tokens.txt'), dict_dir=str(model / 'dict')),
        num_threads=1, debug=False),
    rule_fsts=','.join(str(model / name) for name in ['phone.fst', 'date.fst', 'number.fst']),
)
tts = sherpa_onnx.OfflineTts(config)
phrases = {
    'next': '小迪，下一步。', 'next_page': '小迪，下一页。',
    'previous': '小迪，上一步。', 'previous_page': '小迪，上一页。',
    'pause': '小迪，暂停。', 'exit': '小迪，退出。',
    'unknown': '我们来找一块红色的积木。', 'bare': '下一步。',
    'negative': '小迪，不要下一步。', 'negative_prefix': '不要说小迪下一步。',
    'quote': '老师说小迪下一步。', 'quote_suffix': '小迪下一步是口令。',
    'double': '小迪下一步，小迪上一步。', 'question': '小迪下一步吗？',
}
args.out_dir.mkdir(parents=True, exist_ok=True)
for name, phrase in phrases.items():
    if args.continuous: phrase = phrase.replace('小迪，', '小迪')
    phrases[name] = phrase
    audio = tts.generate(phrase, sid=0, speed=args.speed)
    # Keep original model rate; fixtures exercise the browser/engine resampling too.
    samples = np.concatenate([np.zeros(audio.sample_rate), np.asarray(audio.samples), np.zeros(int(audio.sample_rate * 1.2))])
    with wave.open(str(args.out_dir / f'{name}.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(audio.sample_rate)
        output.writeframes((samples.clip(-1, 1) * 32767).astype('<i2').tobytes())
    print(name, len(samples) / audio.sample_rate, flush=True)
(args.out_dir / 'phrases.json').write_text(json.dumps(phrases, ensure_ascii=False, indent=2) + '\n')
