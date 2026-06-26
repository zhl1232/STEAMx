import { useCallback, useEffect, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export type MathQuestion = {
    text: string
    answer: number
    level: number
}

export type QuickMathStats = {
    totalGames: number
    bestScore: number
    bestStreak: number
}

const STATS_KEY = "quick_math_stats"
const ROUND_SECONDS = 60
const EMPTY_STATS: QuickMathStats = {
    totalGames: 0,
    bestScore: 0,
    bestStreak: 0,
}

function loadStats(): QuickMathStats {
    const raw = getPlaygroundItem<Partial<QuickMathStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        bestScore: typeof raw.bestScore === "number" ? raw.bestScore : 0,
        bestStreak: typeof raw.bestStreak === "number" ? raw.bestStreak : 0,
    }
}

function saveStats(stats: QuickMathStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateQuestion(streak: number): MathQuestion {
    const level = Math.min(5, Math.floor(streak / 5) + 1)
    const max = 10 + level * 10
    const op = level < 3 ? ["+", "-"][randomInt(0, 1)] : ["+", "-", "×"][randomInt(0, 2)]
    const a = randomInt(2, max)
    const b = randomInt(2, op === "×" ? Math.min(12, level + 5) : max)

    if (op === "+") return { text: `${a} + ${b}`, answer: a + b, level }
    if (op === "×") return { text: `${a} × ${b}`, answer: a * b, level }
    const left = Math.max(a, b)
    const right = Math.min(a, b)
    return { text: `${left} - ${right}`, answer: left - right, level }
}

export function useQuickMath() {
    const [question, setQuestion] = useState<MathQuestion>(() => generateQuestion(0))
    const [input, setInput] = useState("")
    const [score, setScore] = useState(0)
    const [streak, setStreak] = useState(0)
    const [bestRoundStreak, setBestRoundStreak] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS)
    const [status, setStatus] = useState<"idle" | "playing" | "finished">("idle")
    const [stats, setStats] = useState<QuickMathStats>(() => ({ ...EMPTY_STATS }))

    useEffect(() => {
        setStats(loadStats())
    }, [])

    const finishRound = useCallback(() => {
        setStatus("finished")
        setStats((prev) => {
            const updated = {
                totalGames: prev.totalGames + 1,
                bestScore: Math.max(prev.bestScore, score),
                bestStreak: Math.max(prev.bestStreak, bestRoundStreak),
            }
            saveStats(updated)
            return updated
        })
    }, [bestRoundStreak, score])

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => {
            setSecondsLeft((current) => Math.max(0, current - 1))
        }, 1000)
        return () => clearInterval(id)
    }, [status])

    useEffect(() => {
        if (status === "playing" && secondsLeft <= 0) {
            finishRound()
        }
    }, [finishRound, secondsLeft, status])

    const start = useCallback(() => {
        setQuestion(generateQuestion(0))
        setInput("")
        setScore(0)
        setStreak(0)
        setBestRoundStreak(0)
        setSecondsLeft(ROUND_SECONDS)
        setStatus("playing")
    }, [])

    const submit = useCallback(() => {
        if (status !== "playing" || input.trim() === "") return
        const value = Number(input)
        if (value === question.answer) {
            const nextStreak = streak + 1
            const gained = 10 + question.level * 2 + Math.min(20, nextStreak)
            setScore((current) => current + gained)
            setStreak(nextStreak)
            setBestRoundStreak((current) => Math.max(current, nextStreak))
            setQuestion(generateQuestion(nextStreak))
        } else {
            setStreak(0)
            setQuestion(generateQuestion(0))
        }
        setInput("")
    }, [input, question, status, streak])

    const appendInput = useCallback((value: string) => {
        if (status !== "playing") return
        setInput((current) => `${current}${value}`)
    }, [status])

    const backspace = useCallback(() => {
        setInput((current) => current.slice(0, -1))
    }, [])

    return {
        question,
        input,
        score,
        streak,
        bestRoundStreak,
        secondsLeft,
        status,
        stats,
        start,
        submit,
        setInput,
        appendInput,
        backspace,
    }
}
