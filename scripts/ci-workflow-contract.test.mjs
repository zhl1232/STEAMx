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
});
test('one smoke invocation retains core assets and selects physics, including conservative missing-output fallback', () => {
  const script = steps.get('Run smoke E2E').split('        run: |\n')[1]
    .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
  const directory = mkdtempSync(join(tmpdir(), 'ci-smoke-command-'));
  try {
    const stub = join(directory, 'pnpm');
    writeFileSync(stub, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    chmodSync(stub, 0o755);
    const coreSpecs = ['e2e/smoke.spec.ts', 'e2e/learning-guides.spec.ts', 'e2e/asset-cleanup.spec.ts', 'e2e/repository-cleanup-phase2.spec.ts'];
    for (const value of ['false', 'true', '']) {
      const args = execFileSync('bash', ['-eu', '-c', script], {
        encoding: 'utf8', env: { PATH: `${directory}:${process.env.PATH}`, CI_PHYSICS_TESTS: value },
      }).trim().split('\n');
      assert.deepEqual(args, ['exec', 'playwright', 'test', ...coreSpecs,
        ...(value === 'false' ? [] : ['e2e/physics-lab.spec.ts']), '--project=chromium']);
    }
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
