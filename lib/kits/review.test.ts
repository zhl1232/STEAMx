import { beforeEach,expect,it,vi } from 'vitest'
import type { Project } from '@/lib/mappers/types'
import type { ExperimentKit,KitProjectRelation } from './types'
const state=vi.hoisted(()=>({notes:['准备一杯清水']}))
vi.mock('@/lib/project/materials',()=>({resolveProjectMaterials:()=>({materials:['纸杯'],preparationNotes:state.notes})}))
vi.mock('@/lib/project/content-fingerprint',()=>({hashProjectInstructionContent:()=> 'same-base-content'}))
vi.mock('@/lib/project/video-presentation-pilot',()=>({getProjectVideoPresentationPilot:()=>null}))
import { hashKitProjectContent,isKitRelationConfirmed } from './review'
const project={id:1,title:'实验',videoUrl:'https://example.com/one.mp4'} as Project
const kit={revision:1} as ExperimentKit
function relation():KitProjectRelation{return {kit_id:'kit',project_id:1,status:'confirmed',preparation_status:'ready',extras:[],project_hash:hashKitProjectContent(project),kit_revision:1,sort_order:0}}
beforeEach(()=>{state.notes=['准备一杯清水']})
it('invalidates review when preparation notes change without base content changing',()=>{const r=relation();expect(isKitRelationConfirmed(kit,r,project)).toBe(true);state.notes=['准备两杯清水'];expect(isKitRelationConfirmed(kit,r,project)).toBe(false)})
it('invalidates review when the video or kit revision changes',()=>{const r=relation();expect(isKitRelationConfirmed(kit,r,{...project,videoUrl:'https://example.com/two.mp4'})).toBe(false);expect(isKitRelationConfirmed({...kit,revision:2},r,project)).toBe(false)})
it('never upgrades an unchanged candidate to confirmed',()=>{expect(isKitRelationConfirmed(kit,{...relation(),status:'candidate'},project)).toBe(false)})
