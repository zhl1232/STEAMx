/** Hand-authored, runnable milestone examples shared by SB3 and diagram output. */
import crypto from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const digest = (value) => crypto.createHash('md5').update(value).digest('hex')
const literal = (value) => typeof value === 'number' ? [1, [4, String(value)]] : [1, [10, String(value)]]
const clone = (value) => JSON.parse(JSON.stringify(value))

function tone(frequency) {
  const rate = 22050, frames = Math.round(rate * .25), bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28)
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++) {
    const fade = Math.min(1, i / 300, (frames - i) / 900)
    bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * i / rate) * 9000 * fade), 44 + i * 2)
  }
  return bytes
}

function roleSvg(name, color) {
  const safe = name.replace(/[<>&"']/g, '')
  const ink = '#25324a'
  const face = `<circle cx="38" cy="45" r="3" fill="${ink}"/><circle cx="58" cy="45" r="3" fill="${ink}"/><path d="M38 61Q48 68 58 61" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
  let shape
  if (/云/.test(name)) shape = `<path d="M21 65Q11 62 14 49Q17 38 30 38Q36 20 54 23Q68 24 71 38Q86 37 86 52Q86 65 72 65Z" fill="${color}" stroke="${ink}" stroke-width="4"/>${face}`
  else if (/雨滴|小雨滴|雨滴克隆/.test(name)) shape = `<path d="M48 9C42 24 20 45 20 59C20 76 32 87 48 87S76 76 76 59C76 45 54 24 48 9Z" fill="#73d2de" stroke="${ink}" stroke-width="4"/>${face}`
  else if (/水桶|接水桶/.test(name)) shape = `<path d="M18 31H78L71 82H25Z" fill="${color}" stroke="${ink}" stroke-width="4"/><path d="M25 32Q27 10 48 10Q69 10 71 32" fill="none" stroke="${ink}" stroke-width="4"/><path d="M30 52H66" stroke="${ink}" stroke-width="3"/>${face}`
  else if (/星|花瓣|终点花/.test(name)) shape = `<path d="M48 9L57 34L84 35L63 52L71 79L48 64L25 79L33 52L12 35L39 34Z" fill="${color}" stroke="${ink}" stroke-width="4"/>${face}`
  else if (/小鸟|啄木鸟/.test(name)) shape = `<ellipse cx="46" cy="51" rx="32" ry="27" fill="${color}" stroke="${ink}" stroke-width="4"/><path d="M56 50L88 42L60 61Z" fill="#ff9b71" stroke="${ink}" stroke-width="3"/><path d="M20 57Q43 34 58 63" fill="none" stroke="${ink}" stroke-width="4"/><circle cx="45" cy="41" r="4" fill="${ink}"/>`
  else if (/树|叶|种子/.test(name)) shape = `<path d="M43 46H53V85H43Z" fill="#9b6644" stroke="${ink}" stroke-width="3"/><path d="M48 12C16 19 12 57 48 64C84 57 80 19 48 12Z" fill="${color}" stroke="${ink}" stroke-width="4"/>${face}`
  else if (/蝴蝶/.test(name)) shape = `<ellipse cx="29" cy="34" rx="20" ry="24" fill="${color}" stroke="${ink}" stroke-width="3"/><ellipse cx="67" cy="34" rx="20" ry="24" fill="${color}" stroke="${ink}" stroke-width="3"/><ellipse cx="29" cy="66" rx="17" ry="19" fill="#b8a1ff" stroke="${ink}" stroke-width="3"/><ellipse cx="67" cy="66" rx="17" ry="19" fill="#b8a1ff" stroke="${ink}" stroke-width="3"/><path d="M48 24V75" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>`
  else if (/小车/.test(name)) shape = `<path d="M14 43H78L86 64H11Z" fill="${color}" stroke="${ink}" stroke-width="4"/><path d="M26 43L35 26H65L74 43Z" fill="#d8f5f1" stroke="${ink}" stroke-width="3"/><circle cx="28" cy="68" r="9" fill="${ink}"/><circle cx="70" cy="68" r="9" fill="${ink}"/>`
  else if (/月亮/.test(name)) shape = `<path d="M59 9A37 37 0 1 0 86 64A35 35 0 0 1 59 9Z" fill="${color}" stroke="${ink}" stroke-width="4"/>`
  else if (/小灯/.test(name)) shape = `<path d="M30 26Q48 7 66 26Q76 39 60 57H36Q20 39 30 26Z" fill="${color}" stroke="${ink}" stroke-width="4"/><path d="M37 58H59L56 76H40Z" fill="#a6a6bf" stroke="${ink}" stroke-width="3"/><path d="M40 82H56" stroke="${ink}" stroke-width="5"/>`
  else if (/画家|画笔|绘图/.test(name)) shape = `<path d="M20 75L59 20L76 32L38 84L20 87Z" fill="${color}" stroke="${ink}" stroke-width="4"/><path d="M20 75L20 87L38 84" fill="#d39b6c" stroke="${ink}" stroke-width="3"/>`
  else shape = `<circle cx="48" cy="48" r="37" fill="${color}" stroke="${ink}" stroke-width="4"/>${face}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${shape}<title>${safe}</title></svg>`
}

class ScriptBuilder {
  constructor(project, target, key) { this.project = project; this.target = target; this.key = key; this.blocks = target.blocks; this.count = 0 }
  id(opcode) { return digest(`${this.key}:${this.target.name}:${this.count++}:${opcode}`) }
  block(opcode, parent = null, fields = {}, inputs = {}, topLevel = false, shadow = false, mutation) {
    const id = this.id(opcode)
    this.blocks[id] = { opcode, next: null, parent, inputs, fields, shadow, topLevel, ...(topLevel ? { x: 70 + (this.count % 3) * 210, y: 60 + Math.floor(this.count / 3) * 110 } : {}), ...(mutation ? { mutation } : {}) }
    return id
  }
  variableId(name) { return `v_${digest(`${this.key}:${name}`).slice(0, 12)}` }
  listId(name) { return `l_${digest(`${this.key}:${name}`).slice(0, 12)}` }
  messageId(name) { const id = `m_${digest(`${this.key}:${name}`).slice(0, 12)}`; this.project.targets[0].broadcasts[id] = name; return id }
  expr(value, parent) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return literal(value)
    const [kind, arg] = Object.entries(value)[0]
    const opcode = { var: 'data_variable', answer: 'sensing_answer', timer: 'sensing_timer', x: 'motion_xposition', y: 'motion_yposition', touching: 'sensing_touchingobject', touchingColor: 'sensing_touchingcolor', distance: 'sensing_distanceto', key: 'sensing_keypressed', gt: 'operator_gt', eq: 'operator_equals', contains: 'operator_contains', mod: 'operator_mod', and: 'operator_and', or: 'operator_or', add: 'operator_add', random: 'operator_random', length: 'data_lengthoflist', item: 'data_itemoflist' }[kind]
    if (!opcode) throw new Error(`Unsupported expression ${kind}`)
    const fields = kind === 'var' ? { VARIABLE: [arg, this.variableId(arg)] }
      : kind === 'length' || kind === 'item' ? { LIST: [kind === 'item' ? arg[0] : arg, this.listId(kind === 'item' ? arg[0] : arg)] }
      : {}
    const id = this.block(opcode, parent, fields)
    const inputs = this.blocks[id].inputs
    if (kind === 'touching') inputs.TOUCHINGOBJECTMENU = literal(arg)
    if (kind === 'touchingColor') inputs.COLOR = [1, [9, arg]]
    if (kind === 'distance') inputs.DISTANCETOMENU = literal(arg)
    if (kind === 'key') inputs.KEY_OPTION = literal(arg)
    if (kind === 'item') inputs.INDEX = this.expr(arg[1], id)
    if (['gt', 'eq', 'contains', 'mod', 'and', 'or', 'add', 'random'].includes(kind)) {
      const names = kind === 'and' || kind === 'or' ? ['OPERAND1', 'OPERAND2']
        : kind === 'add' || kind === 'mod' ? ['NUM1', 'NUM2'] : kind === 'random' ? ['FROM', 'TO'] : kind === 'contains' ? ['STRING1', 'STRING2'] : ['OPERAND1', 'OPERAND2']
      inputs[names[0]] = this.expr(arg[0], id); inputs[names[1]] = this.expr(arg[1], id)
    }
    return [2, id]
  }
  chain(parent, actions, inputName) {
    let previous = null, first = null
    for (const action of actions) {
      const id = this.action(action, previous ?? parent)
      if (!first) first = id
      if (previous) this.blocks[previous].next = id
      previous = id
    }
    if (inputName && first) this.blocks[parent].inputs[inputName] = [2, first]
    return first
  }
  action(action, parent) {
    const [kind, arg] = Object.entries(action)[0]
    const opcode = { goto: 'motion_gotoxy', gotoRandom: 'motion_goto', glide: 'motion_glidesecstoxy', move: 'motion_movesteps', turn: 'motion_turnright', point: 'motion_pointindirection', bounce: 'motion_ifonedgebounce', changeX: 'motion_changexby', changeY: 'motion_changeyby', say: 'looks_say', sayFor: 'looks_sayforsecs', wait: 'control_wait', set: 'data_setvariableto', change: 'data_changevariableby', showVar: 'data_showvariable', addList: 'data_addtolist', replaceList: 'data_replaceitemoflist', show: 'looks_show', hide: 'looks_hide', nextCostume: 'looks_nextcostume', effect: 'looks_changeeffectby', broadcast: 'event_broadcast', clone: 'control_create_clone_of', deleteClone: 'control_delete_this_clone', repeat: 'control_repeat', repeatUntil: 'control_repeat_until', forever: 'control_forever', if: 'control_if', ifElse: 'control_if_else', ask: 'sensing_askandwait', penClear: 'pen_clear', penSize: 'pen_setPenSizeTo', penDown: 'pen_penDown', penUp: 'pen_penUp', play: 'sound_playuntildone', costume: 'looks_switchcostumeto', backdrop: 'looks_switchbackdropto', call: 'procedures_call' }[kind]
    if (!opcode) throw new Error(`Unsupported action ${kind}`)
    const fields = kind === 'set' || kind === 'change' ? { VARIABLE: [arg[0], this.variableId(arg[0])] }
      : kind === 'showVar' ? { VARIABLE: [arg, this.variableId(arg)] }
      : kind === 'addList' || kind === 'replaceList' ? { LIST: [arg[0], this.listId(arg[0])] }
      : kind === 'effect' ? { EFFECT: ['color', null] } : {}
    const mutation = kind === 'call' ? { tagName: 'mutation', children: [], proccode: arg, argumentids: '[]', warp: 'false' } : undefined
    const id = this.block(opcode, parent, fields, {}, false, false, mutation), inputs = this.blocks[id].inputs
    if (kind === 'goto') { inputs.X = this.expr(arg[0], id); inputs.Y = this.expr(arg[1], id) }
    if (kind === 'gotoRandom') inputs.TO = literal('_random_')
    if (kind === 'glide') { inputs.SECS = this.expr(arg[0], id); inputs.X = this.expr(arg[1], id); inputs.Y = this.expr(arg[2], id) }
    if (kind === 'move') inputs.STEPS = this.expr(arg, id)
    if (kind === 'turn') inputs.DEGREES = this.expr(arg, id)
    if (kind === 'point') inputs.DIRECTION = this.expr(arg, id)
    if (kind === 'changeX') inputs.DX = this.expr(arg, id)
    if (kind === 'changeY') inputs.DY = this.expr(arg, id)
    if (kind === 'say') inputs.MESSAGE = this.expr(arg, id)
    if (kind === 'sayFor') { inputs.MESSAGE = this.expr(arg[0], id); inputs.SECS = this.expr(arg[1], id) }
    if (kind === 'wait') inputs.DURATION = this.expr(arg, id)
    if (kind === 'set') inputs.VALUE = this.expr(arg[1], id)
    if (kind === 'change') inputs.VALUE = this.expr(arg[1], id)
    if (kind === 'addList') inputs.ITEM = this.expr(arg[1], id)
    if (kind === 'replaceList') { inputs.INDEX = this.expr(arg[1], id); inputs.ITEM = this.expr(arg[2], id) }
    if (kind === 'effect') inputs.CHANGE = this.expr(arg, id)
    if (kind === 'penSize') inputs.SIZE = this.expr(arg, id)
    if (kind === 'ask') inputs.QUESTION = this.expr(arg, id)
    if (kind === 'broadcast') {
      const menu = this.block('event_broadcast_menu', id, { BROADCAST_OPTION: [arg, this.messageId(arg)] }, {}, false, true)
      inputs.BROADCAST_INPUT = [1, menu]
    }
    if (kind === 'clone') inputs.CLONE_OPTION = literal(arg)
    if (kind === 'play') {
      const menu = this.block('sound_sounds_menu', id, { SOUND_MENU: [arg, null] }, {}, false, true)
      inputs.SOUND_MENU = [1, menu]
    }
    if (kind === 'costume') inputs.COSTUME = literal(arg)
    if (kind === 'backdrop') inputs.BACKDROP = literal(arg)
    if (kind === 'repeat') { inputs.TIMES = this.expr(arg[0], id); this.chain(id, arg[1], 'SUBSTACK') }
    if (kind === 'repeatUntil') { inputs.CONDITION = this.expr(arg[0], id); this.chain(id, arg[1], 'SUBSTACK') }
    if (kind === 'forever') this.chain(id, arg, 'SUBSTACK')
    if (kind === 'if') { inputs.CONDITION = this.expr(arg[0], id); this.chain(id, arg[1], 'SUBSTACK') }
    if (kind === 'ifElse') { inputs.CONDITION = this.expr(arg[0], id); this.chain(id, arg[1], 'SUBSTACK'); this.chain(id, arg[2], 'SUBSTACK2') }
    return id
  }
  script(hat, actions) {
    const [kind, arg] = Object.entries(hat)[0]
    const opcode = { flag: 'event_whenflagclicked', key: 'event_whenkeypressed', click: 'event_whenthisspriteclicked', receive: 'event_whenbroadcastreceived', clone: 'control_start_as_clone' }[kind]
    const fields = kind === 'key' ? { KEY_OPTION: [arg, null] } : kind === 'receive' ? { BROADCAST_OPTION: [arg, this.messageId(arg)] } : {}
    const id = this.block(opcode, null, fields, {}, true)
    this.blocks[id].next = this.chain(id, actions)
  }
  procedure(name, actions) {
    const mutation = { tagName: 'mutation', children: [], proccode: name, argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'false' }
    const id = this.block('procedures_definition', null, {}, {}, true)
    const proto = this.block('procedures_prototype', id, {}, {}, false, true, mutation)
    this.blocks[id].inputs.custom_block = [1, proto]
    this.blocks[id].next = this.chain(id, actions)
  }
}

function semanticPrograms(key) {
  const flag = { flag: true }
  if (key === 's01-l06') return { roles: ['小熊', '啄木鸟', '青蛙'], sounds: { 小熊: 330, 啄木鸟: 660, 青蛙: 880 }, scripts: [
    ['小熊', { key: 'space' }, [{ play: '鼓点' }, { broadcast: '第二拍' }]],
    ['啄木鸟', { receive: '第二拍' }, [{ play: '鼓点' }, { broadcast: '第三拍' }]],
    ['青蛙', { receive: '第三拍' }, [{ play: '鼓点' }, { sayFor: ['合奏完成！', 2] }]],
  ] }
  if (key === 's01-l08') return { roles: ['种子', '小鸟', '云朵'], scripts: [
    ['种子', flag, [{ broadcast: '开场' }, { wait: 3 }, { broadcast: '谢幕' }]],
    ['种子', { receive: '开场' }, [{ sayFor: ['我是一颗种子', 1] }]],
    ['小鸟', { receive: '开场' }, [{ wait: 1 }, { sayFor: ['我来帮你旅行', 1] }]],
    ['云朵', { receive: '谢幕' }, [{ sayFor: ['故事结束，谢谢观看！', 2] }]],
  ] }
  if (key === 's02-l01') return { roles: ['小车', '停车线'], palette: { 停车线: '#ef6f78' }, scripts: [
    ['小车', flag, [{ goto: [-180, 0] }, { repeatUntil: [{ touchingColor: '#ef6f78' }, [{ move: 10 }, { wait: .05 }]] }, { sayFor: ['停在停车线！', 2] }]],
    ['停车线', flag, [{ goto: [125, 0] }]],
  ] }
  if (key === 's02-l03') return { roles: ['探索员', '萤火虫'], scripts: [
    ['探索员', flag, [{ goto: [-150, -40] }, { glide: [1, 95, 60] }, { if: [{ gt: [35, { distance: '萤火虫' }] }, [{ sayFor: ['追上萤火虫了！', 2] }]] }]],
    ['萤火虫', flag, [{ goto: [110, 65] }]],
  ] }
  if (key === 's02-l08') return { roles: ['探索员', '水边', '树顶'], scripts: [
    ['水边', { click: true }, [{ broadcast: '水边' }]], ['树顶', { click: true }, [{ broadcast: '树顶' }]],
    ['探索员', { receive: '水边' }, [{ sayFor: ['这里可以观察小鱼', 2] }]],
    ['探索员', { receive: '树顶' }, [{ sayFor: ['这里可以观察鸟巢', 2] }]],
  ] }
  if (key === 's03-l03') return { roles: ['红兔', '蓝龟'], variables: { 红兔距离: 0, 蓝龟距离: 0 }, scripts: [
    ['红兔', flag, [{ goto: [-180, 50] }, { set: ['红兔距离', 0] }, { repeat: [5, [{ move: 35 }, { change: ['红兔距离', 35] }, { wait: .2 }]] }, { ifElse: [{ gt: [{ var: '红兔距离' }, { var: '蓝龟距离' }] }, [{ sayFor: ['红兔先到！', 2] }], [{ sayFor: ['蓝龟先到！', 2] }]] }]],
    ['蓝龟', flag, [{ goto: [-180, -50] }, { set: ['蓝龟距离', 0] }, { repeat: [5, [{ move: 25 }, { change: ['蓝龟距离', 25] }, { wait: .2 }]] }]],
  ] }
  if (key === 's03-l08') return { roles: ['玩家', '星星'], variables: { 星光: 0, 剩余时间: 20 }, scripts: [
    ['玩家', flag, [{ goto: [0, 0] }, { set: ['星光', 0] }, { set: ['剩余时间', 20] }, { repeatUntil: [{ or: [{ gt: [{ var: '星光' }, 4] }, { eq: [{ var: '剩余时间' }, 0] }] }, [{ wait: 1 }, { change: ['剩余时间', -1] }]] }, { ifElse: [{ gt: [{ var: '星光' }, 4] }, [{ broadcast: '过关' }], [{ broadcast: '失败' }]] }]],
    ['玩家', { key: 'right arrow' }, [{ changeX: 20 }]], ['玩家', { key: 'left arrow' }, [{ changeX: -20 }]],
    ['星星', flag, [{ goto: [80, 0] }, { show: true }, { forever: [{ if: [{ touching: '玩家' }, [{ change: ['星光', 1] }, { goto: [{ random: [-180, 180] }, { random: [-120, 120] }] }, { wait: .25 }]] }] }]],
    ['玩家', { receive: '过关' }, [{ sayFor: ['收集成功！', 2] }]], ['玩家', { receive: '失败' }, [{ sayFor: ['时间到，再试一次', 2] }]],
  ] }
  if (key === 's04-l08') return { roles: ['水桶', '云', '雨滴'], variables: { 雨量: 0 }, scripts: [
    ['水桶', flag, [{ goto: [0, -130] }, { set: ['雨量', 0] }, { repeatUntil: [{ gt: [{ var: '雨量' }, 7] }, [{ wait: .1 }]] }, { broadcast: '收集完成' }]],
    ['水桶', { key: 'right arrow' }, [{ changeX: 25 }]], ['水桶', { key: 'left arrow' }, [{ changeX: -25 }]],
    ['云', flag, [{ broadcast: '下雨' }]],
    ['雨滴', flag, [{ hide: true }]], ['雨滴', { receive: '下雨' }, [{ repeatUntil: [{ gt: [{ var: '雨量' }, 7] }, [{ clone: '_myself_' }, { wait: .5 }]] }]],
    ['雨滴', { clone: true }, [{ goto: [{ random: [-200, 200] }, 150] }, { show: true }, { repeatUntil: [{ or: [{ touching: '水桶' }, { gt: [-170, { y: true }] }] }, [{ changeY: -10 }, { wait: .05 }]] }, { if: [{ touching: '水桶' }, [{ change: ['雨量', 1] }]] }, { deleteClone: true }]],
    ['水桶', { receive: '收集完成' }, [{ sayFor: ['接满八滴雨！', 2] }]],
  ] }
  if (key === 's05-l08') return { roles: ['数据画家'], variables: { 序号: 1, 当前高度: 0 }, lists: { 高度: [] }, pen: true, scripts: [
    ['数据画家', flag, [{ penClear: true }, { penSize: 4 }, { goto: [-180, -120] }, { set: ['序号', 1] }, { repeat: [{ length: '高度' }, [{ set: ['当前高度', { item: ['高度', { var: '序号' }] }] }, { call: '画柱条' }, { change: ['序号', 1] }]] }, { sayFor: ['我的自然数据画完成啦', 2] }]],
  ], procedures: [['数据画家', '画柱条', [{ penDown: true }, { changeY: { var: '当前高度' } }, { penUp: true }, { goto: [{ add: [{ x: true }, 55] }, -120] }]]], seedList: [20, 40, 10, 30] }
  if (key === 's05-l04') return { roles: ['图鉴管理员', '关键词卡片'], scripts: [
    ['图鉴管理员', flag, [{ ask: '你观察到了什么？' }, { ifElse: [{ contains: [{ answer: true }, '花'] }, [{ sayFor: ['放进花朵图鉴', 2] }], [{ sayFor: ['继续观察', 2] }]] }]],
    ['关键词卡片', flag, [{ say: '提示：试试输入花瓣' }]],
  ] }
  if (key === 's05-l05') return { roles: ['绘图机器人', '画笔'], pen: true, scripts: [
    ['绘图机器人', flag, [{ penClear: true }, { goto: [-60, -60] }, { penDown: true }, { repeat: [4, [{ move: 100 }, { turn: 90 }]] }, { penUp: true }, { sayFor: ['画好正方形！', 2] }]],
    ['画笔', flag, [{ say: '四条边，每次右转90度' }]],
  ] }
  if (key === 's05-l06') return { roles: ['花瓣机器人', '花瓣'], variables: { 编号: 1 }, pen: true, scripts: [
    ['花瓣机器人', flag, [{ penClear: true }, { set: ['编号', 1] }, { repeat: [6, [{ if: [{ eq: [{ mod: [{ var: '编号' }, 2] }, 0] }, [{ penDown: true }]] }, { move: 35 }, { penUp: true }, { turn: 60 }, { change: ['编号', 1] }]] }]],
    ['花瓣', flag, [{ say: '偶数瓣才落笔' }]],
  ] }
  if (key === 's05-l07') return { roles: ['小画家'], pen: true, scripts: [
    ['小画家', flag, [{ penClear: true }, { penSize: 4 }, { goto: [-100, 0] }, { call: '画叶片' }, { goto: [30, 0] }, { call: '画叶片' }, { sayFor: ['同一个画法用了两次！', 2] }]],
  ], procedures: [['小画家', '画叶片', [{ penDown: true }, { repeat: [2, [{ move: 40 }, { turn: 60 }]] }, { penUp: true }]]] }
  if (key === 's06-l01') return { roles: ['小设计师', '测试伙伴'], scripts: [
    ['小设计师', flag, [{ sayFor: ['需求1：能开始', 2] }, { sayFor: ['需求2：有目标', 2] }, { sayFor: ['需求3：能再玩', 2] }, { broadcast: '需求说完' }]],
    ['测试伙伴', { receive: '需求说完' }, [{ say: '我能复述三条检查点！' }]],
  ] }
  if (key === 's06-l04') return { roles: ['玩家', '讲解角色'], scripts: [
    ['玩家', flag, [{ broadcast: '开始' }, { wait: 2 }, { broadcast: '完成' }]],
    ['讲解角色', { receive: '开始' }, [{ sayFor: ['轮到你了！', 2] }]],
    ['讲解角色', { receive: '完成' }, [{ sayFor: ['合作成功！', 2] }]],
  ] }
  if (key === 's06-l08') return { roles: ['发布者', '星星'], variables: { 分数: 0 }, scripts: [
    ['发布者', flag, [{ goto: [0, 0] }, { set: ['分数', 0] }, { sayFor: ['目标：收集三颗星，按方向键移动', 3] }]],
    ['发布者', { key: 'right arrow' }, [{ changeX: 20 }]], ['发布者', { key: 'left arrow' }, [{ changeX: -20 }]],
    ['星星', flag, [{ goto: [100, 0] }, { show: true }, { forever: [{ if: [{ touching: '发布者' }, [{ change: ['分数', 1] }, { goto: [{ random: [-170, 170] }, { random: [-100, 100] }] }, { wait: .3 }]] }] }]],
    ['发布者', flag, [{ repeatUntil: [{ gt: [{ var: '分数' }, 2] }, [{ wait: .1 }]] }, { sayFor: ['测试证据：收集三颗星才过关。下一版加新角色！', 3] }]],
  ] }
  const programs = {
    's01-l01': { roles: ['小探险员', '地图标记'], scripts: [['小探险员', flag, [{ goto: [0, 0] }, { sayFor: ['我到啦！', 2] }]], ['地图标记', flag, [{ goto: [120, 80] }]]] },
    's01-l02': { roles: ['种子', '风铃'], scripts: [['种子', flag, [{ goto: [-120, 0] }, { repeat: [4, [{ move: 30 }, { wait: .5 }]] }, { sayFor: ['散步结束！', 2] }]], ['风铃', flag, [{ goto: [100, 80] }]]] },
    's01-l03': { roles: ['云朵', '雨滴'], costumes: { 云朵: { 乌云: '#52608a' } }, scripts: [['云朵', flag, [{ repeat: [4, [{ nextCostume: true }, { wait: .5 }]] }]], ['雨滴', flag, [{ goto: [110, -50] }]]] },
    's01-l04': { roles: ['月亮', '小信封'], scripts: [['月亮', flag, [{ sayFor: ['请把信送给小鸟', 2] }, { wait: 1 }, { sayFor: ['谢谢你！', 2] }]], ['小信封', flag, [{ goto: [120, 0] }]]] },
    's01-l05': { roles: ['蝴蝶', '终点花'], costumes: { 蝴蝶: { 展翅: '#dca7ff' } }, scripts: [['蝴蝶', flag, [{ point: 90 }, { repeat: [4, [{ move: 25 }, { nextCostume: true }, { wait: .2 }]] }]], ['终点花', flag, [{ goto: [130, 0] }]]] },
    's01-l07': { roles: ['小灯', '安全站牌'], costumes: { 小灯: { 亮灯: '#fff072' } }, scripts: [['小灯', flag, [{ goto: [-90, 0] }, { costume: '亮灯' }, { sayFor: ['找到安全站啦！', 2] }]], ['安全站牌', flag, [{ goto: [100, 0] }]]] },
    's02-l02': { roles: ['探索员', '沼泽'], scripts: [['探索员', flag, [{ goto: [0, 0] }]], ['探索员', { key: 'right arrow' }, [{ changeX: 20 }]], ['探索员', { key: 'left arrow' }, [{ changeX: -20 }]], ['沼泽', flag, [{ goto: [150, -80] }]]] },
    's02-l04': { roles: ['小鸟', '云朵边界'], scripts: [['小鸟', flag, [{ goto: [160, 0] }, { repeat: [20, [{ move: 20 }, { bounce: true }, { wait: .1 }]] }]], ['云朵边界', flag, [{ goto: [0, 100] }]]] },
    's02-l05': { roles: ['小园丁', '三朵花'], costumes: { 小园丁: { 开心: '#f9a5ad' } }, scripts: [
      ['小园丁', flag, [
        { goto: [-120, 0] },
        { forever: [
          { if: [{ touching: '三朵花' }, [{ costume: '开心' }]] },
          { wait: .1 },
        ] },
      ]],
      ['三朵花', flag, [{ goto: [80, 0] }]],
    ] },
    's02-l06': { roles: ['小猫', '太阳和月亮'], backdrops: { 夜晚: '#233258' }, scripts: [['小猫', flag, [{ say: '空格切夜晚，按D回白天' }]], ['小猫', { key: 'space' }, [{ backdrop: '夜晚' }]], ['小猫', { key: 'd' }, [{ backdrop: '舞台' }]], ['太阳和月亮', flag, [{ goto: [130, 90] }]]] },
    's02-l07': { roles: ['树洞', '小访客'], scripts: [['树洞', flag, [{ ask: '你叫什么名字？' }, { say: { answer: true } }]], ['小访客', flag, [{ goto: [110, 0] }]]] },
    's03-l01': { roles: ['探索员', '星光'], variables: { 分数: 0 }, scripts: [
      ['探索员', flag, [{ set: ['分数', 0] }]],
      ['星光', flag, [
        { goto: [100, 0] },
        { forever: [
          { if: [{ touching: '探索员' }, [
            { change: ['分数', 1] },
            { goto: [{ random: [-160, 160] }, { random: [-100, 100] }] },
            { wait: .3 },
          ]] },
        ] },
      ]],
    ] },
    's03-l02': { roles: ['种子', '落点标牌'], variables: { 落点: 0 }, scripts: [['种子', flag, [{ gotoRandom: true }, { set: ['落点', { x: true }] }, { say: { var: '落点' } }]], ['落点标牌', flag, [{ goto: [0, -100] }]]] },
    's03-l04': { roles: ['小沙漏', '叶子'], variables: { 剩余时间: 5 }, scripts: [['小沙漏', flag, [{ set: ['剩余时间', 5] }, { repeat: [5, [{ wait: 1 }, { change: ['剩余时间', -1] }]] }, { sayFor: ['时间到！', 2] }]], ['叶子', flag, [{ goto: [110, 0] }]]] },
    's03-l05': { roles: ['小玩家', '安全叶片'], variables: { 机会: 3 }, scripts: [['小玩家', flag, [{ set: ['机会', 3] }, { repeat: [3, [{ change: ['机会', -1] }, { if: [{ gt: [{ var: '机会' }, 0] }, [{ sayFor: ['再试一次', .5] }]] }, { wait: .2 }]] }]], ['安全叶片', flag, [{ goto: [130, 0] }]]] },
    's03-l06': { roles: ['开始按钮', '游戏角色'], scripts: [['开始按钮', { click: true }, [{ broadcast: '开始游戏' }]], ['游戏角色', { receive: '开始游戏' }, [{ sayFor: ['游戏开始！点击我可再来', 2] }]], ['游戏角色', { click: true }, [{ broadcast: '再来一次' }]], ['游戏角色', { receive: '再来一次' }, [{ sayFor: ['重新开始！', 2] }]]] },
    's03-l07': { roles: ['探索员', '宝石'], variables: { 分数: 0 }, scripts: [
      ['探索员', flag, [{ set: ['分数', 0] }]],
      ['宝石', flag, [
        { goto: [80, 0] },
        { forever: [
          { if: [{ touching: '探索员' }, [
            { change: ['分数', 1] }, { goto: [150, 80] }, { wait: .3 },
          ]] },
          { wait: .1 },
        ] },
      ]],
    ] },
    's04-l01': { roles: ['主持人', '森林角色'], scripts: [['主持人', flag, [{ broadcast: '开场' }]], ['森林角色', { receive: '开场' }, [{ sayFor: ['森林故事开始！', 2] }]]] },
    's04-l02': { roles: ['提问者', '回答者'], scripts: [['提问者', flag, [{ broadcast: '请回答' }]], ['回答者', { receive: '请回答' }, [{ wait: 1 }, { sayFor: ['轮到我说了！', 2] }]]] },
    's04-l03': { roles: ['小雨滴', '乌云'], scripts: [['乌云', flag, [{ broadcast: '下雨' }]], ['小雨滴', flag, [{ hide: true }]], ['小雨滴', { receive: '下雨' }, [{ repeat: [8, [{ clone: '_myself_' }, { wait: .3 }]] }]], ['小雨滴', { clone: true }, [{ show: true }, { goto: [{ random: [-170, 170] }, 100] }, { effect: 10 }, { wait: 1 }, { deleteClone: true }]]] },
    's04-l04': { roles: ['接水桶', '雨滴克隆'], variables: { 接到: 0 }, scripts: [['接水桶', flag, [{ goto: [0, -120] }, { set: ['接到', 0] }]], ['雨滴克隆', flag, [{ hide: true }, { repeat: [5, [{ clone: '_myself_' }, { wait: .5 }]] }]], ['雨滴克隆', { clone: true }, [{ show: true }, { goto: [{ random: [-160, 160] }, 140] }, { repeatUntil: [{ or: [{ touching: '接水桶' }, { gt: [-170, { y: true }] }] }, [{ changeY: -15 }, { wait: .05 }]] }, { if: [{ touching: '接水桶' }, [{ change: ['接到', 1] }]] }, { deleteClone: true }]]] },
    's04-l05': { roles: ['鼓手', '旋律伙伴'], sounds: { 鼓手: 330, 旋律伙伴: 660 }, scripts: [['鼓手', flag, [{ play: '鼓点' }, { broadcast: '轮到伙伴' }]], ['旋律伙伴', { receive: '轮到伙伴' }, [{ play: '鼓点' }, { sayFor: ['接力完成！', 2] }]]] },
    's04-l06': { roles: ['值班表管理员', '小助手'], lists: { 值班表: [] }, scripts: [['值班表管理员', flag, [{ addList: ['值班表', '小助手'] }, { say: { item: ['值班表', 1] } }]], ['小助手', flag, [{ say: '我来值班' }]]] },
    's04-l07': { roles: ['雨滴', '合作伙伴'], variables: { 分数: 0 }, scripts: [['雨滴', flag, [{ goto: [90, 0] }, { set: ['分数', 0] }, { repeat: [5, [{ if: [{ touchingColor: '#73d2de' }, [{ change: ['分数', 1] }]] }, { wait: .2 }]] }]], ['合作伙伴', flag, [{ goto: [90, 0] }]]] },
    's05-l01': { roles: ['观察员', '清单'], lists: { 观察清单: [] }, scripts: [['观察员', flag, [{ ask: '你看到了什么？' }, { addList: ['观察清单', { answer: true }] }, { say: '已经记到清单里' }]], ['清单', flag, [{ say: '把新发现记下来' }]]] },
    's05-l02': { roles: ['记录员', '观察清单'], lists: { 观察清单: ['树叶', '花瓣'] }, scripts: [['记录员', flag, [{ replaceList: ['观察清单', 2, '蝴蝶'] }, { say: { item: ['观察清单', 2] } }]], ['观察清单', flag, [{ say: '第二项已经更新' }]]] },
    's05-l03': { roles: ['比较员', '小树队列'], variables: { 最高: 0, 当前: 0 }, scripts: [['比较员', flag, [{ set: ['最高', 0] }, { repeat: [4, [{ set: ['当前', { random: [10, 80] }] }, { if: [{ gt: [{ var: '当前' }, { var: '最高' }] }, [{ set: ['最高', { var: '当前' }] }]] }]] }, { say: { var: '最高' } }]], ['小树队列', flag, [{ say: '记录最高的小树' }]]] },
    's06-l02': { roles: ['玩家', '目标星星'], scripts: [
      ['玩家', flag, [
        { goto: [0, 0] },
        { forever: [
          { if: [{ key: 'right arrow' }, [{ changeX: 10 }]] },
          { wait: .05 },
        ] },
      ]],
      ['目标星星', flag, [{ goto: [160, 0] }]],
    ] },
    's06-l03': { roles: ['规则记录员', '玩家'], variables: { 目标分数: 3 }, scripts: [['规则记录员', flag, [{ set: ['目标分数', 3] }, { say: { var: '目标分数' } }]], ['玩家', flag, [{ say: '收集三颗星过关' }]]] },
    's06-l05': { roles: ['仪表盘', '最高分记录'], variables: { 分数: 0 }, lists: { 最高分: [] }, scripts: [['仪表盘', flag, [{ set: ['分数', 0] }, { showVar: '分数' }, { addList: ['最高分', 3] }, { say: '仪表盘已开启' }]], ['最高分记录', flag, [{ say: '记录你的成绩' }]]] },
    's06-l06': { roles: ['采访员', '试玩记录表'], lists: { 试玩意见: [] }, scripts: [['采访员', flag, [{ ask: '哪里最好玩？' }, { addList: ['试玩意见', { answer: true }] }, { say: '谢谢试玩！' }]], ['试玩记录表', flag, [{ say: '记录一条意见' }]]] },
    's06-l07': { roles: ['升级管理员', '玩家'], variables: { 状态: '待测试' }, scripts: [['升级管理员', flag, [{ set: ['状态', '已修复'] }, { ifElse: [{ eq: [{ var: '状态' }, '已修复'] }, [{ sayFor: ['升级完成', 2] }], [{ sayFor: ['继续修复', 2] }]] }]], ['玩家', flag, [{ say: '请再试玩一次' }]]] },
  }
  return programs[key] ?? null
}

function diagramSvg(title, program) {
  const esc = (value) => String(value).replace(/[<>&"']/g, '')
  const labels = { flag: '点击绿旗', key: '按键', click: '点击角色', receive: '收到消息', goto: '移到', move: '移动', turn: '右转', changeX: '改变横坐标', changeY: '改变纵坐标', say: '说', sayFor: '说话', wait: '等待', set: '设变量', change: '改变变量', show: '显示', hide: '隐藏', broadcast: '广播', clone: '建立克隆体', deleteClone: '删除克隆体', repeat: '重复', repeatUntil: '重复直到', forever: '重复执行', if: '如果', ifElse: '如果否则', play: '播放声音', penClear: '清除画笔', penSize: '设置画笔粗细', penDown: '落笔', penUp: '抬笔', call: '调用自制积木' }
  const rows = program.scripts.map(([role, hat, actions]) => {
    const hatType = Object.keys(hat)[0]
    const hatLabel = hatType === 'clone' ? '作为克隆体启动' : `${labels[hatType] ?? hatType}${typeof Object.values(hat)[0] === 'string' ? `(${Object.values(hat)[0]})` : ''}`
    const actionLabels = actions.map((action) => labels[Object.keys(action)[0]] ?? Object.keys(action)[0])
    const chunks = []
    for (let i = 0; i < actionLabels.length; i += 4) chunks.push(actionLabels.slice(i, i + 4).join(' → '))
    return { title: `${role} · ${hatLabel}`, chunks }
  })
  let y = 56
  const cards = rows.map((row, index) => {
    const height = 42 + 25 * row.chunks.length
    const card = `<rect x="20" y="${y}" width="760" height="${height}" rx="10" fill="${index % 2 ? '#e9f7f4' : '#eef3ff'}"/><text x="34" y="${y + 25}" font-size="16" font-weight="700" font-family="sans-serif" fill="#25324a">${esc(row.title)}</text>${row.chunks.map((line, i) => `<text x="34" y="${y + 50 + i * 25}" font-size="15" font-family="sans-serif" fill="#25324a">${esc(line)}</text>`).join('')}`
    y += height + 8
    return card
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${y + 18}"><rect width="100%" height="100%" rx="18" fill="#fffdf7"/><text x="24" y="38" font-size="22" font-weight="700" font-family="sans-serif" fill="#25324a">${esc(title)} · 脚本路线</text>${cards}</svg>`
}

export async function applySemanticOverrides(output, lessons) {
  for (const lesson of lessons) {
    const program = semanticPrograms(lesson.key)
    if (!program) continue
    const dir = path.join(output, lesson.key)
    for (const kind of ['starter', 'reference']) {
      const file = path.join(dir, `${kind}.sb3`)
      const archive = unzipSync(await readFile(file))
      const project = JSON.parse(strFromU8(archive['project.json']))
      const stage = project.targets[0]
      stage.variables = {}; stage.lists = {}; stage.broadcasts = {}; stage.blocks = {}
      for (const [name, color] of Object.entries(program.backdrops ?? {})) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="${color}"/><text x="24" y="42" font-size="24" fill="#fff" font-family="sans-serif">${name}</text></svg>`
        const hash = digest(svg); archive[`${hash}.svg`] = strToU8(svg)
        stage.costumes.push({ assetId: hash, name, md5ext: `${hash}.svg`, dataFormat: 'svg', rotationCenterX: 240, rotationCenterY: 180 })
      }
      for (const [name, value] of Object.entries(program.variables ?? {})) stage.variables[`v_${digest(`${lesson.key}:${name}`).slice(0, 12)}`] = [name, value]
      for (const [name, values] of Object.entries(program.lists ?? {})) stage.lists[`l_${digest(`${lesson.key}:${name}`).slice(0, 12)}`] = [name, clone(values)]
      if (program.seedList) stage.lists[`l_${digest(`${lesson.key}:高度`).slice(0, 12)}`] = ['高度', clone(program.seedList)]
      project.targets = [stage]
      for (const [i, name] of program.roles.entries()) {
        const svg = roleSvg(name, program.palette?.[name] ?? ['#ffd166', '#73d2de', '#ff9b71', '#a6d98d'][i % 4])
        const hash = digest(svg); archive[`${hash}.svg`] = strToU8(svg)
        const sprite = clone(project.targets[0]); sprite.isStage = false; sprite.name = name; sprite.variables = {}; sprite.lists = {}; sprite.broadcasts = {}; sprite.blocks = {}; sprite.comments = {}
        sprite.costumes = [{ assetId: hash, name, md5ext: `${hash}.svg`, dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 48 }]
        for (const [variantName, variantColor] of Object.entries(program.costumes?.[name] ?? {})) {
          const variant = roleSvg(variantName, variantColor), variantHash = digest(variant)
          archive[`${variantHash}.svg`] = strToU8(variant)
          sprite.costumes.push({ assetId: variantHash, name: variantName, md5ext: `${variantHash}.svg`, dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 48 })
        }
        sprite.sounds = []; sprite.layerOrder = i + 1; sprite.x = i * 90 - 90; sprite.y = 0; sprite.size = 85; sprite.visible = true; sprite.direction = 90; sprite.draggable = false; sprite.rotationStyle = 'all around'
        if (program.sounds?.[name]) {
          const sound = tone(program.sounds[name]), soundHash = digest(sound)
          archive[`${soundHash}.wav`] = sound
          sprite.sounds = [{ assetId: soundHash, name: '鼓点', md5ext: `${soundHash}.wav`, dataFormat: 'wav', format: '', rate: 22050, sampleCount: (sound.length - 44) / 2 }]
        }
        project.targets.push(sprite)
      }
      if (program.pen) project.extensions = ['pen']
      project.meta = { ...(project.meta ?? {}), agent: 'scratch-original-curriculum-v1', lessonKey: lesson.key, assetKind: kind }
      const builders = new Map(project.targets.slice(1).map((target) => [target.name, new ScriptBuilder(project, target, lesson.key)]))
      if (kind === 'reference') {
        for (const [name, hat, actions] of program.scripts) builders.get(name).script(hat, actions)
        for (const [name, proc, actions] of program.procedures ?? []) builders.get(name).procedure(proc, actions)
      } else {
        const first = builders.get(program.roles[0]); first.script({ flag: true }, [])
      }
      archive['project.json'] = strToU8(JSON.stringify(project))
      await writeFile(file, zipSync(archive))
    }
    await writeFile(path.join(dir, 'diagram.svg'), diagramSvg(lesson.title, program))
  }
}
