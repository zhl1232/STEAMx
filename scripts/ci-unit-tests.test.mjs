import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { GLOBAL_SOURCE_CONTRACT_TESTS, runCIUnitTests, selectUnitTests } from './ci-unit-tests.mjs';

const plan = { unitMode: 'related', unitSources: ['lib/support/service.ts', 'components/support/chat.test.tsx'],
  unitOwners: [['lib/support/', 'components/support/']] };
const files = ['lib/support/service.test.ts', 'components/support/chat.test.tsx',
  'app/api/notifications/route.test.ts', ...GLOBAL_SOURCE_CONTRACT_TESTS, 'lib/unrelated.test.ts'];
const affected = files.slice(0, -1);

test('owner suites and changed tests are unioned with actual reverse graph consumers', async () => {
  const selected = await selectUnitTests(plan, files, async related => {
    assert.ok(related.includes('lib/support/service.ts'));
    assert.ok(related.includes('lib/support/service.test.ts'));
    assert.ok(related.includes('components/support/chat.test.tsx'));
    for (const file of GLOBAL_SOURCE_CONTRACT_TESTS) assert.ok(related.includes(file));
    return affected;
  });
  assert.deepEqual(selected, [...affected].sort());
});

test('global source scanners are mandatory even for unrelated isolated support changes', async () => {
  assert.deepEqual(GLOBAL_SOURCE_CONTRACT_TESTS, ['lib/seo/internal-links.test.ts', 'lib/seo/title.test.ts']);
  for (const contract of GLOBAL_SOURCE_CONTRACT_TESTS) {
    await assert.rejects(selectUnitTests(plan, files.filter(file => file !== contract), async () => affected));
    await assert.rejects(selectUnitTests(plan, files, async () => affected.filter(file => file !== contract)));
  }
});

test('missing owner coverage, missing changed tests and incomplete graph cannot narrow', async () => {
  for (const altered of [{ ...plan, unitOwners: [['lib/missing/']] },
    { ...plan, unitSources: ['lib/support/new.test.ts'] },
    { ...plan, unitSources: [] }, { ...plan, unitMode: 'full' }]) {
    await assert.rejects(selectUnitTests(altered, files, async () => files));
  }
  for (const affected of [[], null, ['lib/not-discovered.test.ts'], [files[0]]]) {
    await assert.rejects(selectUnitTests(plan, files, async () => affected));
  }
  await assert.rejects(selectUnitTests(plan, files, async () => { throw Error('Graph transform failed'); }));
});

const context = (graph = affected) => ({
  config: {},
  globTestSpecifications: async () => files.map(file => ({ moduleId: resolve(file) })),
  getRelevantTestSpecifications: async () => graph.map(file => ({ moduleId: resolve(file) })),
  close: async () => {},
});

test('runner uses public Vitest graph and executes selected tests exactly once', async () => {
  const ctx = context(), calls = [];
  let closed = false;
  ctx.close = async () => { closed = true; };
  const status = await runCIUnitTests(plan, { create: async () => ctx,
    execute: selected => { assert.ok(closed); calls.push(selected); return 0; }, log: () => {} });
  assert.equal(status, 0);
  assert.deepEqual(calls, [[...affected].sort()]);
  assert.ok(ctx.config.related.includes(resolve('lib/support/service.ts')));
});

test('graph failures fall back to a single full run before execution', async () => {
  for (const create of [async () => { throw Error('Cannot initialize graph'); },
    async () => context([]), async () => ({ ...context(),
      getRelevantTestSpecifications: async () => { throw Error('Missing source'); } })]) {
    const calls = [];
    assert.equal(await runCIUnitTests(plan, { create, execute: files => { calls.push(files); return 0; },
      log: () => {} }), 0);
    assert.deepEqual(calls, [[]]);
  }
});

test('real assertion failures and thrown execution errors never trigger a full rerun', async () => {
  const calls = [];
  assert.equal(await runCIUnitTests(plan, { create: async () => context(),
    execute: files => { calls.push(files); return 1; }, log: () => {} }), 1);
  assert.equal(calls.length, 1);
  await assert.rejects(runCIUnitTests(plan, { create: async () => context(),
    execute: () => { throw Error('Assertion failure'); }, log: () => {} }), /Assertion failure/);
});

test('full plans do not load the graph or pass a no-tests exemption', async () => {
  const calls = [];
  assert.equal(await runCIUnitTests({ unitMode: 'full' }, {
    create: async () => { throw Error('Should not load Vitest graph'); },
    execute: files => { calls.push(files); return 0; }, log: () => {},
  }), 0);
  assert.deepEqual(calls, [[]]);
});
