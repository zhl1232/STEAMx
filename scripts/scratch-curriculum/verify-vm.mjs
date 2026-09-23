#!/usr/bin/env node
/** Read-only VM smoke test for every generated starter/reference project. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ASSETS = path.join(ROOT, 'public/courses/scratch-original/v1');
const rootRequire = createRequire(import.meta.url);
const requireFromGui = createRequire(rootRequire.resolve('@scratch/scratch-gui', { paths: [path.join(ROOT, 'packages/scratch-host')] }));
const VM = requireFromGui('@scratch/scratch-vm');
const { ScratchStorage } = requireFromGui('scratch-storage');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const keys = fs.readdirSync(ASSETS).filter((name) => /^s0[1-6]-l0[1-8]$/.test(name)).sort();
const failures = [];
for (const key of keys) for (const kind of ['starter', 'reference']) {
  const filename = path.join(ASSETS, key, `${kind}.sb3`);
  let vm;
  try {
    vm = new VM();
    vm.attachStorage(new ScratchStorage());
    await vm.loadProject(fs.readFileSync(filename));
    vm.start();
    vm.greenFlag();
    await wait(kind === 'reference' && key === 's04-l08' ? 700 : 150);
    if (kind === 'reference' && key === 's01-l02') {
      const explorer = vm.runtime.targets.find((target) => !target.isStage && target.isOriginal);
      if (!explorer || explorer.x === 0) throw new Error('green-flag movement did not execute');
    }
    if (kind === 'reference' && key === 's03-l08') {
      const names = new Set(vm.runtime.targets.map((target) => target.sprite?.name ?? target.getName?.()));
      if (!names.has('玩家') || !names.has('星星')) throw new Error('milestone roles missing');
    }
    if (kind === 'reference' && key === 's04-l08') {
      const names = new Set(vm.runtime.targets.map((target) => target.sprite?.name ?? target.getName?.()));
      for (const name of ['云', '雨滴', '水桶']) if (!names.has(name)) throw new Error(`milestone role missing: ${name}`);
      if (!vm.runtime.targets.some((target) => target.sprite?.name === '雨滴' && !target.isOriginal)) {
        throw new Error('rain broadcast did not create playable drops');
      }
    }
    if (kind === 'reference' && key === 's05-l07') {
      const painter = vm.runtime.targets.find((target) => target.sprite?.name === '小画家');
      if (!painter || painter.x === -90) throw new Error('the drawing procedure did not run');
    }
    if (kind === 'reference' && key === 's05-l08') {
      const painter = vm.runtime.targets.find((target) => target.sprite?.name === '数据画家');
      if (!painter || painter.x !== 40) throw new Error('four list values were not drawn by the procedure');
    }
  } catch (error) { failures.push(`${key}/${kind}: ${error?.message ?? error}`); }
  finally { vm?.stopAll(); vm?.quit(); }
}
console.log(`Scratch VM checked ${keys.length * 2} projects; failures=${failures.length}`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
