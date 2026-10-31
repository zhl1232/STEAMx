"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Flower2, Maximize2, Minimize2, Sprout, TreeDeciduous } from "lucide-react"

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
    setPage(next)
  }
  const selectPlant = useCallback((id: PlantId) => {
    if (turningNow.current) return
    setSelected(id)
    setExplored((seen) => seen.includes(id) ? seen : [...seen, id])
  }, [])
  function recordExploration() {
    if (completionSent.current) return
    completionSent.current = true
    setRecorded(true)
    onComplete?.()
  }

  return (
    <div ref={box} className={`${frameStyles.frame} ${styles.lesson}`} data-immersive={immersive || undefined} data-turning={turning || undefined} aria-label={title}>
      <div className={frameStyles.toolbar}>
        <span className={styles.pageLabel} aria-live="polite">第 {page + 1} / 2 页 <span>· {page === 0 ? "认识植物" : "动手找一找"}</span></span>
        <button ref={fullscreenButton} type="button" className={frameStyles.fullscreenButton} aria-pressed={immersive} onClick={immersive ? exitImmersive : enterImmersive}>
          {immersive ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}{immersive ? "退出全屏" : "全屏阅读"}
        </button>
      </div>
      <div ref={body} className={styles.body} data-book-spread>
        <section className={styles.sceneColumn} aria-label="观察植物立体书">
          <PlantCanvas plant={selected} page={page} onSelect={selectPlant} onTurningChange={onTurningChange} />
          <p className={styles.gesture}>点选书上的植物 · 拖动转动书本 · 双指放大</p>
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
          <div className={styles.readingIntro}>
            <p className={styles.kicker}>{page === 0 ? "看一看 · 认识身边的植物" : "做一做 · 把发现带到生活里"}</p>
            <h2 ref={heading} tabIndex={-1}>{page === 0 ? "我们知道的植物" : "带着发现去找一找"}</h2>
            <p className={styles.lead}>{page === 0 ? <>大树、小草、花，都是植物。<br />它们都是活的，会生长。</> : "看过立体书，再看看身边真实的植物。"}</p>
            <div className={styles.observation} aria-live="polite">
              <h3>{plant.name}<span>{plant.feature}</span></h3>
              <p>{plant.observation}</p>
              <p className={styles.place}>在哪里见过？{plant.place}。</p>
            </div>
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
              <ol className={styles.steps}>
                <li>分别选大树、小草、花，转一转看。</li>
                <li>说说它们的样子，哪里一样、哪里不一样？</li>
                <li>想一想：你在哪里见过它们？</li>
              </ol>
              <table className={styles.observations}>
                <caption>观察小记录 · 已选过 {explored.length} 种示例</caption>
                <thead><tr><th scope="col">植物</th><th scope="col">样子</th></tr></thead>
                <tbody>{PLANTS.map((item) => <tr key={item.id}><th scope="row">{explored.includes(item.id) && <Check size={14} aria-label="已探索" />}{item.name}</th><td>{item.feature}</td></tr>)}</tbody>
              </table>
              <div className={styles.challenge}>
                <h3>说出 5 种你认识的植物</h3>
                <p>和家人说一说；也可以在校园、公园里找一找，不采摘。</p>
              </div>
              <button type="button" className={styles.record} onClick={recordExploration} disabled={recorded}>
                {recorded ? <><Check size={18} aria-hidden />本次已探索</> : "记录本次探索"}
              </button>
              <p className={styles.recordNote}>只记录这次探索，不判断你是否已经掌握。</p>
            </>}
          </div>
          <span className={styles.folio} aria-hidden="true">{page + 1}</span>
        </section>
      </div>
      <nav className={styles.pageNav} aria-label="课本翻页">
        <button type="button" className={styles.secondary} disabled={page === 0 || turning} onClick={() => turnPage(0)}><ArrowLeft size={18} aria-hidden />上一页</button>
        <button type="button" className={styles.legacyLink} onClick={onUseLegacy}>使用旧版</button>
        <button type="button" className={styles.primary} disabled={page === 1 || turning} onClick={() => turnPage(1)}>下一页<ArrowRight size={18} aria-hidden /></button>
      </nav>
    </div>
  )
}
