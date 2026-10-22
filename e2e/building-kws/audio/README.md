# Synthetic Mandarin fixtures

These WAVs are generated locally, not microphone recordings or training-dataset excerpts. No family/user speech is included. `phrases.json` gives every input. They exercise the actual browser AudioWorklet + sherpa-onnx Chinese KWS + course controls, including two preserved corpora: the root WAVs use speed 1.0 with a comma after the wake name; `clear/` uses speed 0.8 without that comma. Both sets run strict positive-command and rejection assertions. A failure remains a failure; the slower set does not replace the original misses.

Generator: `scripts/generate-building-kws-fixtures.py`, Python sherpa-onnx 1.12.26, NumPy, the FP32 `model.onnx` from the official [vits-melo-tts-zh_en archive](https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2), based on [MyShell.ai MeloTTS](https://github.com/myshell-ai/MeloTTS). Its bundled [MIT license](MeloTTS-LICENSE.txt) is retained. The synthesizer model/dictionary is not included in this repository or shipped with the app. Seed/noise can change waveform bytes on regeneration.

Run in an isolated Python environment, then `python scripts/generate-building-kws-fixtures.py --model-dir /path/to/vits-melo-tts-zh_en`. The archive's `model.int8.onnx` is an LFS pointer, so the generator deliberately uses the actual FP32 model. The production KWS model is independently licensed/documented under `public/courses/kws/v1/NOTICE.md`.

Synthetic examples are regression evidence, not a real-world accuracy benchmark. Mixing `next.wav` and `previous.wav` is one overlapping-speech case, not a general overlap detector or speaker authentication test. Real voices, iPhone/Android, casting, household noise and long sessions require separate testing.

To reproduce the second corpus, add `--speed 0.8 --continuous --out-dir e2e/building-kws/audio/clear`. All six phrases were checked with upstream `sherpa_onnx.text2token(..., tokens_type="ppinyin")`; the configured tokens match. A local comparison with the same Chinese model in FP32 did not eliminate the original short-phrase misses; larger weights alone are not an accepted fix.
