import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const script = path.resolve('scripts/refresh-explore-covers.mjs')

async function fixture({ complete = false, title = '项目标题' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'refresh-explore-covers-'))
  await fs.writeFile(path.join(root, '.env.local'), [
    'NEXT_PUBLIC_SUPABASE_URL=https://example.invalid',
    'SUPABASE_SERVICE_ROLE_KEY=synthetic-test-secret',
    '',
  ].join('\n'))
  const row = {
    id: 1,
    title,
    image_url: 'https://old.example/cover.webp',
    video_url: 'https://old.example/video.mp4',
  }
  await fs.writeFile(path.join(root, 'snapshot.json'), JSON.stringify({
    at: '2026-09-22T00:00:00.000Z',
    host: 'example.invalid',
    rows: [row],
  }))
  if (complete) {
    const decision = {
      id: row.id,
      title: row.title,
      decision: 'replace',
      reason: '人工复核',
      oldUrl: row.image_url,
      videoUrl: row.video_url,
      file: 'candidates/1-0.webp',
      sha256: 'abc123',
      videoSha256: 'video123',
    }
    await fs.mkdir(path.join(root, 'uploaded'), { recursive: true })
    await fs.mkdir(path.join(root, 'decisions'), { recursive: true })
    await fs.writeFile(path.join(root, 'decisions/1.json'), JSON.stringify(decision))
    await fs.writeFile(path.join(root, 'uploaded/1.json'), JSON.stringify({
      ...decision,
      newUrl: 'https://cdn.example/covers/1.webp',
    }))
  }
  return root
}

async function run(cwd, ...args) {
  try {
    const result = await exec(process.execPath, [script, ...args], { cwd })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '', error }
  }
}

test('rejects malformed, duplicate, and unknown project IDs', async () => {
  const malformed = await fixture()
  const malformedResult = await run(malformed, 'covers', '--ids=abc', `--archive=${malformed}`)
  assert.notEqual(malformedResult.code, 0)
  assert.match(`${malformedResult.stdout}${malformedResult.stderr}`, /IDs must be unique positive safe integers/)

  const duplicate = await fixture()
  const duplicateResult = await run(duplicate, 'covers', '--ids=1,1', `--archive=${duplicate}`)
  assert.notEqual(duplicateResult.code, 0)
  assert.match(`${duplicateResult.stdout}${duplicateResult.stderr}`, /IDs must be unique positive safe integers/)

  const unknown = await fixture()
  const unknownResult = await run(unknown, 'covers', '--ids=999', `--archive=${unknown}`)
  assert.notEqual(unknownResult.code, 0)
  assert.match(`${unknownResult.stdout}${unknownResult.stderr}`, /Unknown project ID in selection/)
})

test('blocks incomplete upload before any database or storage request', async () => {
  const root = await fixture()
  const result = await run(root, 'upload', `--archive=${root}`)
  assert.notEqual(result.code, 0)
  assert.match(`${result.stdout}${result.stderr}`, /Project 1: review incomplete/)
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-test-secret/)
})

test('rejects --ids for upload, migration, and verify', async () => {
  for (const mode of ['upload', 'migration', 'verify']) {
    const root = await fixture()
    const result = await run(root, mode, '--ids=1', `--archive=${root}`)
    assert.notEqual(result.code, 0, mode)
    assert.match(`${result.stdout}${result.stderr}`, /Upload\/migration\/verify operate on the complete reviewed inventory; --ids is not accepted/)
  }
})

test('matches snapshot host and escapes apostrophes and $covers$ delimiters in migration SQL', async () => {
  const root = await fixture({ complete: true, title: "孩子's $covers$ 实验" })
  const result = await run(root, 'migration', `--archive=${root}`)
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /Generated atomic migration \+ rollback/)
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /synthetic-test-secret/)

  const sql = await fs.readFile(path.join(root, 'apply.sql'), 'utf8')
  assert.match(sql, /孩子''s \$covers\$ 实验/)
  assert.match(sql, /DO \$covers_\$/)
  assert.match(sql, /SET LOCAL request\.jwt\.claim\.role = 'service_role';/)
  assert.match(sql, /https:\/\/cdn\.example\/covers\/1\.webp/)
})
