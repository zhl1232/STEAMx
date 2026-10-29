#!/usr/bin/env node
/** Read approved lesson diagrams and render local catalog SVGs; never writes to the database. */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { loadEnvConfig } = createRequire(require.resolve('next/package.json'))('@next/env')
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: courses, error: courseError } = await db.from('courses').select('id').eq('status', 'approved').eq('is_listed', true).eq('title', '五子棋博弈论入门')
if (courseError || courses?.length !== 1) throw new Error('Expected one approved listed gomoku course')
const { data: lessons, error } = await db.from('course_lessons').select('title, steps').eq('course_id', courses[0].id).order('sort_order').order('id')
if (error || !lessons?.length) throw new Error('Could not read gomoku lessons')
const out = 'public/assets/course-previews/gomoku'
await mkdir(out, { recursive: true })
const esc = value => String(value).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
const xy = p => ({ x: 24 + p.c * 22, y: 24 + p.r * 22 })
const colors = { blue: '#1776dc', amber: '#c28324', success: '#29845a', danger: '#d35454', neutral: '#64748b' }
const manifest = {}
for (const [index, lesson] of lessons.entries()) {
  const board = (lesson.steps ?? []).flatMap(step => step.visuals ?? []).find(v => v.type === 'gomoku_board' && ((v.blackStones?.length ?? 0) + (v.whiteStones?.length ?? 0)) > 0)
  if (!board) throw new Error(`Missing genuine board: ${lesson.title}`)
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="356" height="356" viewBox="0 0 356 356"><title>${esc(lesson.title)}</title><desc>${esc(board.caption ?? '')}</desc><rect width="356" height="356" rx="16" fill="#f5e6c8"/>`]
  for(let i=0;i<15;i++) { const p=24+i*22; svg.push(`<path d="M24 ${p}H332M${p} 24V332" stroke="#baa582" stroke-width=".8"/>`) }
  for(const [r,c] of [[3,3],[3,11],[7,7],[11,3],[11,11]]) svg.push(`<circle cx="${24+c*22}" cy="${24+r*22}" r="2.4" fill="#947d59"/>`)
  for(const line of board.lines ?? []) { const a=xy(line.from),b=xy(line.to);svg.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${colors[line.tone]??colors.amber}" stroke-width="3" ${line.dashed?'stroke-dasharray="5 4"':''}/>`)}
  for(const [stones,fill,stroke,text] of [[board.blackStones,'#253142','#172333','#fff'],[board.whiteStones,'#fffdf7','#9c978d','#263342']]) for(const stone of stones??[]) {const p=xy(stone);svg.push(`<circle cx="${p.x}" cy="${p.y}" r="9.4" fill="${fill}" stroke="${stroke}"/>`);if(stone.label)svg.push(`<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${text}">${esc(stone.label)}</text>`)}
  for(const mark of board.marks??[]) {const p=xy(mark),color=colors[mark.tone]??colors.blue;svg.push(`<circle cx="${p.x}" cy="${p.y}" r="8" fill="#fff" fill-opacity=".8" stroke="${color}" stroke-width="2"/>`);if(mark.label)svg.push(`<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${color}">${esc(mark.label)}</text>`)}
  if(board.winLine){const a=xy(board.winLine.from),b=xy(board.winLine.to);svg.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#319563" stroke-width="4" stroke-linecap="round"/>`)}
  svg.push('</svg>')
  const file=`lesson-${String(index+1).padStart(2,'0')}.svg`
  await writeFile(`${out}/${file}`,svg.join('\n'))
  manifest[lesson.title]=`/assets/course-previews/gomoku/${file}`
}
await writeFile('lib/courses/gomoku-previews.json',JSON.stringify(manifest,null,2)+'\n')
console.log(`Rendered ${lessons.length} genuine lesson diagrams`)
