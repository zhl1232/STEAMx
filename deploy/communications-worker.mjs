const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
const stop = () => {
  stopping = true;
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
if (!secret) throw new Error("Missing CRON_SECRET or INTERNAL_API_SECRET");
const url =
  process.env.COMMUNICATIONS_WORKER_URL ||
  "http://steam-app:3000/api/internal/communications/run";
const interval = Math.max(
  10,
  Number(process.env.COMMUNICATIONS_WORKER_INTERVAL_SECONDS || 60),
);
const limit = Math.min(
  200,
  Math.max(1, Number(process.env.COMMUNICATIONS_WORKER_LIMIT || 50)),
);
while (!stopping) {
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ limit }),
    });
    if (!response.ok)
      console.error(
        "communications worker",
        response.status,
        await response.text(),
      );
    else console.log(await response.text());
  } catch (error) {
    console.error(error);
  }
  await sleep(interval * 1000);
}
