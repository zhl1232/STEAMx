import { Hammer, Shield } from "lucide-react"

export function ObstacleLegend() {
    return <div className="function-wars-obstacle-legend" role="note" aria-label="障碍物标记">
        <span><Hammer className="function-wars-breakable-mark" aria-hidden />可破坏</span>
        <span><Shield className="function-wars-solid-mark" aria-hidden />不可破坏</span>
    </div>
}
