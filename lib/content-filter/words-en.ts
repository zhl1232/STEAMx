/**
 * English profanity word list — curated subset for children's STEAM platform
 *
 * Source reference: LDNOOBW (CC0), surge-ai/profanity (MIT)
 *
 * Maintenance:
 * - Add new words at the end of the appropriate section
 * - The list is loaded once to build a DFA Trie at startup
 */
export const SENSITIVE_WORDS_EN: readonly string[] = [
  // ─── Strong profanity ───
  "fuck", "fucker", "fucking", "motherfucker", "motherfucking",
  "shit", "shitty", "bullshit", "horseshit",
  "bitch", "bitches", "son of a bitch",
  "asshole", "arsehole",
  "bastard", "damn", "dammit", "goddamn",
  "cunt", "dick", "cock", "prick", "pussy",
  "wanker", "twat", "bollocks",

  // ─── Slurs / hate speech ───
  "nigger", "nigga", "negro",
  "faggot", "fag", "dyke",
  "retard", "retarded",
  "chink", "gook", "spic", "kike", "wetback",
  "tranny",

  // ─── Sexual ───
  "porn", "pornography", "hentai",
  "blowjob", "handjob", "rimjob",
  "dildo", "vibrator",
  "orgasm", "cumshot", "creampie",
  "masturbate", "masturbation",
  "anal sex", "oral sex",

  // ─── Violence / threats ───
  "kill yourself", "kys",
  "bomb threat", "shoot up",
  "school shooting",
  "i will kill you", "gonna kill you",

  // ─── Drugs ───
  "cocaine", "heroin", "meth", "crack",
  "weed dealer", "drug dealer",

  // ─── Spam patterns ───
  "dm me for", "check my bio",
  "click this link", "free money",
  "make money fast", "work from home scam",
] as const
