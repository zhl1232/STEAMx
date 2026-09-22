import { execFileSync, spawn } from "node:child_process";

const name = `communications-concurrency-${process.pid}`;
const run = (args, options = {}) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
const cleanup = () => {
  try {
    run(["rm", "-f", name]);
  } catch {}
};
process.on("exit", cleanup);
run([
  "run",
  "--rm",
  "-d",
  "--name",
  name,
  "-e",
  "POSTGRES_PASSWORD=test",
  "postgres:17-alpine",
]);
for (let i = 0; i < 60; i++) {
  try {
    if (
      run(["exec", name, "pg_isready", "-U", "postgres"]).includes(
        "accepting connections",
      )
    )
      break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const sql = (query) =>
  run([
    "exec",
    name,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ]);
sql(
  "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user $$; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE public.profiles(id uuid primary key, created_at timestamptz not null); CREATE TABLE public.notifications(id bigserial primary key,user_id uuid,type text,content text,is_read boolean default false,created_at timestamptz default now(),from_username text);",
);
run([
  "cp",
  "supabase/migrations/20260922120000_platform_communications.sql",
  `${name}:/tmp/communications.sql`,
]);
run(
  [
    "exec",
    name,
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "/tmp/communications.sql",
  ],
  { stdio: "ignore" },
);
sql(
  "INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'); INSERT INTO profiles VALUES ('00000000-0000-0000-0000-000000000001',now()); INSERT INTO platform_announcements(title,body,level,status,published_at) VALUES ('race','race','urgent','published',now()); SELECT public.deliver_announcement_service('00000000-0000-0000-0000-000000000001',1,'race','race');",
);
for (let round = 0; round < 10; round++) {
  // Alternate an already delivered unread notification and a read/delivery race.
  sql("DELETE FROM notifications; DELETE FROM communication_ledger;");
  if (round % 2 === 0)
    sql(
      "SELECT public.deliver_announcement_service('00000000-0000-0000-0000-000000000001',1,'race','race');",
    );
  const commands = [
    "SELECT public.mark_communication_read_service('00000000-0000-0000-0000-000000000001','announcement:1');",
    "UPDATE notifications SET is_read=true WHERE user_id='00000000-0000-0000-0000-000000000001' AND announcement_id=1;",
    "SELECT public.mark_all_communications_read_service('00000000-0000-0000-0000-000000000001');",
    "SELECT public.deliver_announcement_service('00000000-0000-0000-0000-000000000001',1,'race','race');",
  ];
  await Promise.all(
    commands.concat(commands).map(
      (query) =>
        new Promise((resolve, reject) => {
          const child = spawn(
            "docker",
            [
              "exec",
              name,
              "psql",
              "-U",
              "postgres",
              "-v",
              "ON_ERROR_STOP=1",
              "-c",
              `SET statement_timeout='10s'; ${query}`,
            ],
            { stdio: "pipe" },
          );
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`concurrency command failed: ${query}`)),
          );
          child.once("error", reject);
        }),
    ),
  );
  const state = sql(
    "SELECT (SELECT read_at IS NOT NULL FROM communication_ledger WHERE user_id='00000000-0000-0000-0000-000000000001' AND event_key='announcement:1'), (SELECT is_read FROM notifications WHERE announcement_id=1), (SELECT count(*) FROM communication_ledger WHERE user_id='00000000-0000-0000-0000-000000000001' AND event_key='announcement:1');",
  ).trim();
  if (!/t\s*\|\s*t\s*\|\s*1/.test(state))
    throw new Error(`inconsistent state after round ${round}: ${state}`);
}
console.info(
  "Platform communications PostgreSQL concurrency verification passed.",
);
