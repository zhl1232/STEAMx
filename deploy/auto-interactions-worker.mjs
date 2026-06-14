const DEFAULT_INTERVAL_SECONDS = 300
const DEFAULT_LIMIT = 20
const DEFAULT_BACKFILL_LIMIT = 100
const DEFAULT_BACKFILL_SCAN_LIMIT = 1000
const MAX_INTERVAL_SECONDS = 3600
const MAX_LIMIT = 50
const MAX_BACKFILL_LIMIT = 500
const MAX_BACKFILL_SCAN_LIMIT = 2000

let stopping = false
let stopSleep = null

function readPositiveInteger(name, fallback, max) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return Math.min(max, Math.floor(raw))
}

function readRate(name, fallback) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(1, Math.max(0, raw))
}

function readBoolean(name, fallback = false) {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  return ['1', 'true', 'on', 'yes'].includes(raw.trim().toLowerCase())
}

function requestStop() {
  stopping = true
  if (stopSleep) {
    stopSleep()
  }
}

function sleep(ms) {
  if (stopping) return Promise.resolve()

  return new Promise((resolve) => {
    let timeout = null
    stopSleep = () => {
      if (timeout) clearTimeout(timeout)
      stopSleep = null
      resolve()
    }
    timeout = setTimeout(() => {
      stopSleep = null
      resolve()
    }, ms)
  })
}

async function runBackfillOnce({ url, secret }) {
  const body = {
    targetType: 'project',
    dryRun: readBoolean('AUTO_INTERACTION_BACKFILL_DRY_RUN', false),
    limit: readPositiveInteger(
      'AUTO_INTERACTION_BACKFILL_LIMIT',
      DEFAULT_BACKFILL_LIMIT,
      MAX_BACKFILL_LIMIT,
    ),
    scanLimit: readPositiveInteger(
      'AUTO_INTERACTION_BACKFILL_SCAN_LIMIT',
      DEFAULT_BACKFILL_SCAN_LIMIT,
      MAX_BACKFILL_SCAN_LIMIT,
    ),
    sampleRate: readRate('AUTO_INTERACTION_BACKFILL_SAMPLE_RATE', 0.25),
    replyRate: readRate('AUTO_INTERACTION_BACKFILL_REPLY_RATE', 0.35),
    likeRate: readRate('AUTO_INTERACTION_BACKFILL_LIKE_RATE', 0.5),
    collectionRate: readRate('AUTO_INTERACTION_BACKFILL_COLLECTION_RATE', 0.2),
  }
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let responseBody = text
  try {
    responseBody = JSON.parse(text)
  } catch {
    // Keep the raw response text in logs.
  }

  const payload = {
    at: new Date().toISOString(),
    event: 'auto-interactions-backfill',
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - startedAt,
    request: body,
    body: responseBody,
  }

  if (response.ok) {
    console.log(JSON.stringify(payload))
  } else {
    console.error(JSON.stringify(payload))
  }
}

async function runBackfillWithRetry({ url, secret }) {
  const attempts = 6
  const retryDelayMs = 10_000

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runBackfillOnce({ url, secret })
      return
    } catch (error) {
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        event: 'auto-interactions-backfill',
        ok: false,
        attempt,
        attempts,
        error: error instanceof Error ? error.message : String(error),
      }))
      if (attempt < attempts) {
        await sleep(retryDelayMs)
      }
    }
  }
}

async function runOnce({ url, secret, limit }) {
  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit }),
  })

  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    // Keep the raw response text in logs.
  }

  const payload = {
    at: new Date().toISOString(),
    ok: response.ok,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body,
  }

  if (response.ok) {
    console.log(JSON.stringify(payload))
  } else {
    console.error(JSON.stringify(payload))
  }
}

async function main() {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) {
    console.error('Missing CRON_SECRET or INTERNAL_API_SECRET for auto interactions worker')
    process.exit(1)
  }

  const intervalSeconds = readPositiveInteger(
    'AUTO_INTERACTION_WORKER_INTERVAL_SECONDS',
    DEFAULT_INTERVAL_SECONDS,
    MAX_INTERVAL_SECONDS,
  )
  const limit = readPositiveInteger('AUTO_INTERACTION_WORKER_LIMIT', DEFAULT_LIMIT, MAX_LIMIT)
  const url =
    process.env.AUTO_INTERACTION_WORKER_URL ||
    'http://steam-app:3000/api/internal/auto-interactions/run'
  const backfillUrl =
    process.env.AUTO_INTERACTION_BACKFILL_URL ||
    'http://steam-app:3000/api/internal/auto-interactions/backfill'

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    event: 'auto-interactions-worker-started',
    intervalSeconds,
    limit,
    url,
  }))

  if (readBoolean('AUTO_INTERACTION_BACKFILL_ON_START', false)) {
    await runBackfillWithRetry({ url: backfillUrl, secret })
  }

  while (!stopping) {
    try {
      await runOnce({ url, secret, limit })
    } catch (error) {
      console.error(JSON.stringify({
        at: new Date().toISOString(),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    }

    await sleep(intervalSeconds * 1000)
  }

  console.log(JSON.stringify({
    at: new Date().toISOString(),
    event: 'auto-interactions-worker-stopped',
  }))
}

process.on('SIGINT', requestStop)
process.on('SIGTERM', requestStop)

void main()
