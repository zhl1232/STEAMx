import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyRelease, detectRelease } from './release-scope.mjs';

test('model, confirmation and documentation updates skip the application image', () => {
  assert.equal(classifyRelease(['public/courses/ldraw/3-example.mpd', 'scripts/ldraw-models/3-example.ldr',
    'scripts/ldraw-reviews/3-example.ldr.json', 'scripts/courseware/3-example.json', 'docs/ldraw-status.md',
    'PROJECT_INDEX.md']).deploy, false);
});

test('mixed code/content and deployment tooling changes deploy the application', () => {
  for (const path of ['app/api/courses/ldraw-step/route.ts', '.github/workflows/release.yml',
    'scripts/publish-ldraw-assets.mjs', 'Dockerfile', '.agents/skills/image-to-ldraw/references/part-metadata.json']) {
    assert.equal(classifyRelease(['docs/ldraw-status.md', path]).deploy, true);
  }
});

test('tags and manual releases deploy without needing a change list', () => {
  const git = () => { throw Error('must not call git'); };
  assert.equal(detectRelease({ GITHUB_REF: 'refs/tags/v1' }, git).deploy, true);
  assert.equal(detectRelease({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, git).deploy, true);
});

test('unknown or failed comparisons conservatively deploy', () => {
  assert.equal(classifyRelease([]).deploy, true);
  assert.equal(detectRelease({ RELEASE_BEFORE: '0'.repeat(40), GITHUB_SHA: 'a'.repeat(40) }).deploy, true);
  assert.equal(detectRelease({ RELEASE_BEFORE: 'b'.repeat(40), GITHUB_SHA: 'a'.repeat(40) }, () => {
    throw Error('unavailable');
  }).deploy, true);
});

test('git comparison includes deleted code and handles paths containing newlines', () => {
  const calls = [];
  const result = detectRelease({ RELEASE_BEFORE: 'b'.repeat(40), GITHUB_SHA: 'a'.repeat(40) }, (args) => {
    calls.push(args);
    return args[0] === 'diff' ? 'app/old.ts\0docs/new.ts\0docs/a\nb.md\0' : '';
  });
  assert.equal(result.deploy, true);
  assert(calls[1].includes('--no-renames'));
  assert.equal(calls[0][0], 'fetch');
});


test('standalone ops changes skip images but mixed release/application changes do not', () => {
  const ops = ['.github/workflows/ops-auth-phone-provider.yml', 'deploy/auth-phone-provider.sh', 'deploy/auth-phone-provider.test.mjs'];
  assert.equal(classifyRelease(ops).deploy, false);
  for (const file of ['.github/workflows/release.yml', '.github/workflows/ci.yml', 'deploy/registry-deploy.sh', 'app/page.tsx']) {
    assert.equal(classifyRelease([...ops, file]).deploy, true);
  }
  assert.equal(classifyRelease(ops, { force: true }).deploy, true);
});
