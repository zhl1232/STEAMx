export type BuildingVoiceCommand = 'next' | 'previous' | 'pause' | 'exit'

const COMMANDS: Readonly<Record<string, BuildingVoiceCommand>> = {
  下一步: 'next',
  下一页: 'next',
  上一步: 'previous',
  上一页: 'previous',
  暂停: 'pause',
  退出: 'exit',
}

/** Only complete, explicit navigation instructions are executable. No model or fuzzy matching. */
export function parseBuildingVoiceCommand(transcript: string): BuildingVoiceCommand | null {
  if (transcript.length > 80 || /[?？]/u.test(transcript)) return null

  // Keep quotes, negation, question particles and all other words intact so they
  // cannot turn a question or a discussion about a command into an instruction.
  const normalized = transcript.normalize('NFKC').replace(/[\s，,。.!！、：:；;]/gu, '')
  const match = /^小迪(?:请你|请|麻烦你)?(下一步|下一页|上一步|上一页|暂停|退出)(?:谢谢)?$/u.exec(normalized)
  return match ? COMMANDS[match[1]] ?? null : null
}
