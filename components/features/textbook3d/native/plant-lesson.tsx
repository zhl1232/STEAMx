"use client"

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react"
import { ArrowLeft, ArrowRight, Check, Flower2, Maximize2, Minimize2, Sprout, TreeDeciduous, Volume2, VolumeX, MoreHorizontal } from "lucide-react"

import { TREE_PARTS } from "@/lib/textbook3d/native/tree-parts"
import { createBookAudio } from "@/lib/textbook3d/native/book-audio"
import { PLANTS, type PlantId } from "@/lib/textbook3d/native/plants"
import type { BookPage } from "@/lib/textbook3d/native/book-motion"
import { useTextbookImmersive } from "../use-textbook-immersive"
import frameStyles from "../textbook-frame.module.css"
import styles from "./plant-lesson.module.css"
import { PlantCanvas } from "./plant-canvas"

const plantIcons = { tree: TreeDeciduous, grass: Sprout, flower: Flower2 }
const answers = ["小草", "石头", "小狗"]
const feedback = ["对，小草是植物，它会生长。", "石头不会生长，再找找看。", "小狗是动物，再找找植物。"]

export default function PlantLesson({ title, onComplete, onUseLegacy }: {
  title: string
  onComplete?: () => void
  onUseLegacy: () => void
}) {
  const { box, fullscreenButton, immersive, enterImmersive, exitImmersive } = useTextbookImmersive()
  const [page, setPage] = useState<BookPage>(0)
  const [selected, setSelected] = useState<PlantId>("tree")
  const [explored, setExplored] = useState<PlantId[]>([])
  const [answer, setAnswer] = useState<number | null>(null)
  const [recorded, setRecorded] = useState(false)
  const [showTreeLabels, setShowTreeLabels] = useState(false)
  const [sound, setSound] = useState(false)
  const [soundUnavailable, setSoundUnavailable] = useState(false)
  const audio = useRef<ReturnType<typeof createBookAudio> | null>(null)
  useEffect(() => {
    audio.current = createBookAudio((enabled, unavailable) => { setSound(enabled); setSoundUnavailable(unavailable) })
    return () => { audio.current?.dispose(); audio.current = null }
  }, [])
  const dismissLabels = useCallback(() => setShowTreeLabels(false), [])
  const onVisibleChange = useCallback((visible: boolean) => { if (!visible) { audio.current?.stop(); setShowTreeLabels(false) } }, [])
  const [turning, setTurning] = useState(false)
  const turningNow = useRef(false)
  const completionSent = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const reading = useRef<HTMLElement>(null)
  const focusAfterTurn = useRef(false)
  const plant = PLANTS.find((item) => item.id === selected)!
  const onTurningChange = useCallback((value: boolean) => {
    turningNow.current = value
    setTurning(value)
  }, [])
  useEffect(() => {
    // Focus after React clears aria-busy; loading/fallback has no turn to await.
    if (focusAfterTurn.current && !turningNow.current) {
      focusAfterTurn.current = false
      heading.current?.focus({ preventScroll: true })
    }
  }, [page, turning])

  function turnPage(next: BookPage) {
    if (turningNow.current || page === next) return
    focusAfterTurn.current = true
    if (reading.current) reading.current.scrollTop = 0
    if (body.current) body.current.scrollTop = 0
    setShowTreeLabels(false)
    audio.current?.play("page")
    setPage(next)
  }
  const selectPlant = useCallback((id: PlantId) => {
    if (turningNow.current) return
    setSelected(id)
    setShowTreeLabels((shown) => id === "tree" ? !shown : false)
    if (id === "tree") audio.current?.play("leaves")
    setExplored((seen) => seen.includes(id) ? seen : [...seen, id])
  }, [])
  const edgeTap = useRef<{ x: number; y: number; valid: boolean } | null>(null)
  const touching = useRef(new Set<number>())
  const beginEdgeTap = (event: PointerEvent) => {
    edgeTap.current = { x: event.clientX, y: event.clientY, valid: touching.current.size <= 1 && event.isPrimary !== false && event.button === 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveEdgeTap = (event: PointerEvent) => { const start = edgeTap.current; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.valid = false }
  function recordExploration() {
    if (completionSent.current) return
    completionSent.current = true
    setRecorded(true)
    onComplete?.()
  }

  return (
    <div ref={box} className={`${frameStyles.frame} ${styles.lesson}`} data-immersive={immersive || undefined} data-turning={turning || undefined} aria-label={title}>
      <div className={styles.tools} aria-label="阅读工具">
        <button ref={fullscreenButton} type="button" className={styles.tool} aria-label={immersive ? "退出全屏" : "全屏阅读"} title={immersive ? "退出全屏" : "全屏阅读"} aria-pressed={immersive} onClick={immersive ? exitImmersive : enterImmersive}>
          {immersive ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
        </button>
        <button type="button" className={styles.tool} aria-label={sound ? "关闭声音" : "开启声音"} title={sound ? "关闭声音" : "开启声音"} aria-pressed={sound} onClick={() => sound ? audio.current?.stop() : void audio.current?.enable()}>
          {sound ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
        </button>
        <details className={styles.more}>
          <summary className={styles.tool} aria-label="更多阅读选项" title="更多阅读选项"><MoreHorizontal size={18} aria-hidden /></summary>
          <div><p>点书页两边翻页，拖动转动书本。点大树查看部位，再点收起。</p><button type="button" className={styles.legacyLink} onClick={onUseLegacy}>使用旧版</button></div>
        </details>
      </div>
      {soundUnavailable && <p role="status" className={styles.soundNotice}>声音暂时不可用，可以继续无声阅读。</p>}
      <div ref={body} className={styles.body} data-book-spread
        onPointerDownCapture={(event) => { touching.current.add(event.pointerId); if (touching.current.size > 1 && edgeTap.current) edgeTap.current.valid = false }}
        onPointerUpCapture={(event) => touching.current.delete(event.pointerId)}
        onPointerCancelCapture={(event) => { touching.current.delete(event.pointerId); if (edgeTap.current) edgeTap.current.valid = false }}>
        <section className={styles.sceneColumn} aria-label="观察植物立体书">
          <PlantCanvas plant={selected} page={page} onSelect={selectPlant} onTurningChange={onTurningChange} showTreeLabels={showTreeLabels} onLabelsDismiss={dismissLabels} onVisibleChange={onVisibleChange} />
          <div className={styles.treeCallout} data-tree-callout hidden aria-hidden="true">
            <svg width="100%" height="100%">{TREE_PARTS.map(part => <g key={part.id}><line data-tree-line={part.id} /><circle r="4" data-tree-pin={part.id} /></g>)}</svg>
            {TREE_PARTS.map(part => <span key={part.id} data-tree-bubble={part.id}>{part.name}</span>)}
          </div>
          <span className={styles.srOnly} role="status">{showTreeLabels ? "大树上标出了树根、树干、树叶。再点大树可收起。" : ""}</span>
          <div className={styles.plantSelector} data-book-controls role="group" aria-label="选择观察的植物">
            {PLANTS.map((item) => {
              const Icon = plantIcons[item.id]
              return <button key={item.id} type="button" disabled={turning} aria-pressed={selected === item.id} onClick={() => selectPlant(item.id)}>
                <Icon size={20} aria-hidden /><span>{item.name}</span>
              </button>
            })}
          </div>
        </section>
        <section ref={reading} className={styles.reading} data-book-reading aria-label="课文与探索任务" aria-busy={turning}>
          <h2 ref={heading} tabIndex={-1}>{page === 0 ? "我们知道的植物" : "带着发现去找一找"}</h2>
          {page === 0 && <p className={styles.lead}>大树、小草、花，都是植物。<br />它们都是活的，会生长。</p>}
          <div className={styles.pageContent}>
          <div className={styles.readingIntro}>
            {page === 0 ? <>
            <div className={styles.observation} aria-live="polite">
              <h3>{plant.name}<span>{plant.feature}</span></h3>
              <p>{plant.observation}</p>
            </div>
            </> : <>
              <p className={styles.steps}>转一转、比一比：在哪里见过它们？</p>
              <p className={styles.explored}>观察小记录 · 已选过 {explored.length} 种示例</p>
              <ul className={styles.observations} aria-label="观察小记录">
                {PLANTS.map((item) => <li key={item.id}>{explored.includes(item.id) && <Check size={14} aria-label="已探索" />}{item.name}</li>)}
              </ul>
            </>}
          </div>
          <div className={styles.readingTask}>
            {page === 0 ? <>
              <fieldset className={styles.question}>
                <legend>猜一猜：哪个是植物？</legend>
                <div className={styles.answers}>
                  {answers.map((item, index) => <button key={item} type="button" aria-pressed={answer === index} onClick={() => setAnswer(index)}>{item}</button>)}
                </div>
                <p className={styles.feedback} role="status">{answer === null ? "选一个，说说你的理由。" : feedback[answer]}</p>
              </fieldset>
            </> : <>
              <div className={styles.challenge}>
                <h3>说出 5 种你认识的植物</h3>
                <p>和家人说说，再到校园、公园找找，不采摘。</p>
              </div>
              <button type="button" className={styles.record} onClick={recordExploration} disabled={recorded}>
                {recorded ? <><Check size={18} aria-hidden />本次已探索</> : "记录本次探索"}
              </button>
              <p className={styles.recordNote}>只记录这次探索，不判断你是否已经掌握。</p>
            </>}
          </div>
          </div>
          <p className={styles.folio} data-page-counter aria-live="polite">第 {page + 1} / 2 页</p>
        </section>
      <nav className={styles.pageNav} aria-label="课本翻页">
        {([0, 1] as const).map((target) => <button key={target} type="button" data-book-edge={target === 0 ? "previous" : "next"} className={styles.pageEdge} aria-label={target === 0 ? "上一页" : "下一页"} title={target === 0 ? "上一页" : "下一页"} disabled={page === target || turning}
          onPointerDown={beginEdgeTap} onPointerMove={moveEdgeTap} onPointerUp={moveEdgeTap} onPointerCancel={() => { if (edgeTap.current) edgeTap.current.valid = false }}
          onClick={(event) => { if (event.detail === 0 || edgeTap.current?.valid) turnPage(target) }}>
          {target === 0 ? <ArrowLeft size={18} aria-hidden /> : <ArrowRight size={18} aria-hidden />}
        </button>)}
      </nav>
      </div>
    </div>
  )
}
