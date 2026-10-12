type TutorAudioOwner = 'tutor' | 'course-control'

type TutorAudioSession = {
  owner: TutorAudioOwner
  onInterrupt: () => void
}

let activeSession: TutorAudioSession | null = null
let sessionGeneration = 0

/** Claims remain observable after natural release, so old async fallbacks stay stale. */
export function getTutorAudioSessionGeneration(): number {
  return sessionGeneration
}

/** One explicit audio interaction owns capture/playback within this page. */
export function claimTutorAudioSession(owner: TutorAudioOwner, onInterrupt: () => void): () => void {
  const previous = activeSession
  const session = { owner, onInterrupt }
  sessionGeneration += 1
  // Install first: releasing the previous lease during its cleanup must not
  // release the new owner, including while microphone permission is pending.
  activeSession = session
  previous?.onInterrupt()

  return () => {
    if (activeSession === session) activeSession = null
  }
}
