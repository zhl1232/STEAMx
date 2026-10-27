import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const release = readFileSync('.github/workflows/release.yml', 'utf8');
const steps = new Map(ci.split('      - name: ').slice(1).map(block => [block.split('\n')[0], block]));
const core = "if: (steps.scope.outputs.mode == 'full' || steps.scope.outputs.mode == 'home-ui')";
test('module selection preserves core checks and PR production route boundaries', () => {
  for (const name of ['Setup pnpm', 'Setup Node.js', 'Verify repository cleanup safety', 'Install dependencies',
    'Lint code base (oxlint)', 'TypeScript type check (tsgo)', 'Run unit tests',
    'Verify deployment, migration, and SEO scripts', 'Run smoke E2E']) {
    assert(steps.get(name).includes(core), name);
  }
  assert(!steps.has('Verify retained interface assets'), 'retained assets share the smoke server');
  for (const name of ['Build app', 'Verify production and development route boundaries']) {
    assert(steps.get(name).includes(`${core} && github.event_name == 'pull_request'`));
  }
});
test('specialties and their evidence skip only after an explicit negative impact result', () => {
  const expected = {
    'Verify native store transactions': 'store-db',
    'Verify portable physics lab': 'physics',
    'Verify project video presentation pilot': 'project-video',
    'Verify immersive building layout': 'building',
    'Verify local Vosk engineering (silent input; acoustic benchmark is manual)': 'voice',
    'Preserve immersive building evidence': 'building',
    'Preserve local voice acceptance evidence': 'voice',
  };
  for (const [name, output] of Object.entries(expected)) {
    assert(steps.get(name).includes(`steps.test-plan.outputs.${output} != 'false'`), name);
    assert(steps.get(name).includes("steps.scope.outputs.mode == 'full' || steps.scope.outputs.mode == 'home-ui'"));
  }
  assert(steps.get('Select affected specialty checks').includes('node scripts/ci-test-plan.mjs'));
  assert(steps.get('Verify CI scope policy').includes('scripts/ci-test-plan.test.mjs'));
  assert(steps.get('Verify CI scope policy').includes('scripts/ci-test-impact.test.mjs'));
  assert(steps.get('Verify native store transactions').includes('node scripts/test-store-native.mjs'));
});
test('one smoke invocation retains untagged core and selects details only with explicit negative outputs', () => {
  const script = steps.get('Run smoke E2E').split('        run: |\n')[1]
    .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  const directory = mkdtempSync(join(tmpdir(), 'ci-smoke-command-'));
  try {
    const stub = join(directory, 'pnpm');
    writeFileSync(stub, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    chmodSync(stub, 0o755);
    const extraSpecs = ['e2e/learning-guides.spec.ts', 'e2e/asset-cleanup.spec.ts', 'e2e/repository-cleanup-phase2.spec.ts', 'e2e/physics-lab.spec.ts'];
    const keys = ['CI_PHYSICS_TESTS', 'CI_SMOKE_HOME', 'CI_SMOKE_PLAYGROUND', 'CI_SMOKE_NATURE', 'CI_GUIDES_TESTS', 'CI_ASSET_TESTS'];
    const invoke = env => execFileSync('bash', ['-eu', '-c', script], {
      encoding: 'utf8', env: { PATH: `${directory}:${process.env.PATH}`, ...env },
    }).trim().split('\n');
    for (const value of ['true', '', 'malformed']) {
      assert.deepEqual(invoke(Object.fromEntries(keys.map(key => [key, value]))),
        ['exec', 'playwright', 'test', 'e2e/smoke.spec.ts', ...extraSpecs, '--project=chromium']);
    }
    const narrow = Object.fromEntries(keys.map(key => [key, 'false']));
    assert.deepEqual(invoke(narrow), ['exec', 'playwright', 'test', 'e2e/smoke.spec.ts', '--project=chromium',
      '--grep-invert', '@smoke-home|@smoke-playground|@smoke-nature']);
    assert.deepEqual(invoke({ ...narrow, CI_SMOKE_HOME: 'true', CI_GUIDES_TESTS: 'true' }),
      ['exec', 'playwright', 'test', 'e2e/smoke.spec.ts', 'e2e/learning-guides.spec.ts', '--project=chromium',
        '--grep-invert', '@smoke-playground|@smoke-nature']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('release reuses scope proof and still gates deployment on current CI and image', () => {
  assert.match(release, /ci:\n    needs: release-scope\n    with:\n      profile: \$\{\{ needs.release-scope.outputs.ci-profile \}\}/);
  assert(release.includes('before: ${{ needs.release-scope.outputs.before }}'));
  assert(release.includes('verified-sha: ${{ needs.release-scope.outputs.verified-sha }}'));
  assert(release.includes('deploy-production:\n    needs: [ci, build-image]'));
  assert(release.includes('group: release-production\n  cancel-in-progress: false'));
  assert(ci.includes('  test-and-lint:\n'));
  assert(ci.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
  assert(!ci.includes('paths-ignore:') && !ci.includes('pull_request_target:'));
});
test('header uncertainty executes the full voice probe and never ignores its failure', () => {
  const voice = release.split('  verify-course-voice-loading:')[1].split('  deploy-production:')[0];
  const fallback = "if: needs.release-scope.outputs.voice-mode != 'headers' || steps.headers.outcome != 'success'";
  assert.equal(voice.split(fallback).length - 1, 4);
  assert.equal(voice.split('continue-on-error: true').length - 1, 1);
  assert.match(voice, /id: headers[\s\S]+continue-on-error: true[\s\S]+run: node scripts\/check-building-voice-headers.mjs/);
  assert(voice.includes(`id: full-voice\n        ${fallback}\n        run: node scripts/check-building-voice-loading.mjs`));
});

test('draft PRs skip the entire stable job before any runner or light gate', () => {
  const condition = "if: github.event_name != 'pull_request' || github.event.pull_request.draft != true";
  assert(ci.includes(`  test-and-lint:
    # Draft PRs create a skipped check but never allocate a runner.
    ${condition}
    runs-on: ubuntu-latest`));
  assert(ci.includes('types: [opened, synchronize, reopened, ready_for_review, converted_to_draft]'));
});

test('PR build uses a bounded read-only public fixture through route boundary checks', () => {
  const startName = 'Start anonymous public content fixture';
  const stopName = 'Stop anonymous public content fixture';
  const start = steps.get(startName);
  const stop = steps.get(stopName);
  assert(ci.includes('NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54329'));
  assert(start.includes(`${core} && github.event_name == 'pull_request'`));
  assert(stop.includes("if: always() && (steps.scope.outputs.mode == 'full' || steps.scope.outputs.mode == 'home-ui') && github.event_name == 'pull_request'"));
  assert(start.includes('node e2e/store-integration/data-server.mjs'));
  assert(start.includes('"$RUNNER_TEMP/ci-public-content.log" 2>&1 &'));
  assert(start.includes('echo "$!" > "$RUNNER_TEMP/ci-public-content.pid"'));
  assert(start.includes('attempt < 30'));
  assert(start.includes('AbortSignal.timeout(1000)'));
  assert(start.includes('response.status === 200 && Array.isArray(data) && data.length === 0'));
  assert.equal(start.split('process.kill(pid, 0)').length - 1, 2);
  assert(stop.includes('kill "$fixture_pid"'));
  assert(stop.includes('[[ "$fixture_pid" =~ ^[1-9][0-9]*$ ]]'));
  assert(!stop.includes('pkill') && !stop.includes('killall'));
  const names = [...steps.keys()];
  assert(names.indexOf(startName) < names.indexOf('Build app'));
  assert(names.indexOf('Verify production and development route boundaries') < names.indexOf(stopName));
});


test('PR and main use affected unit planning with a conservative fallback', () => {
  assert(steps.get('Run unit tests').includes('node scripts/ci-unit-tests.mjs'));
  assert(steps.get('Verify CI scope policy').includes('scripts/ci-unit-tests.test.mjs'));
  assert(!ci.includes('--passWithNoTests'));
  assert.equal(ci.split('continue-on-error: true').length - 1, 1);
  assert(steps.get('Download tested source proof').includes('continue-on-error: true'));
  assert(!steps.get('Verify reusable PR checks').includes('continue-on-error: true'));
  const runner = readFileSync('scripts/ci-unit-tests.mjs', 'utf8');
  assert(runner.includes("process.env.GITHUB_EVENT_NAME === 'pull_request'"));
  assert(runner.includes("process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main'"));
  assert(runner.includes("let plan = { unitMode: 'full' }"));
});

test('browser narrowing excludes reviewed tags only; core health/login/auth and new untagged tests remain', () => {
  const smoke = readFileSync('e2e/smoke.spec.ts', 'utf8');
  for (const title of ['首页 smoke', '探索页 smoke', '登录页 smoke', '登录页移动端聚焦表单',
    '手机验证码登录保持两步表单和重发倒计时', '未登录访问商店会跳转到登录页']) {
    assert(smoke.includes(`test('${title}', async`), title);
  }
  assert(smoke.includes('test(`未登录访问 ${target} 会带上完整回跳地址`, async'));
  assert(smoke.includes("tag: '@smoke-home'"));
  assert(smoke.includes("tag: '@smoke-playground'"));
  assert(smoke.includes("tag: '@smoke-nature'"));
  assert(smoke.includes("await expect(page.getByRole('checkbox')).toBeChecked()"), 'preserve hydration synchronization');
});


test('verified reuse gates classification before dependencies and every expensive check', () => {
  const names = [...steps.keys()];
  assert(names.indexOf('Verify reusable PR checks') < names.indexOf('Classify CI scope'));
  assert(names.indexOf('Classify CI scope') < names.indexOf('Setup pnpm'));
  for (const name of ['Classify CI scope', 'Verify CI scope policy']) {
    assert(steps.get(name).includes("if: steps.reuse.outputs.reuse != 'true'"), name);
  }
  // No scope output is set on reuse; every dependency/test/build step must
  // therefore retain its existing explicit full/home-ui condition.
  const early = new Set(['Checkout repository', 'Locate passed PR checks', 'Download tested source proof',
    'Verify reusable PR checks', 'Classify CI scope', 'Verify CI scope policy',
    'Record tested PR source', 'Preserve tested PR source']);
  for (const [name, block] of steps) {
    if (!early.has(name)) assert(block.includes("steps.scope.outputs.mode == 'full' || steps.scope.outputs.mode == 'home-ui'"), name);
  }
  assert(steps.get('Locate passed PR checks').includes("github.event_name == 'push' && github.ref == 'refs/heads/main'"));
  assert(steps.get('Download tested source proof').includes("if: steps.pr-ci.outputs.run-id != ''"));
  assert(steps.get('Verify reusable PR checks').includes("if: steps.pr-ci.outputs.run-id != ''"));
  assert(steps.get('Download tested source proof').includes('run-id: ${{ steps.pr-ci.outputs.run-id }}'));
  assert(steps.get('Download tested source proof').includes('name: ${{ steps.pr-ci.outputs.artifact-name }}'));
});

test('only a successful same-repository PR uploads immutable source proof after checks', () => {
  const names = [...steps.keys()];
  assert.deepEqual(names.slice(-2), ['Record tested PR source', 'Preserve tested PR source']);
  for (const name of names.slice(-2)) {
    assert(steps.get(name).includes("if: success() && github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository"));
    assert(!steps.get(name).includes('continue-on-error'));
  }
  const upload = steps.get('Preserve tested PR source');
  assert(upload.includes('name: ${{ steps.source-proof.outputs.artifact-name }}'));
  assert(upload.includes('overwrite: false'));
  assert(upload.includes('if-no-files-found: error'));
  assert(upload.includes('path: ${{ runner.temp }}/ci-source-proof/source-proof.json'));
  assert(steps.get('Verify CI scope policy').includes('scripts/ci-source-proof.test.mjs scripts/release-ci-reuse.test.mjs'));
  assert(release.includes('      actions: read\n      pull-requests: read'));
});

test('optional OSS mirror failure preserves GHCR deployment fallback', () => {
  const mirror = release.split('      - name: Mirror image archive to Aliyun OSS\n')[1]?.split('\n  verify-course-voice-loading:')[0];
  assert(mirror?.includes('continue-on-error: true'));
  assert(mirror?.includes('DEPLOY_OSS_ACCESS_KEY_ID'));
  assert(release.includes('image_id: ${{ steps.oss.outputs.image_id }}'));
  assert(release.includes('IMAGE_ID: ${{ needs.build-image.outputs.image_id }}'));
  assert(release.includes('envs: GHCR_USERNAME,GHCR_TOKEN,REGISTRY_IMAGE,IMAGE_DIGEST,IMAGE_OSS_URL,IMAGE_ID,'));
});
