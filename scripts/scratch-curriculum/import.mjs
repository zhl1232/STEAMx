#!/usr/bin/env node
/** Validate the complete original curriculum, then optionally upsert it as a draft. */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { createClient } from '@supabase/supabase-js'

const ROOT = process.cwd()
const MANIFEST = path.join(ROOT, 'scripts/scratch-curriculum/lessons.json')
const PUBLIC_ROOT = path.join(ROOT, 'public/courses/scratch-original/v1')
const CURRICULUM_KEY = 'scratch-original-v1'
const COURSE_TITLE = 'Scratch 创探编程：从动画到作品'
const PLACEHOLDER_PATTERNS = [
  /参数按[“「]/,
  /先重置本课要记录的数值/,
  /只改[“「]一个参数/,
  /启动→规则→反馈/,
  /搭建可运行的一轮/,
  /如果_else/,
]
const INVALID_OPCODE_ALIASES = new Set(['control_repeatuntil', 'looks_switchcostume', 'sensing_touching', 'sensing_distance'])
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const expectedHost = args.find((arg) => arg.startsWith('--expect-host='))?.slice('--expect-host='.length)

function fail(message) {
  throw new Error(message)
}

function asNonemptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a nonempty string`)
  return value
}

async function requireFile(file) {
  const info = await stat(file)
  if (!info.isFile() || info.size === 0) fail(`Asset is empty: ${file}`)
  return info.size
}

function readProject(bytes, file) {
  if (bytes.length > 10 * 1024 * 1024) fail(`SB3 exceeds the learner upload limit: ${file}`)
  let archive
  try { archive = unzipSync(bytes) } catch { fail(`Not a valid SB3 ZIP: ${file}`) }
  let project
  try { project = JSON.parse(strFromU8(archive['project.json'])) } catch { fail(`Missing or invalid project.json: ${file}`) }
  if (!Array.isArray(project.targets) || !project.targets.some((target) => target.isStage)) {
    fail(`SB3 has no Scratch stage: ${file}`)
  }
  for (const target of project.targets) {
    const blocks = target.blocks ?? {}
    for (const [blockId, block] of Object.entries(blocks)) {
      if (!block || Array.isArray(block)) continue
      if (block.next && !blocks[block.next]) fail(`Dangling Scratch next block in ${file} (${blockId})`)
      if (block.parent && !blocks[block.parent]) fail(`Dangling Scratch parent block in ${file} (${blockId})`)
      for (const [inputName, input] of Object.entries(block.inputs ?? {})) {
        if (typeof input?.[1] === 'string' && !blocks[input[1]]) {
          fail(`Dangling Scratch input ${block.opcode}.${inputName} in ${file} (${blockId})`)
        }
      }
      if (block.opcode === 'event_broadcast') {
        const menuId = block.inputs?.BROADCAST_INPUT?.[1]
        const menuBlock = typeof menuId === 'string' ? blocks[menuId] : null
        if (menuBlock?.opcode !== 'event_broadcast_menu' || !menuBlock.fields?.BROADCAST_OPTION?.[1]) {
          fail(`Broadcast needs a valid menu shadow and message id: ${file}`)
        }
      }
    }
    if (!target.isStage) {
      const roots = Object.entries(blocks).filter(([, block]) => block?.topLevel).map(([blockId]) => blockId)
      if (!roots.length && file.endsWith('/reference.sb3')) fail(`Sprite has no runnable script: ${target.name} in ${file}`)
      const visited = new Set()
      const visit = (blockId) => {
        if (!blockId || visited.has(blockId) || !blocks[blockId]) return
        visited.add(blockId)
        const block = blocks[blockId]
        visit(block.next)
        for (const input of Object.values(block.inputs ?? {})) if (typeof input?.[1] === 'string') visit(input[1])
      }
      roots.forEach(visit)
      for (const [blockId, block] of Object.entries(blocks)) {
        if (!visited.has(blockId) && block?.opcode) fail(`Unreachable Scratch block ${block.opcode} in ${file} (${target.name})`)
      }
    }
    for (const costume of target.costumes ?? []) {
      if (!archive[costume.md5ext]) fail(`Missing costume ${costume.md5ext}: ${file}`)
    }
    for (const sound of target.sounds ?? []) {
      if (!archive[sound.md5ext]) fail(`Missing sound ${sound.md5ext}: ${file}`)
    }
  }
  const opcodes = new Set(project.targets.flatMap((target) =>
    Object.values(target.blocks ?? {}).flatMap((block) =>
      block && !Array.isArray(block) && typeof block.opcode === 'string' ? [block.opcode] : [])))
  if ([...opcodes].some((opcode) => opcode.startsWith('pen_')) && !project.extensions?.includes('pen')) {
    fail(`Pen blocks require the pen extension in project.json: ${file}`)
  }
  return { project, opcodes }
}

function validateMilestoneReference(lesson, reference) {
  const { project, opcodes } = reference
  const sprites = project.targets.filter((target) => !target.isStage).map((target) => target.name)
  const spriteOpcodes = (name) => new Set(Object.values(project.targets.find((target) => !target.isStage && target.name.includes(name))?.blocks ?? {})
    .filter((block) => block && !Array.isArray(block) && typeof block.opcode === 'string')
    .map((block) => block.opcode))
  const variables = project.targets.flatMap((target) => Object.values(target.variables ?? {}).map((value) => value?.[0]))
  const lists = project.targets.flatMap((target) => Object.values(target.lists ?? {}).map((value) => value?.[0]))
  const requireSprites = (names) => {
    for (const name of names) if (!sprites.some((sprite) => sprite.includes(name))) fail(`${lesson.key} reference misses ${name} sprite`)
  }
  const requireOpcodes = (names) => {
    for (const opcode of names) if (!opcodes.has(opcode)) fail(`${lesson.key} reference misses behavioral opcode ${opcode}`)
  }
  if (lesson.key === 's01-l06') {
    requireSprites(['小熊', '啄木鸟', '青蛙'])
    for (const target of project.targets.filter((target) => !target.isStage)) {
      if (!target.sounds?.length || !Object.values(target.blocks ?? {}).some((block) => block.opcode === 'sound_playuntildone')) {
        fail('s01-l06 every instrument must have its own playable sound')
      }
    }
  }
  if (lesson.key === 's01-l08') {
    requireSprites(['种子', '小鸟', '云朵'])
    requireOpcodes(['event_broadcast', 'event_whenbroadcastreceived'])
  }
  if (lesson.key === 's02-l08') {
    requireSprites(['探索员', '水边', '树顶'])
    for (const place of ['水边', '树顶']) if (!spriteOpcodes(place).has('event_whenthisspriteclicked')) {
      fail(`s02-l08 ${place} must respond to a click`)
    }
  }
  if (lesson.key === 's03-l08') {
    requireSprites(['玩家', '星星'])
    if (!variables.includes('星光') || !variables.includes('剩余时间')) fail('s03-l08 needs score and countdown variables')
    requireOpcodes(['sensing_touchingobject', 'data_changevariableby', 'control_if_else', 'event_broadcast'])
    if (!spriteOpcodes('星星').has('event_whenflagclicked')) fail('s03-l08 star needs its own green-flag reset script')
  }
  if (lesson.key === 's04-l08') {
    requireSprites(['云', '雨滴', '水桶'])
    requireOpcodes(['control_create_clone_of', 'control_start_as_clone', 'sensing_touchingobject', 'control_delete_this_clone'])
    if (!spriteOpcodes('云').has('event_broadcast')) fail('s04-l08 cloud must initiate the rain broadcast')
    if (!spriteOpcodes('雨滴').has('control_start_as_clone') || !spriteOpcodes('雨滴').has('control_delete_this_clone')) {
      fail('s04-l08 rain sprite must own clone lifecycle scripts')
    }
    if (!spriteOpcodes('雨滴').has('sensing_touchingobject')) fail('s04-l08 rain clones must detect the bucket')
    if (!spriteOpcodes('雨滴').has('control_repeat_until')) fail('s04-l08 must keep making drops until the bucket is full')
  }
  if (lesson.key === 's05-l07') {
    requireSprites(['小画家'])
    const painter = project.targets.find((target) => target.name === '小画家')
    if (!Object.values(painter.blocks).some((block) => block.opcode === 'procedures_definition' && block.next)) {
      fail('s05-l07 procedure must have an executable body')
    }
    if (Object.values(painter.blocks).filter((block) => block.opcode === 'procedures_call').length < 2) {
      fail('s05-l07 must demonstrate reusing the procedure')
    }
  }
  if (lesson.key === 's05-l08') {
    if (!lists.some((name) => name?.includes('高度'))) fail('s05-l08 needs a height data list')
    requireOpcodes(['data_lengthoflist', 'data_itemoflist', 'pen_penDown', 'pen_penUp', 'procedures_call'])
    requireOpcodes(['procedures_definition'])
    if (!lists.some((name) => name === '高度') || !project.targets.some((target) => Object.values(target.lists ?? {}).some((value) => value?.[0] === '高度' && value?.[1]?.length >= 4))) {
      fail('s05-l08 needs four chart data points')
    }
  }
  if (lesson.key === 's06-l01') {
    requireSprites(['小设计师', '测试伙伴'])
    if (Object.values(project.targets.find((target) => target.name === '小设计师').blocks).filter((block) => block.opcode === 'looks_sayforsecs').length < 3) {
      fail('s06-l01 must show all three requirements')
    }
  }
  if (lesson.key === 's06-l04') {
    requireSprites(['玩家', '讲解角色'])
    if (!spriteOpcodes('讲解角色').has('event_whenbroadcastreceived')) fail('s06-l04 narrator must respond to a message')
  }
  if (lesson.key === 's06-l08') {
    requireSprites(['发布者', '星星'])
    if (!variables.includes('分数') || !spriteOpcodes('星星').has('sensing_touchingobject')) fail('s06-l08 needs a playable score goal')
  }
}

async function loadAndValidate() {
  const lessons = JSON.parse(await readFile(MANIFEST, 'utf8'))
  if (!Array.isArray(lessons) || lessons.length !== 48) fail('Curriculum must contain exactly 48 lessons')
  const keys = new Set()
  const titleSet = new Set()
  for (const [index, lesson] of lessons.entries()) {
    const stageIndex = Math.floor(index / 8) + 1
    const expectedKey = `s${String(stageIndex).padStart(2, '0')}-l${String(index % 8 + 1).padStart(2, '0')}`
    if (lesson.key !== expectedKey || lesson.stageIndex !== stageIndex || lesson.sortOrder !== index + 1) {
      fail(`Unexpected order/key at lesson ${index + 1}; expected ${expectedKey}`)
    }
    if (keys.has(lesson.key)) fail(`Duplicate key: ${lesson.key}`)
    keys.add(lesson.key)
    asNonemptyString(lesson.stageTitle, `${lesson.key}.stageTitle`)
    asNonemptyString(lesson.title, `${lesson.key}.title`)
    asNonemptyString(lesson.summary, `${lesson.key}.summary`)
    asNonemptyString(lesson.projectGoal, `${lesson.key}.projectGoal`)
    asNonemptyString(lesson.challenge, `${lesson.key}.challenge`)
    asNonemptyString(lesson.reflection, `${lesson.key}.reflection`)
    if (titleSet.has(lesson.title)) fail(`Duplicate lesson title: ${lesson.title}`)
    titleSet.add(lesson.title)
    if (!Array.isArray(lesson.goals) || lesson.goals.length < 1) fail(`${lesson.key} needs goals`)
    if (!Array.isArray(lesson.prerequisites)) fail(`${lesson.key} needs a prerequisites array`)
    if (!Number.isInteger(lesson.durationMinutes) || lesson.durationMinutes < 20 || lesson.durationMinutes > 45) {
      fail(`${lesson.key} needs a realistic duration`)
    }
    if (!Array.isArray(lesson.steps) || lesson.steps.length < 6) fail(`${lesson.key} needs six substantive steps`)
    for (const step of lesson.steps) {
      asNonemptyString(step.title, `${lesson.key}.steps.title`)
      asNonemptyString(step.description, `${lesson.key}.steps.description`)
      if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(step.description))) {
        fail(`${lesson.key} still contains a generic or untranslated teaching step: ${step.title}`)
      }
    }
    if (!Array.isArray(lesson.requiredBlocks)) fail(`${lesson.key} needs requiredBlocks array`)
    const base = path.join(PUBLIC_ROOT, lesson.key)
    const [starter, reference] = await Promise.all([
      readFile(path.join(base, 'starter.sb3')),
      readFile(path.join(base, 'reference.sb3')),
    ])
    await requireFile(path.join(base, 'diagram.svg'))
    const starterProject = readProject(starter, `${lesson.key}/starter.sb3`)
    const referenceProject = readProject(reference, `${lesson.key}/reference.sb3`)
    if (starterProject.project.meta?.agent !== 'scratch-original-curriculum-v1' || referenceProject.project.meta?.agent !== 'scratch-original-curriculum-v1') {
      fail(`${lesson.key} still uses a generic placeholder project`)
    }
    const referenceNames = new Set(referenceProject.project.targets.filter((target) => !target.isStage).map((target) => target.name))
    for (const [, role] of (lesson.steps[1]?.description ?? '').matchAll(/(?:选中|另选|给)【([^】]+)】/g)) {
      if (!referenceNames.has(role)) fail(`${lesson.key} lesson names missing reference role: ${role}`)
    }
    validateMilestoneReference(lesson, referenceProject)
    const absentFromStarter = []
    for (const rule of lesson.requiredBlocks) {
      asNonemptyString(rule.label, `${lesson.key}.requiredBlocks.label`)
      if (!Array.isArray(rule.anyOf) || !rule.anyOf.length || rule.anyOf.some((op) => !/^[-_a-z0-9]+$/i.test(op))) {
        fail(`${lesson.key} has invalid opcode rule`)
      }
      if (rule.anyOf.some((op) => INVALID_OPCODE_ALIASES.has(op))) fail(`${lesson.key} uses a noncanonical Scratch opcode`)
      if (!rule.anyOf.some((op) => referenceProject.opcodes.has(op))) {
        fail(`${lesson.key} reference misses required block: ${rule.label}`)
      }
      if (!rule.anyOf.some((op) => starterProject.opcodes.has(op))) absentFromStarter.push(rule.label)
    }
    if (lesson.requiredBlocks.length > 0 && absentFromStarter.length === 0) {
      fail(`${lesson.key} starter already meets every new block requirement`)
    }
  }
  await requireFile(path.join(PUBLIC_ROOT, 'cover.svg'))
  return lessons
}

function lessonPayload(lesson) {
  const base = `/api/assets/courses/scratch-original/v1/${lesson.key}`
  const steps = lesson.steps.map((step, index) => ({
    ...step,
    ...(index === 2 ? { visuals: [{
      type: 'scratch_image',
      src: `${base}/diagram.svg`,
      alt: `${lesson.title}的关键积木连接图`,
      caption: '参考连接方式，角色和内容可以按自己的想法调整。',
    }] } : {}),
  }))
  return {
    title: lesson.title,
    lesson_type: 'scratch',
    sort_order: lesson.sortOrder,
    duration_minutes: lesson.durationMinutes,
    starter_project_path: null,
    steps,
    resources: [],
    content: {
      summary: lesson.summary,
      requiredBlocks: lesson.requiredBlocks,
      workSubmission: { enabled: true },
      scratch: {
        curriculumKey: CURRICULUM_KEY,
        lessonKey: lesson.key,
        stageIndex: lesson.stageIndex,
        stageTitle: lesson.stageTitle,
        goals: lesson.goals,
        prerequisites: lesson.prerequisites,
        challenge: lesson.challenge,
        reflection: lesson.reflection,
        projectGoal: lesson.projectGoal,
        starterProjectUrl: `${base}/starter.sb3`,
        referenceProjectUrl: `${base}/reference.sb3`,
      },
    },
  }
}

async function loadEnv() {
  const env = { ...process.env }
  const lines = (await readFile(path.join(ROOT, '.env.local'), 'utf8')).split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const divider = trimmed.indexOf('=')
    if (divider < 1) continue
    const key = trimmed.slice(0, divider).trim()
    if (!env[key]) env[key] = trimmed.slice(divider + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

async function upsertDraft(lessons) {
  if (!expectedHost) fail('--apply requires --expect-host=<Supabase host>')
  const env = await loadEnv()
  const host = new URL(asNonemptyString(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')).host
  if (host !== expectedHost) fail(`Target host mismatch: ${host}`)
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, asNonemptyString(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: matches, error: findError } = await client.from('courses').select('id,status').contains('tags', [CURRICULUM_KEY])
  if (findError) throw findError
  if ((matches ?? []).length > 1) fail('More than one curriculum course uses the stable key')
  let courseId = matches?.[0]?.id
  if (matches?.[0]?.status === 'approved') fail('Published curriculum is immutable through this draft importer')
  if (!courseId) {
    const { data, error } = await client.from('courses').insert({
      title: COURSE_TITLE,
      description: '从动画、互动故事到游戏和自主创作，48 节原创 Scratch 课程，适合 7–10 岁孩子在家跟学。',
      image_url: '/api/assets/courses/scratch-original/v1/cover.svg',
      tags: ['Scratch', '少儿编程', '创探编程', CURRICULUM_KEY],
      status: 'draft',
      is_listed: false,
      sort_order: 15,
      difficulty_stars: 2,
      steam_weights: { S: 10, T: 35, E: 15, A: 20, M: 20 },
      recommended_min_age: 7,
      recommended_max_age: 10,
      support_level: 'guided',
      classification_status: 'unreviewed',
    }).select('id').single()
    if (error) throw error
    courseId = data.id
  }
  const { data: existing, error: lessonsError } = await client.from('course_lessons')
    .select('id,content')
    .eq('course_id', courseId)
  if (lessonsError) throw lessonsError
  const byKey = new Map()
  for (const row of existing ?? []) {
    const key = row.content?.scratch?.lessonKey
    if (!key || byKey.has(key)) fail(`Unmanaged or duplicate lesson in draft course ${courseId}`)
    byKey.set(key, row.id)
  }
  for (const lesson of lessons) {
    const payload = { course_id: courseId, ...lessonPayload(lesson) }
    const id = byKey.get(lesson.key)
    const result = id
      ? await client.from('course_lessons').update(payload).eq('id', id)
      : await client.from('course_lessons').insert(payload)
    if (result.error) throw result.error
  }
  console.log(`Draft course ${courseId} contains ${lessons.length} authored Scratch lessons on ${host}.`)
}

const lessons = await loadAndValidate()
console.log(`Validated ${lessons.length} lessons, ${lessons.length * 2} SB3 files, and their diagrams.`)
if (apply) await upsertDraft(lessons)
else console.log('Read-only check complete. Use --apply --expect-host=<Supabase host> for a reviewed draft write.')
