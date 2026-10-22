#!/usr/bin/env python3
"""Prepare pinned Vosk resources locally. Never downloads, publishes, or modifies weights.
Usage: python3 scripts/prepare-building-vosk.py MODEL_ZIP VOSK_BROWSER_TGZ [OUTPUT_DIR]
"""
import base64,gzip,hashlib,io,json,re,sys,tarfile,zipfile
from pathlib import Path
MODEL_SHA='3af8b0e7e0f835ae9d414ce5df580237a3cfb08d586c9fbbb0f7ff29ad5b14ba'
PACKAGE_SHA='fd16fc7e64c935d7a79cf07c8f67d84232b6485376a59144af8a234979a9a4b4'
DIST_SHA='29504515526e974f4cb053cf08811c4de5fb2a74007c0a5a957db50eaa8d5d0c'
def sha(data):return hashlib.sha256(data).hexdigest()
def verified(path,digest):
 data=Path(path).read_bytes()
 if sha(data)!=digest:raise ValueError('Unexpected input SHA-256: '+str(path))
 return data
def replace_once(text,before,after):
 if text.count(before)!=1:raise ValueError('Upstream patch no longer applies: '+before[:80])
 return text.replace(before,after)
def main():
 if len(sys.argv) not in [3,4]:raise SystemExit(__doc__)
 out=Path(sys.argv[3] if len(sys.argv)==4 else 'public/courses/vosk/v1');out.mkdir(parents=True,exist_ok=True)
 model=verified(sys.argv[1],MODEL_SHA);package=verified(sys.argv[2],PACKAGE_SHA)
 # Stable tar paths, ordering, owners and timestamps; preserve every model-file byte.
 with zipfile.ZipFile(io.BytesIO(model)) as z,gzip.GzipFile(filename='',mode='wb',compresslevel=1,mtime=0,fileobj=open(out/'model.tar.gz','wb')) as gz,tarfile.open(fileobj=gz,mode='w|') as tar:
  source_files={}
  directories={'model'}
  for entry in z.infolist():
   relative=Path(entry.filename).relative_to('vosk-model-small-cn-0.22')
   for parent in relative.parents:
    if parent!=Path('.'):directories.add('model/'+parent.as_posix())
   if entry.is_dir() and relative!=Path('.'):directories.add('model/'+relative.as_posix())
  for directory in sorted(directories,key=lambda value:(value.count('/'),value)):
   info=tarfile.TarInfo(directory+'/');info.type=tarfile.DIRTYPE;info.mode=0o755;tar.addfile(info)
  for entry in sorted(z.infolist(),key=lambda e:e.filename):
   if entry.is_dir():continue
   relative=Path(entry.filename).relative_to('vosk-model-small-cn-0.22')
   if '..' in relative.parts:raise ValueError('Unsafe model path')
   content=z.read(entry);info=tarfile.TarInfo('model/'+relative.as_posix());info.size=len(content);info.mode=0o644
   tar.addfile(info,io.BytesIO(content));source_files[str(relative)]={'bytes':len(content),'sha256':sha(content)}
 payload=(out/'model.tar.gz').read_bytes();expected={'bytes':len(payload),'sha256':sha(payload)}
 with tarfile.open(fileobj=io.BytesIO(package)) as tar:dist=tar.extractfile('package/dist/vosk.js').read()
 if sha(dist)!=DIST_SHA:raise ValueError('Unexpected upstream bundle')
 source=dist.decode();match=re.search(r"WorkerFactory = createBase64WorkerFactory\('([^']+)'",source)
 if not match:raise ValueError('No embedded worker')
 worker=base64.b64decode(match.group(1)).decode()
 helper='''
    // STEAMx modification: verify only static model bytes; cache archive, never PCM.
    async function verifiedModelArchive(url) {
      const expected = EXPECTED;
      if (new URL(url).origin !== new URL(location.href).origin) throw new Error('Model origin');
      let cache, cached;
      try { cache = await caches.open('steamx-building-vosk-v1'); cached = await cache.match(url); } catch { cache = undefined; }
      const response = cached || await fetch(url, {cache: 'force-cache', credentials: 'omit'});
      if (!response.ok) throw new Error('Model unavailable');
      const bytes = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== expected.bytes || digest !== expected.sha256) {
        try { await cache?.delete(url); } catch {}
        throw new Error('Model integrity');
      }
      if (!cached) { try { await cache?.put(url, new Response(bytes)); } catch {} }
      return bytes;
    }
'''.replace('EXPECTED',json.dumps(expected))
 worker=replace_once(worker,'    class RecognizerWorker',helper+'    class RecognizerWorker')
 worker=replace_once(worker,'this.logger.debug(JSON.stringify(message));','// STEAMx: do not serialize PCM for disabled debug logs.')
 worker=replace_once(worker,'`Unknown message ${JSON.stringify(message)}`','"Unknown worker message"')
 worker=replace_once(worker,'this.Vosk.FS.mount(this.Vosk.IDBFS, {}, storagePath);\r\n                    return this.Vosk.syncFilesystem(true);','// STEAMx: keep extracted files in MEMFS; compressed archive cache is sufficient.\r\n                    return Promise.resolve();')
 worker=replace_once(worker,'return this.Vosk.downloadAndExtract(fullModelUrl.toString(), modelPath);','return verifiedModelArchive(fullModelUrl.toString()).then(async bytes => {\r\n                        const blob = URL.createObjectURL(new Blob([bytes]));\r\n                        try { await this.Vosk.downloadAndExtract(blob, modelPath); } finally { URL.revokeObjectURL(blob); }\r\n                    });')
 worker=replace_once(worker,'return this.Vosk.syncFilesystem(false);','return Promise.resolve(); // STEAMx: no persistent extracted model or audio filesystem.')
 encoded=base64.b64encode(worker.encode()).decode()
 source=source[:match.start(1)]+encoded+source[match.end(1):]
 source='/* Modified by STEAMx: integrity-checked static model cache; no persistent MEMFS. See prepare-building-vosk.py and NOTICE.md. WASM and inference unchanged; eager PCM debug serialization removed. */\n'+source
 (out/'vosk.js').write_text(source)
 (out/'model-source.json').write_text(json.dumps({'model':'vosk-model-small-cn-0.22','license':'Apache-2.0','licenseSource':'https://alphacephei.com/vosk/models','sourceZipSha256':MODEL_SHA,'browserVersion':'0.0.8','browserPackageSha256':PACKAGE_SHA,'upstreamBundleSha256':DIST_SHA,'modelFiles':source_files,'assets':{'model.tar.gz':expected,'vosk.js':{'bytes':len(source.encode()),'sha256':sha(source.encode())}}},indent=2)+'\n')
 print(json.dumps({'model.tar.gz':expected,'vosk.js':{'bytes':len(source.encode()),'sha256':sha(source.encode())}}))
if __name__=='__main__':main()
