import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./db-push.mjs', import.meta.url));
const files = [
  '20261012160000_tutor_total_usage_billing.sql',
  '20261012170000_ai_credit_grants.sql',
  '20261012171000_tutor_daily_credit_billing.sql',
];
const version = (file) => file.replace(/\.sql$/, '');
const only = (names = files) => `--only=${names.join(',')}`;
const statements = [
  'CREATE TABLE public.scoped_first (id integer);',
  'CREATE TABLE public.scoped_second (id integer);',
  'CREATE TABLE public.scoped_third (id integer);',
];

async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'steamx-db-push-test-'));
  const migrations = options.migrations ?? Object.fromEntries(files.map((file, index) => [file, statements[index]]));
  await mkdir(join(directory, 'supabase', 'migrations'), { recursive: true });
  await Promise.all(Object.entries(migrations).map(([file, sql]) =>
    writeFile(join(directory, 'supabase', 'migrations', file), sql)));

  const state = {
    queries: [],
    transactions: [],
    applied: new Set(options.applied ?? []),
    trackingExists: options.trackingExists ?? true,
    trackingCreates: 0,
    serverErrors: [],
  };
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, 'POST');
      assert.equal(request.url, '/pg/query');
      assert.equal(request.headers.apikey, 'local-test-service-key');
      let body = '';
      for await (const chunk of request) body += chunk;
      const { query } = JSON.parse(body);
      assert.equal(typeof query, 'string');
      state.queries.push(query);
      let payload;
      let status = 200;
      if (/^SELECT version\(\)/.test(query)) {
        payload = [{ v: 'PostgreSQL mock' }];
      } else if (/^SELECT to_regclass/.test(query)) {
        payload = [{ tracking_table: state.trackingExists ? 'public._schema_migrations' : null }];
      } else if (/^SELECT version FROM public\._schema_migrations/.test(query)) {
        payload = [...state.applied].sort().map((value) => ({ version: value }));
      } else if (/CREATE TABLE IF NOT EXISTS public\._schema_migrations/.test(query)) {
        state.trackingCreates++;
        state.trackingExists = true;
        payload = [];
      } else if (/^DO \$steamx_scoped_batchx*\$\n/.test(query)) {
        state.transactions.push(query);
        assert.match(query, /\nEND;\n\$steamx_scoped_batchx*\$;$/);
        const records = [...query.matchAll(/INSERT INTO public\._schema_migrations \(version, name\) VALUES \('([^']+)', '([^']+)'\);/g)];
        const outcome = await options.transaction?.({ query, records, state });
        if (outcome?.disconnectAfterCommit) {
          for (const record of records) state.applied.add(record[1]);
          request.socket.destroy();
          return;
        }
        if (outcome?.error) {
          payload = outcome.arrayError ? [{ error: outcome.error }] : { error: outcome.error };
          status = outcome.status ?? 200;
        } else {
          // The mock commits its ledger only when the complete DO succeeds.
          // The assertions below separately inspect the full outgoing SQL.
          for (const record of records) state.applied.add(record[1]);
          payload = [];
        }
      } else {
        throw new Error(`Unexpected query: ${query.slice(0, 100)}`);
      }
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(payload));
    } catch (error) {
      state.serverErrors.push(error);
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
    assert.deepEqual(state.serverErrors, []);
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  async function run(args) {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        cwd: directory,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: url,
          SUPABASE_SERVICE_ROLE_KEY: 'local-test-service-key',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Migration test child exceeded 10 seconds'));
      }, 10_000);
      child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal, stdout, stderr });
      });
    });
  }
  return { run, state };
}

test('invalid, empty, duplicate, unknown and malformed scopes fail before any database request', async (t) => {
  const { run, state } = await fixture(t);
  const cases = [
    ['push', '--only='],
    ['push', `--only=${files[0]},`],
    ['push', `--only=,${files[0]}`],
    ['push', only([files[0], files[0]])],
    ['push', `--only= ${files[0]}`],
    ['push', `--only=../${files[0]}`],
    ['push', '--only', files[0]],
    ['push', '--only-files=ignored'],
    ['push', only(), only()],
    ['push', only(), '--skip-pending'],
    ['push', only(['20261012180000_unknown.sql'])],
    ['baseline', only()],
    ['status', only()],
  ];
  for (const args of cases) {
    const result = await run(args);
    assert.equal(result.code, 1, `${args.join(' ')}: ${result.stdout} ${result.stderr}`);
    assert.equal(state.queries.length, 0, args.join(' '));
  }
});

test('a missing tracking table is read-only failure, including scoped dry-run', async (t) => {
  const { run, state } = await fixture(t, { trackingExists: false });
  const result = await run(['push', only(), '--dry-run']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /拒绝创建追踪表或自动 baseline/);
  assert.equal(state.queries.length, 1);
  assert.equal(state.trackingCreates, 0);
  assert.equal(state.transactions.length, 0);
});

test('an unrelated pending migration blocks the entire selected batch without writes', async (t) => {
  const unrelated = '20261011000000_unrelated.sql';
  const { run, state } = await fixture(t, {
    migrations: { ...Object.fromEntries(files.map((file, index) => [file, statements[index]])), [unrelated]: 'DROP TABLE public.unrelated;' },
  });
  const result = await run(['push', only()]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, new RegExp(unrelated.replaceAll('.', '\\.')));
  assert.ok(state.queries.every((query) => query.startsWith('SELECT ')));
  assert.equal(state.transactions.length, 0);
  assert.equal(state.trackingCreates, 0);
});

test('omitting one pending file from --only does not silently skip it', async (t) => {
  const { run, state } = await fixture(t);
  const result = await run(['push', only(files.slice(0, 2))]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /范围外/);
  assert.equal(state.transactions.length, 0);
});

test('scoped dry-run reads history and creates neither migration state nor tracking table', async (t) => {
  const { run, state } = await fixture(t);
  const result = await run(['push', '--', only(), '--dry-run']);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /限定 dry-run 完成/);
  assert.ok(state.queries.every((query) => query.startsWith('SELECT ')));
  assert.equal(state.applied.size, 0);
  assert.equal(state.trackingCreates, 0);
});

test('selected SQL and ledger inserts commit in one ordered transaction regardless of CLI order', async (t) => {
  const { run, state } = await fixture(t);
  const result = await run(['push', only([...files].reverse())]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(state.transactions.length, 1);
  const [batch] = state.transactions;
  assert.match(batch, /^DO \$steamx_scoped_batch\$\nBEGIN\n/);
  assert.match(batch, /PERFORM pg_catalog.set_config\('lock_timeout', '10s', true\);/);
  assert.match(batch, /LOCK TABLE public\._schema_migrations IN SHARE ROW EXCLUSIVE MODE;/);
  assert.ok(batch.indexOf('Migration history changed') < batch.indexOf(statements[0]));
  let previous = -1;
  for (let index = 0; index < files.length; index++) {
    const sqlPosition = batch.indexOf(statements[index]);
    const trackingPosition = batch.indexOf(`VALUES ('${version(files[index])}', '${files[index]}')`);
    assert.ok(sqlPosition > previous);
    assert.ok(trackingPosition > sqlPosition);
    previous = trackingPosition;
  }
  assert.equal((batch.match(/\bCOMMIT;/g) ?? []).length, 0);
  assert.ok(batch.lastIndexOf('END;') > previous);
  assert.deepEqual([...state.applied].sort(), files.map(version));
  assert.equal(state.trackingCreates, 0);
  assert.match(result.stdout, /已确认 3 个限定迁移/);
});

test('repeating a completed scoped migration is a read-only no-op', async (t) => {
  const { run, state } = await fixture(t);
  assert.equal((await run(['push', only()])).code, 0);
  const before = state.queries.length;
  const result = await run(['push', only()]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /均已执行/);
  assert.equal(state.transactions.length, 1);
  assert.ok(state.queries.slice(before).every((query) => query.startsWith('SELECT ')));
});

test('an already-applied prefix is preserved and only its remaining suffix is submitted', async (t) => {
  const { run, state } = await fixture(t, { applied: [version(files[0])] });
  const result = await run(['push', only()]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(state.transactions.length, 1);
  assert.ok(!state.transactions[0].includes(statements[0]));
  assert.ok(state.transactions[0].includes(statements[1]));
  assert.ok(state.transactions[0].includes(statements[2]));
  assert.deepEqual([...state.applied].sort(), files.map(version));
});

test('a later selected version with a missing predecessor is rejected without writes', async (t) => {
  const { run, state } = await fixture(t, { applied: [version(files[2])] });
  const result = await run(['push', only()]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /顺序不完整/);
  assert.equal(state.transactions.length, 0);
});

test('empty SQL, outer transaction commands and concurrent indexes never reach the database', async (t) => {
  for (const sql of [' -- comment only\n', 'COMMIT;', 'BEGIN; SELECT 1; COMMIT;', 'CREATE INDEX CONCURRENTLY unsafe_idx ON public.any_table(id);']) {
    await t.test(sql.trim(), async (t) => {
      const { run, state } = await fixture(t, { migrations: { [files[0]]: sql } });
      const result = await run(['push', only([files[0]])]);
      assert.equal(result.code, 1);
      assert.equal(state.transactions.length, 0);
      assert.equal(state.applied.size, 0);
    });
  }
});

test('PL/pgSQL BEGIN/END, quoted transaction words and nested comments remain valid scoped SQL', async (t) => {
  const sql = `/* outer /* nested COMMIT; */ still comment */
CREATE FUNCTION public.scoped_function() RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  RAISE NOTICE 'COMMIT; CONCURRENTLY';
END;
$body$;
COMMENT ON FUNCTION public.scoped_function() IS 'BEGIN; COMMIT; $$';`;
  const { run, state } = await fixture(t, { migrations: { [files[0]]: sql } });
  const result = await run(['push', only([files[0]])]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(state.transactions.length, 1);
  assert.ok(state.transactions[0].includes(sql));
});

test('a pg-meta SQL failure stops deployment without recording any part of the batch', async (t) => {
  const { run, state } = await fixture(t, { transaction: () => ({ error: 'second migration failed', arrayError: true }) });
  const result = await run(['push', only()]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /second migration failed/);
  assert.match(result.stderr, /必须停止应用切换/);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.applied.size, 0);
});

test('a pg-meta HTTP failure is fatal and is never automatically retried', async (t) => {
  const { run, state } = await fixture(t, { transaction: () => ({ error: 'service unavailable', status: 503 }) });
  const result = await run(['push', only()]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /HTTP 503/);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.applied.size, 0);
});

test('a lost response after commit fails honestly without asserting database rollback or retrying', async (t) => {
  const { run, state } = await fixture(t, { transaction: () => ({ disconnectAfterCommit: true }) });
  const result = await run(['push', only()]);
  assert.equal(result.code, 1);
  assert.deepEqual([...state.applied].sort(), files.map(version));
  assert.match(result.stderr, /连接中断或超时可能发生在提交之后/);
  assert.match(result.stderr, /不能断言数据库未变化/);
  assert.equal(state.transactions.length, 1);
});

test('unscoped manual dry-run retains its existing tracking-table initialization behavior', async (t) => {
  const { run, state } = await fixture(t, { trackingExists: false });
  const result = await run(['push', '--dry-run']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(state.trackingCreates, 1);
  assert.equal(state.transactions.length, 0);
  assert.equal(state.applied.size, 0);
});
