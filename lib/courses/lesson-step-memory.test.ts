// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'

import { readLastLessonVisit, readRememberedLessonStep, rememberLessonStep } from './lesson-step-memory'

describe('lesson step memory', () => {
  beforeEach(() => window.localStorage.clear())

  it('remembers the last page per lesson and the last visited lesson per course', () => {
    rememberLessonStep(30, 7, 5)
    expect(readRememberedLessonStep(30)).toBe(7)
    expect(readRememberedLessonStep(31)).toBeNull()
    expect(readLastLessonVisit(5)).toEqual({ courseId: 5, lessonId: 30, stepIndex: 7 })
    expect(readLastLessonVisit(6)).toBeNull()
  })

  it('ignores invalid values', () => {
    rememberLessonStep(30, -1, 5)
    window.localStorage.setItem('steamx:last-lesson', '{bad')
    expect(readRememberedLessonStep(30)).toBeNull()
    expect(readLastLessonVisit(5)).toBeNull()
  })
})
