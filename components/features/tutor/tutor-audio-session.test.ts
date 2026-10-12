import { describe, expect, it, vi } from 'vitest'
import { claimTutorAudioSession, getTutorAudioSessionGeneration } from './tutor-audio-session'

describe('tutor audio session leases', () => {
  it('interrupts before returning a new lease and old cleanup cannot release the new owner', () => {
    const courseInterrupted = vi.fn()
    let releaseTutor = () => {}
    const tutorInterrupted = vi.fn(() => releaseTutor())
    releaseTutor = claimTutorAudioSession('tutor', tutorInterrupted)
    const releaseCourse = claimTutorAudioSession('course-control', courseInterrupted)
    expect(tutorInterrupted).toHaveBeenCalledOnce()
    releaseTutor()
    const releaseNewTutor = claimTutorAudioSession('tutor', () => {})
    expect(courseInterrupted).toHaveBeenCalledOnce()
    releaseCourse()
    releaseNewTutor()
  })

  it('retains the last claim generation after release so late work cannot become current again', () => {
    const start = getTutorAudioSessionGeneration()
    const interrupted = vi.fn()
    const releaseTutor = claimTutorAudioSession('tutor', interrupted)
    const tutorGeneration = getTutorAudioSessionGeneration()
    expect(tutorGeneration).toBeGreaterThan(start)
    releaseTutor()
    expect(getTutorAudioSessionGeneration()).toBe(tutorGeneration)
    const releaseCourse = claimTutorAudioSession('course-control', () => {})
    expect(interrupted).not.toHaveBeenCalled()
    expect(getTutorAudioSessionGeneration()).toBeGreaterThan(tutorGeneration)
    const courseGeneration = getTutorAudioSessionGeneration()
    releaseTutor()
    releaseCourse()
    expect(getTutorAudioSessionGeneration()).toBe(courseGeneration)
  })
})
