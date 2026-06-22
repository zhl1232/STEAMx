/**
 * DFA-based sensitive word filter (isomorphic — works on client & server)
 *
 * Uses a Trie + DFA for O(n) multi-pattern matching against user text.
 * Word lists are embedded as TS modules — no runtime file I/O.
 */

import { SENSITIVE_WORDS_ZH } from './words-zh'
import { SENSITIVE_WORDS_EN } from './words-en'

// ────────────────────────────────────────
// Types
// ────────────────────────────────────────

export interface FilterResult {
  /** true when no sensitive words were found */
  passed: boolean
  /** list of matched sensitive words (de-duped) */
  matched: string[]
  /** input text with matched words replaced by asterisks */
  filtered: string
}

// ────────────────────────────────────────
// DFA Trie
// ────────────────────────────────────────

interface TrieNode {
  children: Map<string, TrieNode>
  /** if this node marks the end of a word, store the original word */
  word: string | null
}

function createNode(): TrieNode {
  return { children: new Map(), word: null }
}

function buildTrie(words: readonly string[]): TrieNode {
  const root = createNode()

  for (const raw of words) {
    const word = raw.trim()
    if (!word) continue

    const normalised = normalise(word)
    let node = root

    for (const ch of normalised) {
      let child = node.children.get(ch)
      if (!child) {
        child = createNode()
        node.children.set(ch, child)
      }
      node = child
    }

    node.word = word
  }

  return root
}

// ────────────────────────────────────────
// Normalisation helpers
// ────────────────────────────────────────

const FULL_TO_HALF: Record<string, string> = {}
for (let i = 0xFF01; i <= 0xFF5E; i++) {
  FULL_TO_HALF[String.fromCharCode(i)] = String.fromCharCode(i - 0xFEE0)
}

function normalise(text: string): string {
  let out = ''
  for (const ch of text) {
    const mapped = FULL_TO_HALF[ch]
    out += (mapped ?? ch).toLowerCase()
  }
  return out
}

// ────────────────────────────────────────
// Singleton
// ────────────────────────────────────────

let _trie: TrieNode | null = null

function getTrie(): TrieNode {
  if (!_trie) {
    _trie = buildTrie([...SENSITIVE_WORDS_ZH, ...SENSITIVE_WORDS_EN])
  }
  return _trie
}

// ────────────────────────────────────────
// Public API
// ────────────────────────────────────────

/**
 * Check text against the sensitive word filter.
 * Returns detailed result: pass/fail, matched words, and filtered text.
 */
export function checkContent(text: string): FilterResult {
  if (!text) return { passed: true, matched: [], filtered: '' }

  const root = getTrie()
  const normalised = normalise(text)
  const chars = Array.from(text)
  const normChars = Array.from(normalised)
  const len = normChars.length

  const matchedSet = new Set<string>()
  const maskRanges: [number, number][] = []

  for (let i = 0; i < len; i++) {
    let node = root
    for (let j = i; j < len; j++) {
      const child = node.children.get(normChars[j])
      if (!child) break
      node = child
      if (node.word) {
        matchedSet.add(node.word)
        maskRanges.push([i, j])
      }
    }
  }

  if (matchedSet.size === 0) {
    return { passed: true, matched: [], filtered: text }
  }

  const masked = new Uint8Array(len)
  for (const [start, end] of maskRanges) {
    for (let k = start; k <= end; k++) masked[k] = 1
  }

  let filtered = ''
  for (let i = 0; i < len; i++) {
    filtered += masked[i] ? '*' : chars[i]
  }

  return {
    passed: false,
    matched: Array.from(matchedSet),
    filtered,
  }
}

/**
 * Return the text with sensitive words replaced by asterisks.
 */
export function filterContent(text: string): string {
  return checkContent(text).filtered
}

/**
 * Quick boolean check — true if no sensitive words detected.
 */
export function isClean(text: string): boolean {
  return checkContent(text).passed
}
