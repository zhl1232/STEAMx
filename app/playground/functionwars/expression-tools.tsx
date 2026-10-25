"use client"

import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { Delete, Sigma } from "lucide-react"
import { cn } from "@/lib/utils"

const BASIC_KEYS = ["x", "+", "−", "×", "÷", "^", "(", ")"]
const MORE_KEYS = ["sin(", "cos(", "tan(", "abs(", "sqrt(", "log(", "exp(", "pi"]

export function MathKeyboard({ setExpression, disabled, requiredTokens = new Set<string>() }: {
    setExpression: Dispatch<SetStateAction<string>>
    disabled: boolean
    requiredTokens?: ReadonlySet<string>
}) {
    const [more, setMore] = useState(false)
    const keys = [...BASIC_KEYS, ...MORE_KEYS.filter((token) => more || requiredTokens.has(token))]
    return <details className="mt-2 rounded-sm border border-border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-xs font-semibold"><Sigma className="h-4 w-4" aria-hidden />数学键盘</summary>
        <div className="grid grid-cols-4 gap-1 p-2 pt-0" aria-label="数学快捷键盘">
            {keys.map((token) => <button key={token} type="button" disabled={disabled}
                onClick={() => setExpression((current) => current === "0" && !["+", "−", "×", "÷", "^", ")"].includes(token) ? token : `${current}${token}`)}
                className={cn("min-h-11 rounded-xs border border-border font-mono text-sm disabled:opacity-50", requiredTokens.has(token) && "border-amber-500 bg-amber-500/14")}>{token}</button>)}
            <button type="button" disabled={disabled} onClick={() => setExpression((current) => current.slice(0, -1))} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1 rounded-xs border border-border text-xs"><Delete className="h-4 w-4" aria-hidden />删除</button>
            <button type="button" disabled={disabled} onClick={() => setExpression("")} className="col-span-2 min-h-11 rounded-xs border border-border text-xs">清空</button>
            <button type="button" onClick={() => setMore((value) => !value)} aria-expanded={more} className="col-span-4 min-h-11 text-xs font-semibold text-primary">{more ? "收起更多函数" : "更多函数"}</button>
        </div>
    </details>
}

type Family = "line" | "parabola" | "wave"
const FAMILY_LABELS: Record<Family, string> = { line: "斜线", parabola: "抛物线", wave: "波浪" }
function template(family: Family, a: number, b: number) {
    if (family === "line") return `${a}*x`
    if (family === "parabola") return `${a}*x*(${b}-x)`
    return `${a}*sin(${b}*x)`
}

export function ParameterTools({ expression, onChange, disabled, immersive = false, onTemplateSelect }: {
    expression: string
    onChange: (value: string) => void
    disabled: boolean
    immersive?: boolean
    onTemplateSelect?: () => void
}) {
    const chooserRef = useRef<HTMLDetailsElement>(null)
    const [family, setFamily] = useState<Family>("line")
    const [a, setA] = useState(0.25)
    const [b, setB] = useState(16)
    const [lastTemplate, setLastTemplate] = useState<string | null>(null)
    const guided = lastTemplate !== null && expression === lastTemplate
    function apply(nextFamily: Family, nextA: number, nextB: number) {
        setFamily(nextFamily); setA(nextA); setB(nextB)
        const value = template(nextFamily, nextA, nextB)
        setLastTemplate(value); onChange(value)
    }
    const sliderA = <label className="block text-xs font-semibold">{family === "line" ? "斜率 a：每前进 1 格的高度变化" : family === "wave" ? "振幅 a：波浪的高度" : "弯曲程度 a"} <output>{a}</output>
        <input aria-label={family === "line" ? "斜率 a" : family === "wave" ? "振幅 a" : "弯曲程度 a"} type="range" min={family === "wave" ? 0.2 : -0.5} max={family === "wave" ? 4 : 0.5} step={family === "wave" ? 0.1 : 0.01} value={a} disabled={disabled} onChange={(event) => apply(family, Number(event.target.value), b)} className="block h-11 w-full accent-primary" />
    </label>
    const sliderB = family !== "line" ? <label className="block text-xs font-semibold">{family === "wave" ? "频率 b：越大越密" : "落回炮口高度的位置 b"} <output>{b}</output>
        <input aria-label={family === "wave" ? "频率 b" : "返回位置 b"} type="range" min={family === "wave" ? 0.1 : 4} max={family === "wave" ? 2 : 22} step={family === "wave" ? 0.1 : 1} value={b} disabled={disabled} onChange={(event) => apply(family, a, Number(event.target.value))} className="block h-11 w-full accent-primary" />
    </label> : null
    return <div className="function-wars-parameters" data-guided={guided}>
        <details ref={chooserRef} onToggle={(event) => { if (immersive && event.currentTarget.open) onTemplateSelect?.() }} className="function-wars-template-chooser mt-2 rounded-sm border border-border bg-background" onKeyDown={(event) => {
            if (event.key === "Escape" && chooserRef.current?.open) {
                event.preventDefault(); event.stopPropagation()
                chooserRef.current.open = false
                chooserRef.current.querySelector("summary")?.focus()
            }
        }}>
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold">{immersive ? "模板" : "调参数试一试"}</summary>
            <div className="space-y-3 px-3 pb-3">
                <p className="text-xs leading-5 text-muted-foreground">选模板后拖动参数看虚线；也可以直接修改函数。</p>
                <div className="flex gap-1" role="group" aria-label="函数模板">
                    {(Object.keys(FAMILY_LABELS) as Family[]).map((name) => <button key={name} type="button" disabled={disabled} aria-pressed={guided && family === name} onClick={() => {
                        apply(name, name === "wave" ? 2 : name === "parabola" ? 0.08 : 0.25, name === "wave" ? 0.5 : 16)
                        onTemplateSelect?.()
                        if (immersive && chooserRef.current) {
                            chooserRef.current.open = false
                            chooserRef.current.querySelector("summary")?.focus()
                        }
                    }} className={cn("min-h-11 flex-1 rounded-xs border border-border px-2 text-xs font-semibold", guided && family === name && "bg-primary text-primary-foreground")}>{FAMILY_LABELS[name]}</button>)}
                </div>
                {!immersive && guided ? <>{sliderA}{sliderB}<button type="button" disabled={disabled} onClick={() => setLastTemplate(null)} className="min-h-11 text-xs font-semibold text-primary">切换到自由输入</button></> : !guided ? <p className="text-xs text-muted-foreground">当前为自由输入；选择模板会替换表达式。</p> : null}
            </div>
        </details>
        {immersive && guided ? <div className="function-wars-parameter-row" aria-label="战场参数调节">{sliderA}{sliderB}<button type="button" disabled={disabled} onClick={() => { setLastTemplate(null); chooserRef.current?.querySelector("summary")?.focus() }} className="min-h-11 shrink-0 px-2 text-xs font-semibold" aria-label="关闭调参，保留函数">收起</button></div> : null}
    </div>
}
