import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath =
  process.env.PGLITE_MODULE_PATH ||
  "/tmp/rls-validation/node_modules/@electric-sql/pglite/dist/index.js";
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite("memory://platform-communications");
const users = Array.from(
  { length: 205 },
  (_, i) => `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
);

await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${users[0]}'::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
  CREATE TABLE auth.users(id uuid primary key);
  CREATE TABLE profiles(id uuid primary key, created_at timestamptz not null);
  CREATE TABLE notifications(
    id bigserial primary key, user_id uuid not null, type text not null, content text not null,
    is_read boolean not null default false, created_at timestamptz not null default now(),
    from_username text, title text, system_kind text, announcement_id bigint
  );
`);
await db.exec(
  await fs.readFile(
    new URL(
      "../supabase/migrations/20260922120000_platform_communications.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);

await db.exec(
  `INSERT INTO auth.users(id) VALUES ${users.map((id) => `('${id}')`).join(",")};`,
);
await db.exec(
  `INSERT INTO profiles(id,created_at) VALUES ${users.map((id, i) => `('${id}', '2026-09-21T00:00:00Z'::timestamptz)`).join(",")};`,
);
await db.exec(
  `UPDATE platform_welcome_settings SET activated_after = '2026-09-20T00:00:00Z'::timestamptz;`,
);

let row = (
  await db.query(
    `SELECT public.create_welcome_service('${users[0]}') AS created`,
  )
).rows[0];
if (row.created !== true) throw new Error("welcome should be created");
row = (
  await db.query(
    `SELECT public.create_welcome_service('${users[0]}') AS created`,
  )
).rows[0];
if (row.created !== false) throw new Error("welcome should be idempotent");
if (
  Number(
    (
      await db.query(
        `SELECT count(*) FROM notifications WHERE user_id='${users[0]}'`,
      )
    ).rows[0].count,
  ) !== 1
)
  throw new Error("welcome notification count mismatch");

await db.exec(
  `INSERT INTO profiles(id,created_at) VALUES ('00000000-0000-0000-0000-000000000999','2026-09-19T00:00:00Z'); INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000999');`,
);
if (
  (
    await db.query(
      `SELECT public.create_welcome_service('00000000-0000-0000-0000-000000000999') AS created`,
    )
  ).rows[0].created !== false
)
  throw new Error("pre-cutoff welcome incorrectly created");

const announcement = (
  await db.query(
    `INSERT INTO platform_announcements(title,summary,body,level,status,published_at) VALUES ('Test','Summary','Body','urgent','published','2026-09-21T00:00:00Z') RETURNING id`,
  )
).rows[0].id;
if (
  (
    await db.query(
      `SELECT public.claim_announcement_popup_service('${users[0]}',${announcement}) AS claimed`,
    )
  ).rows[0].claimed !== true
)
  throw new Error("popup claim failed");
if (
  (
    await db.query(
      `SELECT public.claim_announcement_popup_service('${users[0]}',${announcement}) AS claimed`,
    )
  ).rows[0].claimed !== false
)
  throw new Error("popup claim was not once-only");
await db.query(
  `SELECT public.mark_communication_read_service('${users[0]}','announcement:${announcement}')`,
);

let result = (
  await db.query(
    `SELECT public.run_announcement_batch_service(${announcement},50) AS value`,
  )
).rows[0].value;
if (result.delivered !== 50 || result.done !== false)
  throw new Error(`first delivery batch mismatch: ${JSON.stringify(result)}`);
result = (
  await db.query(
    `SELECT public.run_announcement_batch_service(${announcement},50) AS value`,
  )
).rows[0].value;
if (result.delivered !== 50 || result.done !== false)
  throw new Error(`second delivery batch mismatch: ${JSON.stringify(result)}`);
for (let i = 0; i < 4; i++)
  result = (
    await db.query(
      `SELECT public.run_announcement_batch_service(${announcement},50) AS value`,
    )
  ).rows[0].value;
if (result.done !== true) throw new Error("delivery did not finish");
const delivered = (
  await db.query(
    `SELECT count(*) FROM communication_ledger WHERE announcement_id=${announcement} AND delivered_at IS NOT NULL`,
  )
).rows[0].count;
if (Number(delivered) !== 206)
  throw new Error(`delivery count mismatch: ${delivered}`);
const prior = (
  await db.query(
    `SELECT banner_dismissed_at, popup_claimed_at, read_at FROM communication_ledger WHERE user_id='${users[0]}' AND announcement_id=${announcement}`,
  )
).rows[0];
if (!prior.read_at || !prior.popup_claimed_at)
  throw new Error("prior state was lost");
const firstNotification = (
  await db.query(
    `SELECT is_read FROM notifications WHERE user_id='${users[0]}' AND announcement_id=${announcement}`,
  )
).rows[0];
if (!firstNotification.is_read)
  throw new Error(
    "pre-fanout read state was not applied to delivered notification",
  );

const important = (
  await db.query(
    `INSERT INTO platform_announcements(title,summary,body,level,status,published_at) VALUES ('Important','S','B','important','published','2026-09-21T00:00:00Z') RETURNING id`,
  )
).rows[0].id;
if (
  (
    await db.query(
      `SELECT public.claim_announcement_popup_service('${users[1]}',${important}) AS claimed`,
    )
  ).rows[0].claimed !== false
)
  throw new Error("important announcement incorrectly claimed popup");

const draft = (
  await db.query(
    `INSERT INTO platform_announcements(title,summary,body,level,status) VALUES ('Publish','S','B','normal','draft') RETURNING id`,
  )
).rows[0].id;
const published = (
  await db.query(
    `SELECT public.publish_platform_announcement_service(${draft}) AS value`,
  )
).rows[0].value;
const publishedAgain = (
  await db.query(
    `SELECT public.publish_platform_announcement_service(${draft}) AS value`,
  )
).rows[0].value;
if (published.published_at !== publishedAgain.published_at)
  throw new Error("publish cutoff changed on repeat");

await db.exec(
  `DELETE FROM notifications WHERE user_id='${users[0]}' AND announcement_id=${announcement}; SELECT public.retry_platform_announcement_service(${announcement});`,
);
await db.query(
  `SELECT public.run_announcement_batch_service(${announcement},50)`,
);
if (
  Number(
    (
      await db.query(
        `SELECT count(*) FROM notifications WHERE user_id='${users[0]}' AND announcement_id=${announcement}`,
      )
    ).rows[0].count,
  ) !== 0
)
  throw new Error("clear followed by retry redelivered notification");

await db.exec(
  `CREATE FUNCTION fail_communications() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.announcement_id IS NOT NULL THEN RAISE EXCEPTION 'fault injection'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_communications BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_communications();`,
);
const failing = (
  await db.query(
    `INSERT INTO platform_announcements(title,summary,body,level,status,published_at) VALUES ('Fail','S','B','normal','published','2026-09-21T00:00:00Z') RETURNING id`,
  )
).rows[0].id;
const failed = (
  await db.query(
    `SELECT public.run_announcement_batch_service(${failing},10) AS value`,
  )
).rows[0].value;
if (!failed.error)
  throw new Error("fault injection did not report batch failure");
const failedState = (
  await db.query(
    `SELECT status,attempts FROM communication_worker_state WHERE name='announcement:${failing}'`,
  )
).rows[0];
if (failedState.status !== "error" || Number(failedState.attempts) !== 1)
  throw new Error("batch failure state was not persisted");
await db.exec(
  `DROP TRIGGER fail_communications ON notifications; DROP FUNCTION fail_communications(); SELECT public.retry_platform_announcement_service(${failing});`,
);
const retryResult = (
  await db.query(
    `SELECT public.run_announcement_batch_service(${failing},10) AS value`,
  )
).rows[0].value;
if (retryResult.error || retryResult.delivered !== 10)
  throw new Error("failed batch did not retry successfully");

await db.exec(`SET ROLE anon`);
try {
  await db.query(`SELECT public.create_welcome_service('${users[0]}')`);
  throw new Error("anon called service RPC");
} catch (error) {
  if (!String(error).toLowerCase().includes("permission")) throw error;
}
try {
  await db.query(
    `INSERT INTO communication_ledger(user_id,event_key,kind) VALUES ('${users[0]}','forged','welcome')`,
  );
  throw new Error("anon mutated ledger");
} catch (error) {
  if (!String(error).toLowerCase().includes("permission")) throw error;
}
await db.exec(`RESET ROLE`);

await db.exec(
  `INSERT INTO platform_announcements(title,summary,body,level,status,published_at) VALUES ('Rollback','S','B','normal','draft',NULL);`,
);
if (
  Number(
    (
      await db.query(
        `SELECT count(*) FROM communication_ledger WHERE kind='welcome'`,
      )
    ).rows[0].count,
  ) !== 1
)
  throw new Error("unexpected welcome ledger rows");

console.info("Platform communications SQL verification passed (PGlite).");
await db.close();
