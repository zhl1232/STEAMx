// Export the canonical portable lab to an empty directory for standalone hosting.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) throw Error('Usage: node scripts/export-physics-lab.mjs /absolute/empty/output-directory');
const destination = resolve(target);
const source = fileURLToPath(new URL('../public/physics-lab/', import.meta.url));
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).length) throw Error('Choose an empty output directory; existing files are never removed.');
await cp(source, destination, { recursive: true });
process.stdout.write(`Physics lab exported to ${destination}\n`);
