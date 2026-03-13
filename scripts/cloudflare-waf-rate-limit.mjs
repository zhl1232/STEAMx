#!/usr/bin/env node

const apiToken = process.env.CF_API_TOKEN
const zoneId = process.env.CF_ZONE_ID
const apiBase = process.env.CF_API_BASE ?? 'https://api.cloudflare.com/client/v4'

if (!apiToken || !zoneId) {
  console.error('Missing CF_API_TOKEN or CF_ZONE_ID in environment.')
  process.exit(1)
}

const RULESET_NAME = 'steam-rate-limits'

const RULE_DEFINITIONS = [
  {
    key: 'api-tips',
    description: 'steam: api-tips rate limit',
    expression: '(http.request.method eq "POST" and http.request.uri.path eq "/api/tips")',
    requestsPerPeriod: 10,
    period: 60,
    mitigationTimeout: 60,
  },
  {
    key: 'api-messages-send',
    description: 'steam: api-messages-send rate limit',
    expression: '(http.request.method eq "POST" and http.request.uri.path eq "/api/messages/send")',
    requestsPerPeriod: 20,
    period: 60,
    mitigationTimeout: 60,
  },
  {
    key: 'api-projects-create',
    description: 'steam: api-projects-create rate limit',
    expression: '(http.request.method eq "POST" and http.request.uri.path eq "/api/projects")',
    requestsPerPeriod: 6,
    period: 60,
    mitigationTimeout: 60,
  },
  {
    key: 'api-post',
    description: 'steam: api-post rate limit',
    expression: '(http.request.method eq "POST" and http.request.uri.path matches "^/api/")',
    requestsPerPeriod: 30,
    period: 60,
    mitigationTimeout: 60,
  },
  {
    key: 'api-get',
    description: 'steam: api-get rate limit',
    expression: '(http.request.method eq "GET" and http.request.uri.path matches "^/api/")',
    requestsPerPeriod: 120,
    period: 60,
    mitigationTimeout: 60,
  },
]

async function apiFetch(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }

  return { res, json }
}

function buildRule(definition) {
  return {
    description: definition.description,
    expression: definition.expression,
    action: 'block',
    enabled: true,
    ratelimit: {
      characteristics: ['ip.src'],
      period: definition.period,
      requests_per_period: definition.requestsPerPeriod,
      mitigation_timeout: definition.mitigationTimeout,
    },
  }
}

async function getEntrypointRuleset() {
  const { res, json } = await apiFetch(`/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`)
  if (res.status === 404) {
    return null
  }
  if (!json?.success) {
    throw new Error(`Failed to fetch entrypoint ruleset: ${JSON.stringify(json?.errors ?? json)}`)
  }
  return json.result
}

async function createEntrypointRuleset(rules) {
  const payload = {
    name: RULESET_NAME,
    description: 'Rate limiting rules for STEAM API endpoints',
    kind: 'zone',
    phase: 'http_ratelimit',
    rules,
  }

  const { json } = await apiFetch(`/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!json?.success) {
    throw new Error(`Failed to create entrypoint ruleset: ${JSON.stringify(json?.errors ?? json)}`)
  }

  return json.result
}

async function addRule(rulesetId, rule) {
  const { json } = await apiFetch(`/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  })

  if (!json?.success) {
    throw new Error(`Failed to add rule: ${JSON.stringify(json?.errors ?? json)}`)
  }
}

async function main() {
  let ruleset = await getEntrypointRuleset()

  if (!ruleset) {
    const rules = RULE_DEFINITIONS.map(buildRule)
    ruleset = await createEntrypointRuleset(rules)
    console.log(`Created entrypoint ruleset ${ruleset.id} with ${rules.length} rules.`)
    return
  }

  const existingDescriptions = new Set(
    (ruleset.rules ?? []).map((rule) => rule.description).filter(Boolean)
  )

  let created = 0
  for (const definition of RULE_DEFINITIONS) {
    if (existingDescriptions.has(definition.description)) {
      continue
    }
    await addRule(ruleset.id, buildRule(definition))
    created += 1
  }

  if (created === 0) {
    console.log('No new rules to add. Existing rules already present.')
  } else {
    console.log(`Added ${created} rate limiting rule(s) to ruleset ${ruleset.id}.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
