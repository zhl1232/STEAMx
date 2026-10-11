import { afterEach, expect, test, vi } from 'vitest'
import { buildTutorSceneContext } from './context-builders'
import { getScienceSample } from '@/lib/project/science-samples'
vi.mock('@/lib/content-classification', () => ({ getContentClassificationSettings: async () => ({ enforcementEnabled: true }), mapPublicClassification: () => null }))
afterEach(() => vi.unstubAllEnvs())
function database(approved: boolean, title: string) {
 const filters: unknown[][] = []
 return { filters, client: { from(table: string) {
   const q = { select() { return q }, eq(...args: unknown[]) { filters.push(args); return q }, order() { return q },
     async maybeSingle() { return { data: approved ? { title, category: '科学', description: '旧数据库描述' } : null } },
     async limit() { return { data: table === 'project_steps' ? [{ title: '旧步骤', description: '旧步骤内容' }] : [{ material: '旧材料' }] } } }
   return q
 } } }
}
test('server approval gates precede released override and current page extension replaces stale DB copy', async () => {
 vi.stubEnv('NODE_ENV', 'development')
 const sample = getScienceSample(1213)!
 const db = database(true, sample.title)
 const scene = await buildTutorSceneContext(db.client as never, 'mock-user', 'project', '1213')
 expect(db.filters).toContainEqual(['status', 'approved'])
 expect(db.filters).toContainEqual(['moderation_state', 'approved'])
 expect(db.filters).toContainEqual(['classification_status', 'reviewed'])
 expect(scene.summary).toContain(sample.extension)
 for (const question of sample.extensionQuestions ?? []) expect(scene.summary).toContain(question)
 expect(scene.summary).toContain('过程说明')
 expect(scene.summary).not.toContain('旧步骤')
 expect(scene.summary).not.toContain('旧数据库描述')
 expect(scene.summary).not.toContain('instructionGap')
 if (sample.instructionGap) expect(scene.summary).not.toContain(sample.instructionGap)
 const rejected = database(false, sample.title)
 expect((await buildTutorSceneContext(rejected.client as never, 'mock-user', 'project', '1213')).summary).toBe('项目不存在。')
 vi.stubEnv('NODE_ENV', 'production')
 const prod = database(true, sample.title)
 const production = await buildTutorSceneContext(prod.client as never, 'mock-user', 'project', '1213')
 expect(production.summary).not.toContain('旧数据库描述')
 expect(production.summary).toContain(getScienceSample(1213)!.extension)
 expect(production.summary).toContain('材料包实验：学生会收到材料包和说明书。')
 expect(production.summary).toContain('步骤（细节以材料包说明书为准）')
 expect(production.summary).not.toContain('需要学生动手时')
 const observation = getScienceSample(1269)!
 const view = await buildTutorSceneContext(database(true, observation.title).client as never, 'mock-user', 'project', '1269')
 expect(view.summary).toContain('仅观看与讨论')
 expect(view.summary).toContain(observation.safety)
 expect(view.summary).not.toContain('需要学生动手时')
 const denied = await buildTutorSceneContext(database(false, sample.title).client as never, 'mock-user', 'project', '1213')
 expect(denied.summary).toBe('项目不存在。')
})

test('1098 tutor context uses the verified activity steps', async () => {
 const sample = getScienceSample(1098)!
 const scene = await buildTutorSceneContext(database(true, sample.title).client as never, 'mock-user', 'project', '1098')
 expect(sample.mode).toBe('activity')
 for (const step of sample.steps) expect(scene.summary).toContain(step.description)
 expect(scene.summary).toContain(sample.safety)
 expect(scene.summary).not.toContain('步骤（细节以材料包说明书为准）')
 expect(scene.summary).not.toContain('旧步骤')
})
