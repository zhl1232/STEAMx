"use client"

import { useRef, useState } from 'react'
import { Battery, Lightbulb, CircuitBoard, ToggleLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exampleCircuit, solveCircuit, terminal, type Circuit, type Part } from '@/lib/playground/circuit'

const names = { battery: '电池', lamp: '灯泡', resistor: '电阻', switch: '开关' }
const icons = { battery: Battery, lamp: Lightbulb, resistor: CircuitBoard, switch: ToggleLeft }
const modes = { simple: '闭合回路', series: '串联', parallel: '并联', switch: '开关示例' } as const
const format = (n: number | null, unit: string) => n === null ? '—' : `${Math.abs(n) < 1e-10 ? '0' : Number(n.toPrecision(4))} ${unit}`
const clamp = (n: number, max: number, min = 0) => Math.max(min, Math.min(max, n))

export default function PhysicsLab() {
  const [circuit, setCircuit] = useState<Circuit>(() => exampleCircuit())
  const [selected, setSelected] = useState('battery')
  const [pending, setPending] = useState<string | null>(null)
  const [notice, setNotice] = useState('点击两个端点连接导线。')
  const board = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; y: number; px: number; py: number } | null>(null)
  const counter = useRef(0)
  const solution = solveCircuit(circuit)
  const part = circuit.parts.find(p => p.id === selected)
  function update(id: string, patch: Partial<Part>) { setCircuit(c => ({ ...c, parts: c.parts.map(p => p.id === id ? { ...p, ...patch } : p) })) }
  function load(mode: keyof typeof modes) { setCircuit(exampleCircuit(mode)); setSelected('battery'); setPending(null); setNotice(`已载入${modes[mode]}。`) }
  function connect(endpoint: string) {
    if (!pending) { setPending(endpoint); setNotice('已选端点，再点击另一个端点；Escape 取消。'); return }
    if (pending === endpoint) { setPending(null); setNotice('已取消接线。'); return }
    const exists = circuit.wires.some(w => w.a === pending && w.b === endpoint || w.b === pending && w.a === endpoint)
    setCircuit(c => ({ ...c, wires: exists ? c.wires.filter(w => !(w.a === pending && w.b === endpoint || w.b === pending && w.a === endpoint)) : [...c.wires, { a: pending, b: endpoint }] }))
    setPending(null); setNotice(exists ? '已断开导线。' : '已连接导线。')
  }
  function add(kind: Part['kind']) {
    const id = `part${++counter.current}`
    setCircuit(c => ({ ...c, parts: [...c.parts, { id, kind, value: kind === 'battery' ? 6 : 100, closed: false, x: 8 + (c.parts.length % 3) * 28, y: 35 + (c.parts.length % 2) * 20 }] }))
    setSelected(id)
  }
  function point(endpoint: string) { const [id, side] = endpoint.split(':'); const p = circuit.parts.find(p => p.id === id)!; return { x: p.x + (side === 'a' ? 0 : 30), y: p.y + 10 } }
  const label = (endpoint: string) => { const [id, side] = endpoint.split(':'); const p = circuit.parts.find(p => p.id === id)!; return `${names[p.kind]} ${circuit.parts.indexOf(p) + 1} ${side === 'a' ? 'A' : 'B'}` }
  return <div className="space-y-5 p-3 md:p-6" onKeyDown={e => { if (e.key === 'Escape') { setPending(null); setNotice('已取消接线。') } }}>
    <header className="space-y-2"><p className="text-sm font-semibold text-primary">物理实验室 · 低压直流</p><h1 className="text-2xl font-semibold">让电路亮起来</h1><p className="text-sm text-muted-foreground">从一个灯泡开始，试试串联与并联。改变电压、电阻，观察每条支路。</p></header>
    <div className="flex flex-wrap gap-2" aria-label="电路示例">{Object.entries(modes).map(([key, text]) => <Button key={key} variant="outline" onClick={() => load(key as keyof typeof modes)}>{text}</Button>)}<Button variant="secondary" onClick={() => load('simple')}>重置实验</Button></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3" aria-label="实验台">
        <div className="flex flex-wrap gap-2">{(Object.keys(names) as Part['kind'][]).map(kind => <Button key={kind} variant="outline" disabled={circuit.parts.length >= 24 || kind === 'battery' && circuit.parts.some(p => p.kind === 'battery')} onClick={() => add(kind)}>添加{names[kind]}</Button>)}</div>
        <p className="text-xs text-muted-foreground">拖动名称移动；键盘聚焦名称后用方向键移动。点两端接线，再点同一对端点断开。交叉线不相连。最多 24 个元件、1 节电池。</p>
        <div ref={board} data-testid="circuit-board" className="relative h-[420px] overflow-hidden rounded-lg border bg-muted/30 md:h-[500px]">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{circuit.wires.map((w, i) => { const a = point(w.a), b = point(w.b); const stubA = a.x + (w.a.endsWith(':a') ? -4 : 4), stubB = b.x + (w.b.endsWith(':a') ? -4 : 4); const rail = clamp(i % 2 ? Math.max(a.y, b.y) + 14 : Math.min(a.y, b.y) - 14, 97, 3); return <path key={i} d={`M ${a.x} ${a.y} H ${stubA} V ${rail} H ${stubB} V ${b.y} H ${b.x}`} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /> })}</svg>
          {circuit.parts.map((p, index) => {
            const Icon = icons[p.kind], reading = solution.readings[p.id]
            const brightness = p.kind === 'lamp' && reading.power !== null ? Math.min(1, reading.power / .36) : 0
            return <div key={p.id} className="absolute h-[20%] w-[30%]" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <button type="button" aria-label={`移动${names[p.kind]} ${index + 1}`} aria-pressed={selected === p.id} className={`absolute inset-x-2 top-0 flex h-full touch-none select-none flex-col items-center justify-center rounded-lg border bg-card text-xs focus-visible:outline-2 focus-visible:outline-primary ${selected === p.id ? 'border-primary' : ''}`}
                onClick={() => setSelected(p.id)}
                onPointerDown={e => { setSelected(p.id); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: p.id, x: p.x, y: p.y, px: e.clientX, py: e.clientY } }}
                onPointerMove={e => { const d = drag.current, rect = board.current?.getBoundingClientRect(); if (d?.id === p.id && rect) update(p.id, { x: clamp(d.x + (e.clientX - d.px) / rect.width * 100, 63, 7), y: clamp(d.y + (e.clientY - d.py) / rect.height * 100, 80) }) }}
                onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
                onKeyDown={e => { const delta: Record<string, number[]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }; if (delta[e.key]) { e.preventDefault(); update(p.id, { x: clamp(p.x + delta[e.key][0], 63, 7), y: clamp(p.y + delta[e.key][1], 80) }) } }}>
                <Icon size={25} className={brightness ? 'text-amber-500' : 'text-muted-foreground'} style={brightness ? { filter: `drop-shadow(0 0 ${brightness * 9}px currentColor)` } : undefined} />
                <span>{names[p.kind]} {index + 1}</span><span>{p.kind === 'switch' ? p.closed ? '闭合' : '断开' : `${p.value} ${p.kind === 'battery' ? 'V' : 'Ω'}`}</span>
                {p.kind === 'lamp' && <span>亮度 {Math.round(brightness * 100)}%</span>}
              </button>
              {(['a', 'b'] as const).map(side => <button key={side} type="button" aria-label={`${label(terminal(p.id, side))}端点`} aria-pressed={pending === terminal(p.id, side)} onClick={() => connect(terminal(p.id, side))} className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary ${side === 'a' ? '-left-5' : '-right-5'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary text-xs ${pending === terminal(p.id, side) ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>{p.kind === 'battery' ? side === 'a' ? '+' : '−' : side.toUpperCase()}</span></button>)}
            </div>
          })}
        </div>
        <p role="status" className="text-sm text-primary">{notice}</p>
      </section>
      <aside className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">实时观察</h2>
        <p data-testid="circuit-status" className="font-semibold">{{ empty: '请添加电池', open: '断路 · 无电源电流', closed: '闭合 · 电流流动', short: '短路 · 理想电源无有限解', invalid: '参数或连接无效' }[solution.status]}</p>
        <p>电源电流：<output data-testid="source-current">{format(solution.current, 'A')}</output></p>
        {solution.status === 'short' && <p className="text-sm text-destructive">电池两极被直接连通。断开短接导线后再观察，当前不显示测量值。</p>}
        {part && <div className="space-y-3 border-t pt-3"><h3 className="font-semibold">选中：{names[part.kind]} {circuit.parts.indexOf(part) + 1}</h3>
          {part.kind === 'switch' ? <Button onClick={() => update(part.id, { closed: !part.closed })}>{part.closed ? '断开开关' : '闭合开关'}</Button> : <label className="block text-sm">{part.kind === 'battery' ? '电压 (V)' : '电阻 (Ω)'}：{part.value}<input aria-label={part.kind === 'battery' ? '电压' : '电阻'} className="mt-2 block w-full accent-primary" type="range" min="1" max={part.kind === 'battery' ? 12 : 1000} step={part.kind === 'battery' ? .5 : 1} value={part.value} onChange={e => update(part.id, { value: Number(e.target.value) })} /></label>}
          <p className="text-sm">电压 A → B：{format(solution.readings[part.id].voltage, 'V')}<br />{part.kind === 'battery' ? '输出电流' : '电流 A → B'}：{format(solution.readings[part.id].current, 'A')}</p>
          <Button variant="outline" onClick={() => { setCircuit(c => ({ parts: c.parts.filter(p => p.id !== part.id), wires: c.wires.filter(w => ![w.a.split(':')[0], w.b.split(':')[0]].includes(part.id)) })); setSelected(''); setPending(null) }}>删除选中元件</Button>
        </div>}
        <details><summary className="cursor-pointer text-sm font-semibold">导线（{circuit.wires.length}）</summary><ul className="mt-2 space-y-2">{circuit.wires.map((w, i) => <li key={`${w.a}-${w.b}`} className="text-xs">{label(w.a)} ↔ {label(w.b)} <Button size="sm" variant="ghost" aria-label={`断开导线 ${i + 1}`} onClick={() => setCircuit(c => ({ ...c, wires: c.wires.filter((_, j) => i !== j) }))}>断开</Button></li>)}</ul></details>
      </aside>
    </div>
    <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground"><h2 className="mb-2 font-semibold text-foreground">这个模型怎样工作？</h2><p>按节点电压与欧姆定律计算。电池、导线、开关均为理想元件；灯泡视作恒定电阻，亮度按功率相对 0.36 W 显示，最高 100%。不模拟发热、烧毁、内阻或瞬态。浮空电位和无法确定的理想开关电流显示「—」。仅供低压直流概念实验。</p></section>
  </div>
}
