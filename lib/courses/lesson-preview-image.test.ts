import { describe, expect, it } from 'vitest'
import { lessonPreviewImage } from './lesson-preview-image'

describe('catalog lesson previews', () => {
  it('preserves the real building photo', () => {
    expect(lessonPreviewImage({ title: '作品', finished_image_url: ' /model.webp ' })).toBe('/model.webp')
  })
  it('uses the matching original Scratch project only', () => {
    const source = { title: '作品', lesson_type: 'scratch', scratch_curriculum_key: 'scratch-original-v1', scratch_lesson_key: 's06-l08' }
    expect(lessonPreviewImage(source)).toBe('/assets/course-previews/scratch/s06-l08.webp')
    expect(lessonPreviewImage({ ...source, scratch_curriculum_key: 'legacy' })).toBeNull()
    expect(lessonPreviewImage({ ...source, scratch_lesson_key: '../../other' })).toBeNull()
    expect(lessonPreviewImage({ ...source, scratch_lesson_key: 's07-l01' })).toBeNull()
  })
  it('maps the matching real gomoku lesson diagram', () => {
    expect(lessonPreviewImage({ title: '认识棋盘与连五规则', lesson_type: 'playground', playground_game_key: 'gomoku' })).toBe('/assets/course-previews/gomoku/lesson-01.svg')
  })
  it('does not invent previews for unknown games or lessons', () => {
    expect(lessonPreviewImage({ title: '未发布课', lesson_type: 'playground', playground_game_key: 'gomoku' })).toBeNull()
    expect(lessonPreviewImage({ title: '认识棋盘与连五规则', lesson_type: 'playground', playground_game_key: 'other' })).toBeNull()
  })
})
