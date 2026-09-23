#!/usr/bin/env node
/** Generate the 96 Scratch 3 projects used by the original curriculum. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { applySemanticOverrides } from './scratch-curriculum/semantic-overrides.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'public/courses/scratch-original/v1');
const MANIFEST = path.join(ROOT, 'scripts/scratch-curriculum/lessons.json');
const colors = ['#ffd166', '#73d2de', '#ff9b71', '#b8a1ff', '#91d18b', '#7db5ff'];
function lessons() { try { const value = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); const rows = Array.isArray(value) ? value : Object.values(value.lessons ?? value); return rows.filter((row) => row && /^s0[1-6]-l0[1-8]$/.test(row.key)); } catch (error) { console.warn(`Could not read lessons: ${error.message}`); return []; } }
const id = (value) => crypto.createHash('md5').update(value).digest('hex');
const text = (value) => [1, [10, String(value)]];
const number = (value) => [1, [4, String(value)]];
const colorInput = (value) => [1, [11, value]];
// Menu inputs must carry a literal shadow value; a bare string is interpreted
// by the VM as a block id and can produce a null BlockCached entry at runtime.
const menu = (value) => [1, [10, String(value)]];
const variable = (name, value = name) => [String(name), value];
function svg(title, fill, role, variant = 0) { const safe = String(title).replace(/[<>&"']/g, ''); if (role === 'backdrop') return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="${fill}"/><circle cx="390" cy="70" r="44" fill="#fff" opacity=".65"/><path d="M0 280Q120 210 240 280T480 280V360H0Z" fill="#fff" opacity=".38"/><text x="24" y="44" font-family="sans-serif" font-size="20" fill="#25324a">${safe}</text></svg>`; const body = variant ? '<path d="M25 62h46" stroke="#25324a" stroke-width="5" stroke-linecap="round"/>' : '<path d="M31 60Q48 73 65 60" fill="none" stroke="#25324a" stroke-width="4" stroke-linecap="round"/>'; return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="36" fill="${fill}" stroke="#25324a" stroke-width="4"/><circle cx="36" cy="43" r="5" fill="#25324a"/><circle cx="60" cy="43" r="5" fill="#25324a"/>${body}<title>${safe}</title></svg>`; }
function scenario(lesson) { return { required: (lesson?.requiredBlocks ?? []).flatMap((rule) => rule.anyOf ?? []), title: lesson?.title ?? 'Scratch 探索' }; }

function makeBlocks(key, reference, lesson, spriteName, stageNumber) {
  const stage = stageNumber ?? Number(key.slice(1, 3));
  const { required, title } = scenario(lesson), blocks = {}; let serial = 0;
  const add = (opcode, fields = {}, inputs = {}, next = null, parent = null, topLevel = false, x = 70, y = 80, extra = {}) => { const blockId = id(`${key}|${spriteName}|${reference}|${serial++}|${opcode}`); blocks[blockId] = { opcode, next, parent, inputs, fields, shadow: false, topLevel, ...(topLevel ? { x, y } : {}), ...extra }; return blockId; };
  // Reporters may be constructed while preparing alternate statement schemas.
  // Keep them valid standalone roots until the owning statement is attached.
  const reporter = (opcode, inputs = {}, fields = {}) => { const reporterId = add(opcode, fields, inputs); for (const input of Object.values(inputs)) if (Array.isArray(input) && input[0] === 2 && blocks[input[1]]) blocks[input[1]].parent = reporterId; return [2, reporterId]; };
  const statement = (opcode) => { const common = {
    motion_gotoxy: { inputs: { X: number(0), Y: number(0) } }, motion_movesteps: { inputs: { STEPS: number(20) } }, motion_glideto: { inputs: { SECS: number(1), TO: menu('_random_') } }, motion_glidesecstoxy: { inputs: { SECS: number(1), X: number(100), Y: number(60) } }, motion_turnright: { inputs: { DEGREES: number(60) } }, motion_pointindirection: { inputs: { DIRECTION: number(90) } }, motion_ifonedgebounce: {}, motion_goto: { inputs: { TO: menu('_random_') } }, motion_changexby: { inputs: { DX: number(10) } },
    looks_sayforsecs: { inputs: { MESSAGE: text(`你好！${title}`), SECS: number(2) } }, looks_say: { inputs: { MESSAGE: text(`欢迎来到${title}`) } }, looks_switchcostumeto: { inputs: { COSTUME: menu('探险员') } }, looks_switchbackdropto: { inputs: { BACKDROP: menu('舞台') } }, looks_nextcostume: {}, looks_changesizeby: { inputs: { CHANGE: number(10) } }, looks_changeeffectby: { inputs: { CHANGE: number(10), EFFECT: menu('color') } },
    sound_playuntildone: { inputs: { SOUND_MENU: menu('pop') } }, sound_stopallsounds: {}, control_wait: { inputs: { DURATION: number(1) } }, sensing_resettimer: {}, control_repeat: { inputs: { TIMES: number(3) } }, control_forever: {}, control_repeat_until: { inputs: { CONDITION: reporter('operator_gt', { OPERAND1: number(1), OPERAND2: number(0) }) } }, control_if: { inputs: { CONDITION: reporter('operator_gt', { OPERAND1: number(1), OPERAND2: number(0) }) } }, control_if_else: { inputs: { CONDITION: reporter('operator_gt', { OPERAND1: number(1), OPERAND2: number(0) }) } },
    event_broadcast: { inputs: { BROADCAST_INPUT: menu('开始游戏') } }, control_create_clone_of: { inputs: { CLONE_OPTION: menu('_myself_') } }, control_delete_this_clone: {}, data_setvariableto: { fields: { VARIABLE: variable('分数') }, inputs: { VALUE: number(0) } }, data_changevariableby: { fields: { VARIABLE: variable('分数') }, inputs: { VALUE: number(1) } }, data_showvariable: { fields: { VARIABLE: variable('分数') } }, data_addtolist: { fields: { LIST: variable('足迹', 'trail') }, inputs: { ITEM: text('一步') } }, data_replaceitemoflist: { fields: { LIST: variable('足迹', 'trail') }, inputs: { INDEX: number(1), ITEM: text('更新') } }, pen_penDown: {}, pen_setPenColorToColor: { inputs: { COLOR: colorInput('#2b7fff') } }, procedures_call: {}, control_stop: { fields: { STOP_OPTION: ['此脚本', null] } },
  }[opcode] ?? {}; if (opcode === 'event_broadcast') { const shadowId = add('event_broadcast_menu', { BROADCAST_OPTION: ['开始游戏', 'signal'] }, {}, null, null, false); blocks[shadowId].shadow = true; common.inputs = { BROADCAST_INPUT: [1, shadowId] }; } if (opcode === 'data_addtolist') { const listId = add('data_listcontents', { LIST: ['足迹', 'trail'] }, {}, null, null, false); blocks[listId].shadow = true; common.inputs = { ...(common.inputs ?? {}), LIST: [1, listId] }; } const scoreLoop = (title.includes('收集') || title.includes('星光') || key === 's03-l08') && ['control_repeat', 'control_repeat_until'].includes(opcode); const innerOpcode = scoreLoop ? 'data_changevariableby' : 'motion_movesteps'; const inner = ['control_repeat', 'control_forever', 'control_if', 'control_if_else', 'control_repeat_until'].includes(opcode) ? add(innerOpcode, innerOpcode === 'data_changevariableby' ? { VARIABLE: variable('分数') } : {}, innerOpcode === 'data_changevariableby' ? { VALUE: number(key === 's03-l08' ? -1 : 1) } : { STEPS: number(10) }) : null; const allInputs = { ...(common.inputs ?? {}), ...(inner ? { SUBSTACK: [2, inner] } : {}) }; const blockId = add(opcode, common.fields ?? {}, allInputs); if (inner) blocks[inner].parent = blockId; for (const input of Object.values(allInputs)) if (Array.isArray(input) && input[0] === 2 && blocks[input[1]]) blocks[input[1]].parent = blockId; return blockId; };
  const reporterStatement = (op) => { if (op === 'data_itemoflist' || op === 'data_lengthoflist') { const listReporter = op === 'data_lengthoflist' ? reporter('data_lengthoflist', {}, { LIST: variable('足迹', 'trail') }) : reporter('data_itemoflist', { INDEX: number(1) }, { LIST: variable('足迹', 'trail') }); return add('looks_say', {}, { MESSAGE: listReporter }); } const map = { sensing_mousex: ['looks_say', { MESSAGE: reporter('sensing_mousex') }], sensing_touchingcolor: ['looks_say', { MESSAGE: reporter('sensing_touchingcolor', { COLOR: colorInput('#ff0000') }) }], sensing_askandwait: ['sensing_askandwait', { QUESTION: text('你看到了什么？') }], sensing_answer: ['looks_say', { MESSAGE: reporter('sensing_answer') }], sensing_keypressed: ['looks_say', { MESSAGE: reporter('sensing_keypressed', { KEY_OPTION: menu('space') }) }], sensing_touchingobject: ['looks_say', { MESSAGE: reporter('sensing_touchingobject', { TOUCHINGOBJECTMENU: menu('_mouse_') }) }], operator_gt: ['looks_say', { MESSAGE: reporter('operator_gt', { OPERAND1: number(2), OPERAND2: number(1) }) }], operator_multiply: ['looks_say', { MESSAGE: reporter('operator_multiply', { NUM1: number(2), NUM2: number(3) }) }], operator_random: ['looks_say', { MESSAGE: reporter('operator_random', { FROM: number(1), TO: number(6) }) }], operator_equals: ['looks_say', { MESSAGE: reporter('operator_equals', { OPERAND1: text('甲'), OPERAND2: text('甲') }) }], operator_add: ['looks_say', { MESSAGE: reporter('operator_add', { NUM1: number(2), NUM2: number(3) }) }], operator_contains: ['looks_say', { MESSAGE: reporter('operator_contains', { STRING1: text('花瓣'), STRING2: text('花') }) }], operator_mod: ['looks_say', { MESSAGE: reporter('operator_mod', { NUM1: number(5), NUM2: number(2) }) }], sensing_distanceto: ['looks_say', { MESSAGE: reporter('sensing_distanceto', { DISTANCETOMENU: menu('_mouse_') }) }] }; const [say, inputs] = map[op] ?? ['looks_say', { MESSAGE: text(`已学会：${op}`) }]; if (op === 'data_itemoflist') { const listId = add('data_listcontents', { LIST: ['足迹', 'trail'] }, {}, null, null, false); blocks[listId].shadow = true; inputs.LIST = [1, listId]; } const bid = add(say, {}, inputs); for (const input of Object.values(inputs)) if (Array.isArray(input) && input[0] === 2 && blocks[input[1]]) blocks[input[1]].parent = bid; return bid; };
  const root = add('event_whenflagclicked', {}, {}, null, null, true, 70, 60); let previous = root;
  const semanticOps = key === 's01-l02' ? ['motion_gotoxy', 'control_repeat'] : key === 's03-l08' ? ['data_setvariableto', 'sensing_resettimer', 'control_repeat_until', 'sensing_touchingobject', 'data_changevariableby', 'control_if_else', 'looks_sayforsecs'] : key === 's04-l08' ? ['event_broadcast', 'control_create_clone_of', 'control_start_as_clone', 'control_delete_this_clone', 'motion_changexby', 'sensing_touchingobject', 'event_whenbroadcastreceived'] : key === 's05-l07' ? ['procedures_definition', 'procedures_call', 'data_addtolist'] : key === 's05-l08' ? ['data_addtolist', 'data_itemoflist', 'control_repeat', 'pen_penDown', 'data_changevariableby', 'procedures_definition', 'procedures_call'] : stage === 1 ? ['motion_movesteps', 'motion_gotoxy', 'looks_sayforsecs', 'control_wait'] : stage === 2 ? ['event_whenkeypressed', 'motion_movesteps', 'sensing_touchingobject'] : stage === 3 ? ['data_setvariableto', 'control_repeat', 'data_changevariableby', 'control_if'] : stage === 4 ? ['event_broadcast', 'event_whenbroadcastreceived', 'control_create_clone_of', 'control_start_as_clone'] : stage === 5 ? ['data_addtolist', 'pen_penDown', 'control_repeat'] : ['data_setvariableto', 'event_broadcast', 'data_changevariableby', 'looks_sayforsecs'];
  const requiredOps = [...new Set([...semanticOps, ...required])];
  const omitted = [...required].reverse().find((op) => op !== 'event_whenflagclicked');
  const activeOps = reference ? requiredOps : requiredOps.filter((op) => op !== omitted);
  const mainOps = activeOps.filter((op) => !['event_whenflagclicked', 'event_whenkeypressed', 'event_whenbroadcastreceived', 'event_whenthisspriteclicked', 'control_start_as_clone', 'procedures_definition', 'procedures_call', 'sensing_mousex','sensing_touchingcolor','sensing_askandwait','sensing_answer','sensing_keypressed','sensing_touchingobject','operator_gt','operator_multiply','operator_random','operator_equals','operator_add','operator_contains','operator_mod','sensing_distanceto','data_itemoflist','data_lengthoflist','data_addtolist'].includes(op));
  for (const op of mainOps) { const current = statement(op); blocks[previous].next = current; blocks[current].parent = previous; previous = current; }
  for (const op of activeOps.filter((item) => ['sensing_mousex','sensing_touchingcolor','sensing_askandwait','sensing_answer','sensing_keypressed','sensing_touchingobject','operator_gt','operator_multiply','operator_random','operator_equals','operator_add','operator_contains','operator_mod','sensing_distanceto','data_itemoflist','data_lengthoflist'].includes(item))) { const current = reporterStatement(op); blocks[previous].next = current; blocks[current].parent = previous; previous = current; }
  if (activeOps.includes('data_addtolist')) add('data_addtolist', { LIST: variable('足迹', 'trail') }, { ITEM: text('一步') }, null, null, false);
  if (activeOps.includes('procedures_call')) add('procedures_call', {}, {}, null, null, false, 0, 0, { mutation: { tagName: 'mutation', children: [], proccode: '报告探险结果', argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'false' } });
  for (const op of activeOps.filter((item) => ['event_whenkeypressed', 'event_whenbroadcastreceived', 'event_whenthisspriteclicked'].includes(item))) { const hat = add(op, op === 'event_whenkeypressed' ? { KEY_OPTION: ['space', 'space'] } : op === 'event_whenbroadcastreceived' ? { BROADCAST_OPTION: ['开始游戏', 'signal'] } : {}, {}, null, null, true, 70, 260); const body = statement(op === 'event_whenbroadcastreceived' ? 'looks_say' : 'motion_movesteps'); blocks[hat].next = body; blocks[body].parent = hat; }
  if (activeOps.includes('control_start_as_clone')) { const hat = add('control_start_as_clone', {}, {}, null, null, true, 300, 260); const body = statement('looks_say'); blocks[hat].next = body; blocks[body].parent = hat; }
  if (activeOps.includes('procedures_definition')) { const proto = add('procedures_prototype', {}, {}, null, null, false, 0, 0, { mutation: { tagName: 'mutation', children: [], proccode: '报告探险结果', argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'false' } }); add('procedures_definition', {}, { custom_block: [2, proto] }, null, null, true, 300, 260); }
  const referenced = new Set();
  for (const block of Object.values(blocks)) for (const input of Object.values(block.inputs ?? {})) if (Array.isArray(input) && (input[0] === 2 || (input[0] === 1 && typeof input[1] === 'string' && blocks[input[1]]))) referenced.add(input[1]);
  for (const [blockId, block] of Object.entries(blocks)) if (!block.topLevel && !block.parent && !referenced.has(blockId) && !['data_addtolist', 'data_itemoflist', 'procedures_call'].includes(block.opcode)) delete blocks[blockId];
  if (!reference && omitted) {
    const removed = new Set(Object.entries(blocks).filter(([, block]) => block.opcode === omitted).map(([blockId]) => blockId));
    for (const blockId of removed) delete blocks[blockId];
    for (const block of Object.values(blocks)) {
      if (removed.has(block.next)) block.next = null;
      if (removed.has(block.parent)) { block.parent = null; block.topLevel = true; block.x = block.x ?? 70; block.y = block.y ?? 180; }
      for (const [name, input] of Object.entries(block.inputs ?? {})) if (Array.isArray(input) && removed.has(input[1])) delete block.inputs[name];
    }
  }
  return blocks;
}

function diagram(title, required, stage) { const labels = { event_whenflagclicked: '点击绿旗', motion_gotoxy: '移到 x/y', looks_sayforsecs: '说话 2 秒', control_wait: '等待', event_whenkeypressed: '按下空格键', sensing_askandwait: '询问并等待', data_changevariableby: '分数增加', data_addtolist: '加入列表', event_broadcast: '广播消息', control_create_clone_of: '建立分身', pen_penDown: '落笔' }; const names = ['event_whenflagclicked', ...required].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5); const esc = (v) => String(v).replace(/[<>&"']/g, ''); const cards = names.map((name, i) => { const x = 20 + (i % 3) * 153, y = 74 + Math.floor(i / 3) * 86; return `<g><rect x="${x}" y="${y}" width="132" height="58" rx="11" fill="${colors[(stage + i) % colors.length]}" stroke="#25324a" stroke-width="2"/><text x="${x + 10}" y="${y + 25}" font-family="sans-serif" font-size="14" fill="#25324a">${esc(labels[name] ?? name)}</text><text x="${x + 10}" y="${y + 45}" font-family="sans-serif" font-size="10" fill="#53627a">第${i + 1}块</text></g>`; }).join(''); return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="250"><rect width="480" height="250" fill="#fffdf7"/><text x="20" y="32" font-family="sans-serif" font-size="19" font-weight="700" fill="#25324a">${esc(title)}</text><text x="20" y="53" font-family="sans-serif" font-size="12" fill="#53627a">示意：绿旗脚本与事件脚本</text>${cards}</svg>`; }
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ 0xffffffff) >>> 0; }
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }; const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
function zip(entries) { const locals = [], central = []; let offset = 0; for (const [name, value] of entries) { const n = Buffer.from(name), d = Buffer.isBuffer(value) ? value : Buffer.from(value), crc = crc32(d); const local = Buffer.concat([Buffer.from('PK\x03\x04'), u16(10), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(d.length), u32(d.length), u16(n.length), u16(0), n, d]); locals.push(local); central.push(Buffer.concat([Buffer.from('PK\x01\x02'), u16(20), u16(10), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(d.length), u32(d.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), n])); offset += local.length; } const centralSize = central.reduce((n, x) => n + x.length, 0), body = Buffer.concat([...locals, ...central]); return Buffer.concat([body, Buffer.from('PK\x05\x06'), Buffer.alloc(4), u16(entries.length), u16(entries.length), u32(centralSize), u32(offset), u16(0)]); }
function write(key, lesson, stage, reference) { const { required, title } = scenario(lesson); const backdrop = svg(title, colors[stage - 1], 'backdrop'), hero = svg('探险员', '#ffcf56', 'sprite'), buddy = svg('伙伴', '#73d2de', 'sprite', 1), bId = id(backdrop), hId = id(hero), pId = id(buddy); const blocks = makeBlocks(key, reference, lesson, '探险员'); const project = { targets: [{ isStage: true, name: 'Stage', variables: {}, lists: {}, broadcasts: { signal: '开始游戏' }, blocks: {}, comments: {}, currentCostume: 0, costumes: [{ assetId: bId, name: '舞台', md5ext: `${bId}.svg`, dataFormat: 'svg', rotationCenterX: 240, rotationCenterY: 180 }], sounds: [], volume: 100, layerOrder: 0, tempo: 60 }, { isStage: false, name: '探险员', variables: { score: variable('分数', 0) }, lists: { trail: ['足迹', []] }, broadcasts: { signal: '开始游戏' }, blocks, comments: {}, currentCostume: 0, costumes: [{ assetId: hId, name: '探险员', md5ext: `${hId}.svg`, dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 48 }, { assetId: pId, name: '伙伴', md5ext: `${pId}.svg`, dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 48 }], sounds: [], volume: 100, layerOrder: 1, visible: true, x: 0, y: 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around', extensions: ['pen'] }], meta: { semver: '3.0.0', vm: '11.6.0', agent: 'scratch-original-curriculum-generator' } }; if (stage === 5 || key === 's05-l08') project.extensions = ['pen']; const mainTarget = project.targets[1]; if (key === 's03-l08') { mainTarget.name = '玩家'; mainTarget.variables.spark = ['星光', 0]; mainTarget.variables.time = ['剩余时间', 10]; project.targets.push({ isStage: false, name: '星星', variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0, costumes: [], sounds: [], volume: 100, layerOrder: 2, visible: true, x: 100, y: 40, size: 70, direction: 90, draggable: false, rotationStyle: 'all around' }); project.targets[2].blocks = makeBlocks(key, reference, { ...lesson, title: '星星' }, '星星', stage); } else if (key === 's04-l08') { mainTarget.name = '水桶'; for (const name of ['云', '雨滴']) project.targets.push({ isStage: false, name, variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {}, currentCostume: 0, costumes: [], sounds: [], volume: 100, layerOrder: project.targets.length, visible: true, x: 0, y: 80, size: 70, direction: 90, draggable: false, rotationStyle: 'all around' }); project.targets[2].blocks = makeBlocks(key, reference, { ...lesson, title: '云' }, '云', stage); project.targets[3].blocks = makeBlocks(key, reference, { ...lesson, title: '雨滴' }, '雨滴', stage); } else if (key === 's05-l08') { mainTarget.variables.height = ['高度', 0]; mainTarget.lists.heights = ['高度', []]; } for (const target of project.targets.slice(2)) target.costumes = [{ assetId: hId, name: '角色', md5ext: `${hId}.svg`, dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 48 }]; const dir = path.join(OUTPUT, key); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `${reference ? 'reference' : 'starter'}.sb3`), zip([['project.json', JSON.stringify(project)], [`${bId}.svg`, backdrop], [`${hId}.svg`, hero], [`${pId}.svg`, buddy]])); if (reference) fs.writeFileSync(path.join(dir, 'diagram.svg'), diagram(title, required, stage)); }
const rows = lessons(), all = []; for (let stage = 1; stage <= 6; stage++) for (let n = 1; n <= 8; n++) { const key = `s0${stage}-l0${n}`; all.push(rows.find((row) => row.key === key) ?? { key, title: `第${stage}阶段 · 第${n}课`, requiredBlocks: [{ anyOf: ['event_whenflagclicked'] }] }); }
fs.mkdirSync(OUTPUT, { recursive: true }); all.forEach((lesson, i) => { const stage = Math.floor(i / 8) + 1; write(lesson.key, lesson, stage, false); write(lesson.key, lesson, stage, true); }); fs.writeFileSync(path.join(OUTPUT, 'cover.svg'), svg('原创 Scratch 课程', '#d8f5f1', 'backdrop'));
function genericScriptDiagram(title, project) {
  const labels = { event_whenflagclicked: '点击绿旗', event_whenkeypressed: '按键', event_whenthisspriteclicked: '点击角色', event_whenbroadcastreceived: '收到消息', motion_gotoxy: '移到坐标', motion_movesteps: '移动', motion_glideto: '滑行', motion_pointindirection: '面向方向', motion_ifonedgebounce: '碰到边缘反弹', motion_changexby: '改变横坐标', looks_say: '说', looks_sayforsecs: '说话', looks_nextcostume: '下一个造型', looks_switchcostumeto: '换造型', looks_switchbackdropto: '换背景', sound_playuntildone: '播放声音', control_wait: '等待', control_repeat: '重复', control_forever: '重复执行', control_repeat_until: '重复直到', control_if: '如果', control_if_else: '如果否则', event_broadcast: '广播消息', control_create_clone_of: '建立克隆体', control_delete_this_clone: '删除克隆体', data_setvariableto: '设变量', data_changevariableby: '改变变量', data_addtolist: '加入列表', data_replaceitemoflist: '替换列表项', pen_penDown: '落笔', pen_setPenColorToColor: '画笔设色' };
  const esc = (value) => String(value).replace(/[<>&"']/g, '');
  const rows = [];
  for (const target of project.targets.filter((item) => !item.isStage)) {
    const blocks = target.blocks ?? {};
    for (const [startId, start] of Object.entries(blocks)) {
      if (!start.topLevel) continue;
      const names = [], seen = new Set(); let blockId = startId;
      while (blockId && blocks[blockId] && !seen.has(blockId) && names.length < 12) {
        seen.add(blockId); const block = blocks[blockId];
        if (labels[block.opcode]) {
          let label = labels[block.opcode];
          const nestedId = block.inputs?.SUBSTACK?.[1];
          if (typeof nestedId === 'string' && blocks[nestedId]) label += `〔${labels[blocks[nestedId].opcode] ?? '动作'}〕`;
          names.push(label);
        }
        blockId = block.next;
      }
      if (names.length) rows.push({ role: target.name, names });
    }
  }
  let y = 57;
  const cards = rows.map((row, index) => {
    const chunks = [];
    for (let i = 0; i < row.names.length; i += 4) chunks.push(row.names.slice(i, i + 4).join(' → '));
    const height = 42 + chunks.length * 25;
    const card = `<rect x="20" y="${y}" width="760" height="${height}" rx="10" fill="${index % 2 ? '#e9f7f4' : '#eef3ff'}"/><text x="34" y="${y + 25}" font-size="16" font-weight="700" font-family="sans-serif" fill="#25324a">${esc(row.role)}</text>${chunks.map((line, i) => `<text x="34" y="${y + 50 + i * 25}" font-size="15" font-family="sans-serif" fill="#25324a">${esc(line)}</text>`).join('')}`;
    y += height + 8; return card;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${y + 18}"><rect width="100%" height="100%" rx="18" fill="#fffdf7"/><text x="24" y="38" font-size="22" font-weight="700" font-family="sans-serif" fill="#25324a">${esc(title)} · 实际脚本路线</text>${cards}</svg>`;
}
// Keep the generic exercise roles in sync with the lesson text. Explicit
// semantic overrides below replace these drafts for the authored scenarios.
for (const lesson of all) {
  const roles = [...(lesson.steps?.[1]?.description ?? '').matchAll(/(?:选中|另选)【([^】]+)】/g)].map((match) => match[1]);
  if (!roles.length) continue;
  for (const kind of ['starter', 'reference']) {
    const file = path.join(OUTPUT, lesson.key, `${kind}.sb3`);
    const archive = unzipSync(fs.readFileSync(file));
    const project = JSON.parse(strFromU8(archive['project.json']));
    project.targets[1].name = roles[0];
    if (roles[1]) {
      const first = project.targets[1], buddy = structuredClone(first);
      const buddyCostume = first.costumes[1] ?? first.costumes[0];
      buddy.name = roles[1]; buddy.variables = {}; buddy.lists = {}; buddy.blocks = {};
      buddy.costumes = [buddyCostume]; buddy.layerOrder = project.targets.length;
      buddy.x = 120; buddy.y = 0; buddy.size = 75;
      if (kind === 'reference') {
        const hatId = id(`${lesson.key}:buddy:hat`), sayId = id(`${lesson.key}:buddy:say`);
        buddy.blocks[hatId] = { opcode: 'event_whenflagclicked', next: sayId, parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 70, y: 60 };
        buddy.blocks[sayId] = { opcode: 'looks_say', next: null, parent: hatId, inputs: { MESSAGE: text(`${roles[1]}准备好了`) }, fields: {}, shadow: false, topLevel: false };
      }
      project.targets.push(buddy);
    }
    archive['project.json'] = strToU8(JSON.stringify(project));
    fs.writeFileSync(file, zipSync(archive));
    if (kind === 'reference') fs.writeFileSync(path.join(OUTPUT, lesson.key, 'diagram.svg'), genericScriptDiagram(lesson.title, project));
  }
}
await applySemanticOverrides(OUTPUT, all); console.log(`Generated ${all.length * 2} Scratch projects in ${path.relative(ROOT, OUTPUT)}`);
