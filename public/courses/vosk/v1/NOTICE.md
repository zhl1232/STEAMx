# Vosk Chinese fixed-command resources

The model is `vosk-model-small-cn-0.22`, downloaded from the official Vosk model distribution. The [official model table](https://alphacephei.com/vosk/models) identifies this exact small Chinese model as Apache-2.0 (checked 2026-10-22). The model package README has no separate license declaration; this notice records the official table as the model license evidence. No lexicon or weights from another model are added. Model-file hashes are preserved in `model-source.json`.

Browser wrapper: `vosk-browser@0.0.8`, Apache-2.0, Copyright 2020–2022 Ciaran O'Reilly. See `COPYING` and the unchanged `UPSTREAM-NOTICE` covering Vosk, Kaldi, OpenFST, CLAPACK, clapack-wasm, zlib, libarchive, Emscripten and musl. Bundled TypeScript helper copyright/license comments remain in vosk.js. The bundled uuid 9.0.0 code is MIT; see `UUID-LICENSE`.

STEAMx modifies the JavaScript model loader to verify the fixed model archive SHA-256 and cache only that archive in CacheStorage. Extracted files stay in worker memory; private-mode cache failures can fall back to a memory-only session. The unused eager JSON serialization of PCM in upstream debug logging is also removed, avoiding raw-audio string allocation even with logging disabled. The WASM bytes and inference code are unchanged. `scripts/prepare-building-vosk.py` validates pinned npm/model archive hashes and reproduces the patch and deterministic model tarball. No external model service is used by the application.

Source packages:
- https://registry.npmjs.org/vosk-browser/-/vosk-browser-0.0.8.tgz
- https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip
- https://github.com/ccoreilly/vosk-browser/blob/master/COPYING
- https://github.com/ccoreilly/vosk-browser/blob/master/NOTICE

The bounded AudioWorklet and adapter Worker are STEAMx application code. They do not provide speaker recognition or intent detection; complete recorded commands and similar wake words can still trigger. This local experiment is not a deployment approval.
