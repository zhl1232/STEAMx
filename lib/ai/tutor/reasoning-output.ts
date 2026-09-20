/**
 * Remove reasoning before text reaches SSE, speech, persistence, or history.
 * A closing-only marker makes all preceding text suspect, so callers must
 * collect the whole response before exposing any content.
 */
export function sanitizeTutorReply(text: string): string {
  const tags = /<(\/?)\s*(think|reasoning)\b[^>]*>/gi
  let output = ''
  let depth = 0
  let cursor = 0

  for (const match of text.matchAll(tags)) {
    if (depth === 0) output += text.slice(cursor, match.index)
    if (match[1]) {
      if (depth > 0) depth -= 1
      else output = '' // Missing opening marker: discard the leading trace.
    } else {
      depth += 1
    }
    cursor = match.index + match[0].length
  }
  if (depth === 0) output += text.slice(cursor)

  // Truncated opening/closing markers must not surface in a partial reply.
  // Keep ordinary comparisons such as "2 < 3" untouched.
  const fragmentStart = output.lastIndexOf('<')
  if (fragmentStart >= 0) {
    const fragment = output.slice(fragmentStart + 1).replace(/^\/\s*/, '').trim().toLowerCase()
    if (fragment && (['think', 'reasoning'].some((tag) => tag.startsWith(fragment)) || /^(think|reasoning)\b[^>]*$/.test(fragment))) {
      output = output.slice(0, fragmentStart)
    }
  }
  return output.trim()
}
