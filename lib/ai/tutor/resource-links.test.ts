import { describe, expect, it } from 'vitest'

import {
  createTutorResourceTag,
  getTutorResourceHrefs,
  isTutorResourceHref,
  stripTutorResourceTags,
  tutorResourceTagsToMarkdown,
  validateTutorResourceTags,
} from './resource-links'

describe('tutor resource links', () => {
  it.each(['2048', 'fifteen', 'quickmath'])('rejects deleted game links: %s', (game) => {
    expect(createTutorResourceTag('game', game, '旧游戏')).toBe('')
    expect(isTutorResourceHref(`/playground/${game}`)).toBe(false)
    expect([...getTutorResourceHrefs(`[game:${game}|旧游戏]`)]).toEqual([])
  })

  it('creates the supported tags and rejects unsafe ids', () => {
    expect(createTutorResourceTag('lesson', '12:3', '纸桥课时')).toBe('[lesson:12:3|纸桥课时]')
    expect(createTutorResourceTag('species', '黑头鸦_1', '黑头鸦')).toBe('[species:黑头鸦_1|黑头鸦]')
    expect(createTutorResourceTag('game', 'maze', '迷宫')).toBe('[game:maze|迷宫]')
    expect(createTutorResourceTag('game', 'not-a-game', '未知')).toBe('')
    expect(createTutorResourceTag('species', '../bird', '危险')).toBe('')
    expect(createTutorResourceTag('resource', '1', '[危险]')).toBe('')
  })

  it('converts tags to exact internal hrefs with escaped labels', () => {
    const text = tutorResourceTagsToMarkdown(
      '[lesson:12:3|课*时] [challenge:8|挑战] [resource:9|资料] [species:黑头鸦|图鉴] [game:maze|迷宫] [project:4|项目] [course:5|课程]',
    )
    expect(text).toContain('[课\\*时](/courses/12/lessons/3)')
    expect(text).toContain('[图鉴](/nature/species/黑头鸦)')
    expect(text).toContain('[迷宫](/playground/maze)')
    expect(text).toContain('[项目](/project/4)')
    expect(text).toContain('[课程](/courses/5)')
    expect(isTutorResourceHref('/courses/12/lessons/3')).toBe(true)
    expect(isTutorResourceHref('https://evil.example/')).toBe(false)
    expect(isTutorResourceHref('/nature/species/../bird')).toBe(false)
  })

  it('strips tags for speech and validates against canonical sources', () => {
    const text = '[resource:9|模型标题] [resource:10|未知标题] [game:maze|迷宫]'
    expect(stripTutorResourceTags(text)).toBe('模型标题 未知标题 迷宫')
    expect(validateTutorResourceTags(text, ['[resource:9|资料卡]', '[game:maze|迷宫游戏]'])).toBe(
      '[resource:9|资料卡] 未知标题 [game:maze|迷宫游戏]',
    )
  })

  it('grants destinations only to valid resource tags, not arbitrary Markdown', () => {
    const content = '[resource:2|资料] [species:黑头鸦|图鉴] [resource:0|无效] [假入口][r]\n\n[r]: /resources/999'
    expect([...getTutorResourceHrefs(content)]).toEqual(['/resources/2', '/nature/species/黑头鸦'])
  })

  it('keeps every verified reference in a multiline context and rejects invented destinations', () => {
    const sources = ['本轮检索\n- [resource:1|缓冲原理]\n- [resource:2|材料对比]', '当前课程 [lesson:5:70|轮船]']
    expect(validateTutorResourceTags('[resource:2|别名] [lesson:5:70|课] [resource:99|不存在]', sources))
      .toBe('[resource:2|材料对比] [lesson:5:70|轮船] 不存在')
    expect(validateTutorResourceTags('[假入口](/resources/99) [真入口](/resources/2)', sources))
      .toBe('假入口 [resource:2|材料对比]')
  })

  it.each(['0', '-1', 'abc', '9007199254740992', '../../admin'])('rejects invalid database ids: %s', (id) => {
    expect(createTutorResourceTag('resource', id, '资料')).toBe('')
    expect(createTutorResourceTag('lesson', `5:${id}`, '课时')).toBe('')
    expect(isTutorResourceHref(`/resources/${id}`)).toBe(false)
    expect(validateTutorResourceTags(`[resource:${id}|资料]`, [])).toBe('资料')
  })
})
