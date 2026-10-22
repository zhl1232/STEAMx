# Local Vosk course controls experiment

Run `pnpm test:e2e:building-vosk`. A local Vite fixture on 127.0.0.1:4185 uses the real course controls, capture, model and 3D workspace. Only authentication/course data and microphone input are replaced. No hardware microphone or production database is used. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium` selects a local Chromium executable; software 3D does not represent phone GPUs.

`cases.json` retains all expected actions and rejections. Original normal/clear recordings derive from `e2e/building-kws/audio` (MeloTTS, one synthetic female voice, normal and 0.8 speed); this corpus uses fixed 16 kHz resampling. Extra, holdout, independent, unseen and heldout-final recordings use the same offline MeloTTS model at speed 1.0. Overlap is a deterministic mixture; silence/white noise are synthetic signals. The recorded-command case intentionally reuses an exact command waveform to expose speaker/origin ambiguity. There are no human or household recordings.

The test retains strict rejection assertions for known short-negation, overlap, similar-wake and replay failures. A failing acoustic test is not a failed download and must not be hidden by discarding unknown words or relaxing expected results. Repeated start/stop, media coordination, actual track interruption, navigation invalidation and capability/load errors have separate tests.

The application only caches the pinned model archive; test observations contain synthetic transcripts for diagnosis and are cleared between clips. Product code does not retain transcripts or PCM. Prior KWS files and raw cloud experiment reports remain preserved separately; this suite does not claim those old results as Vosk validation.
