export async function getApiErrorMessage(response: Response, fallback = 'Request failed') {
  try {
    const payload = await response.clone().json() as { error?: string; message?: string } | null
    if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
      return payload.error
    }
    if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
      return payload.message
    }
  } catch {
    // Ignore invalid JSON and fall back to plain text.
  }

  try {
    const text = await response.text()
    if (text.trim().length > 0) {
      return text
    }
  } catch {
    // Ignore read errors and use the fallback below.
  }

  return fallback
}
