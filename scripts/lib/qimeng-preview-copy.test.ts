import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  applyQimengPreviewCopyCleanup,
  buildQimengDescription,
  cleanQimengDescription,
  cleanQimengStepDescription,
  cleanQimengTags,
  cleanQimengTitle,
  isDuplicateQimengReflection,
  isQimengSourceTag,
  parseQimengContentTxt,
  stripQimengWeChatCta,
} from './qimeng-preview-copy.mjs'

describe('qimeng preview copy cleanup', () => {
  const rawDescription = [
    '【启蒙版·预览】',
    '科学原理：纸巾不会湿是因为杯子里有空气。',
    '演示视频（外链）：https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4',
    '来源：伙伴启蒙版实验（预览导入，可搜索标签「预览」「启蒙版」后删除）。',
  ].join('\n')

  it('strips the 【预览】 title prefix', () => {
    expect(cleanQimengTitle('【预览】调色大师')).toBe('调色大师')
    expect(cleanQimengTitle('调色大师')).toBe('调色大师')
  })

  it('drops preview banner, source boilerplate, and duplicate video URL lines', () => {
    expect(cleanQimengDescription(rawDescription)).toBe('科学原理：纸巾不会湿是因为杯子里有空气。')
  })

  it('strips the demo-video prefix from a step body', () => {
    expect(
      cleanQimengStepDescription(
        '【演示视频】https://assets.steamx.cc/qimeng-preview/001_奇妙潜水艇/video_1.mp4\n取三个量杯，装满清水。',
      ),
    ).toBe('取三个量杯，装满清水。')
  })

  it('removes 预览 but keeps 启蒙版 and qimeng-src:*', () => {
    expect(cleanQimengTags(['启蒙版', '预览', 'qimeng-src:1071409', '科学实验'])).toEqual([
      '启蒙版',
      'qimeng-src:1071409',
      '科学实验',
    ])
    expect(isQimengSourceTag('qimeng-src:1071409')).toBe(true)
  })

  it('treats principle-only reflection as a duplicate of description', () => {
    expect(
      isDuplicateQimengReflection(
        '【启蒙版·预览】科学原理补充：纸巾不会湿是因为杯子里有空气。',
        '科学原理：纸巾不会湿是因为杯子里有空气。',
      ),
    ).toBe(true)
  })

  it('applies the full project-row transform', () => {
    const cleaned = applyQimengPreviewCopyCleanup({
      title: '【预览】奇妙潜水艇',
      description: rawDescription,
      reflection: '【启蒙版·预览】科学原理补充：纸巾不会湿是因为杯子里有空气。',
      tags: ['启蒙版', '预览', 'qimeng-src:1', '幼儿科学'],
      problem_statement: '【启蒙版·预览】伙伴启蒙版实验预览导入；sourceId=1; folder=001_奇妙潜水艇',
    })
    expect(cleaned).toEqual({
      title: '奇妙潜水艇',
      description: '科学原理：纸巾不会湿是因为杯子里有空气。',
      reflection: '',
      tags: ['启蒙版', 'qimeng-src:1', '幼儿科学'],
      problem_statement: 'sourceId=1; folder=001_奇妙潜水艇',
    })
  })

  it('strips WeChat CTA from mashed digest descriptions', () => {
    const mashed =
      '点击上方蓝色字体关注我们实验材料橡皮筋、色素、自备（塑料瓶、小毛巾有缝隙的、洗衣液）实验步骤011、首先我们'
    expect(cleanQimengDescription(mashed)).not.toContain('点击上方蓝色字体关注我们')
    expect(stripQimengWeChatCta('请点击上方蓝字关注我们！科学原理：表面张力。')).toBe(
      '科学原理：表面张力。',
    )
  })
})

const PAOPAO_BINGQILIN_CONTENT = `点击上方蓝色字体关注我们

实验材料
橡皮筋、色素、自备（塑料瓶、小毛巾有缝隙的、洗衣液）

实验步骤01

1、首先我们用剪刀将瓶子的底部切掉，再将小毛巾固定用橡皮固定在瓶子尾部。

2、用洗衣液调制泡泡液，我们将绑好毛巾的瓶子粘上一点泡泡液，然后在瓶口吹。我们可以通过毛巾的小缝隙吹出无数个泡泡哦。

3、接下里我们来做点漂亮的泡泡，我们将毛巾上面滴上一点色素，然后粘上泡泡液再吹，哇，冰淇淋色的泡泡呢~~

科学原理02

泡泡实验我们做了许多，相信其中的原理我们应该很熟悉了，今天我们用了毛巾利用其中的小缝隙吹出了无数整齐排列的小泡泡，主要是因为泡泡表面张力的存在加上水分子里氢原子的相互吸引，形成了我们看到的从毛巾缝隙里挣脱出来的无数个泡沫，整齐的排列下来，顺带加上了颜料的泡沫，有没有更加漂亮~~
`

describe('parseQimengContentTxt', () => {
  it('parses 泡泡冰淇淋 newline headers, numbered steps, and strips the WeChat CTA', () => {
    const parsed = parseQimengContentTxt(PAOPAO_BINGQILIN_CONTENT)
    expect(parsed.materials).toEqual([
      '橡皮筋',
      '色素',
      '自备（塑料瓶、小毛巾有缝隙的、洗衣液）',
    ])
    expect(parsed.steps).toHaveLength(3)
    expect(parsed.steps[0]).toMatchObject({
      title: '步骤 1',
      description: expect.stringContaining('首先我们用剪刀将瓶子的底部切掉'),
      sort_order: 0,
    })
    expect(parsed.steps[1].description).toContain('用洗衣液调制泡泡液')
    expect(parsed.steps[2].description).toContain('冰淇淋色的泡泡')
    expect(parsed.principle).toContain('泡泡表面张力')
    expect(parsed.principle).not.toContain('点击上方蓝色字体关注我们')
    expect(parsed.principle).not.toMatch(/^科学原理/)

    const description = buildQimengDescription({ principle: parsed.principle })
    expect(description.startsWith('科学原理：')).toBe(true)
    expect(description).not.toContain('点击上方')
    expect(description).not.toContain('实验步骤011')
  })

  it('treats a second empty 实验材料 header as 实验步骤 (密度与扩散 typo)', () => {
    const parsed = parseQimengContentTxt(
      [
        '实验材料：量杯2个、色素、取样勺、搅拌棒、自备（食盐、清水）',
        '实验材料：',
        '1、将两个量杯摆放在桌子上。',
        '2、向另一个量杯中加80毫升清水。',
        '科学原理：扩散是物质从高密度区域向低密度区域转移。',
      ].join('\n'),
    )
    expect(parsed.materials).toEqual([
      '量杯2个',
      '色素',
      '取样勺',
      '搅拌棒',
      '自备（食盐、清水）',
    ])
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.principle).toContain('扩散是物质')
  })

  it('still parses colon headers used by 调色大师-style content.txt', () => {
    const parsed = parseQimengContentTxt(
      [
        '实验材料：量杯7个、滴管、搅拌棒、色素、自备（清水）',
        '实验步骤：',
        '1、取三个量杯，装满100毫升的清水。',
        '2、另取4个量杯，分别装入50毫升清水。',
        '科学原理：红黄蓝是颜料的三原色。',
      ].join('\n'),
    )
    expect(parsed.materials).toEqual(['量杯7个', '滴管', '搅拌棒', '色素', '自备（清水）'])
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.principle).toBe('红黄蓝是颜料的三原色。')
  })

  it('accepts standalone 01/02 markers and 原理分析 as the principle header', () => {
    const parsed = parseQimengContentTxt(
      [
        '点击上方蓝色字体关注我们',
        '实验材料',
        '气球、自备（塑料瓶、碗2个）',
        '01',
        '实验步骤',
        '1、将气球套在塑料瓶口上。',
        '2、将塑料瓶放入热水中。',
        '02',
        '原理分析∶空气受热膨胀。',
      ].join('\n'),
    )
    expect(parsed.materials[0]).toBe('气球')
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.principle).toContain('空气受热膨胀')
  })

  it('does not use digest mash when a principle is present', () => {
    const parsed = parseQimengContentTxt(PAOPAO_BINGQILIN_CONTENT)
    const mashed =
      '点击上方蓝色字体关注我们实验材料橡皮筋、色素、自备（塑料瓶、小毛巾有缝隙的、洗衣液）实验步骤011、首先我们'
    expect(buildQimengDescription({ principle: parsed.principle, digest: mashed })).toBe(
      buildQimengDescription({ principle: parsed.principle }),
    )
  })

  it('parses the on-disk 泡泡冰淇淋 content.txt when the source tree is present', () => {
    let disk
    try {
      disk = readFileSync(
        '/workspace/zwlhome-save/启蒙版/201-248/013_泡泡冰淇淋/content.txt',
        'utf8',
      )
    } catch {
      return
    }
    const parsed = parseQimengContentTxt(disk)
    expect(parsed.materials).toEqual(expect.arrayContaining(['橡皮筋', '色素']))
    expect(parsed.steps.length).toBeGreaterThanOrEqual(3)
    expect(parsed.principle).toContain('表面张力')
  })
})
