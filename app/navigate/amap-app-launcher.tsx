"use client"

import { Check, Clipboard, ExternalLink } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AmapAppLauncherProps {
  latitude: number
  longitude: number
  name: string
}

function getAmapScheme(latitude: number, longitude: number, name: string) {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const encodedName = encodeURIComponent(name || "观察地点")
  const params = `sourceApplication=steamx&poiname=${encodedName}&lat=${latitude}&lon=${longitude}&dev=0`

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return `iosamap://viewMap?${params}`
  }

  return `androidamap://viewMap?${params}`
}

export function AmapAppLauncher({ latitude, longitude, name }: AmapAppLauncherProps) {
  const [copied, setCopied] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const coordinateText = useMemo(() => `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, [latitude, longitude])

  const handleOpenApp = () => {
    setAttempted(true)
    window.location.href = getAmapScheme(latitude, longitude, name)
  }

  const handleCopy = async () => {
    try {
      await window.navigator.clipboard.writeText(`${name}\n${coordinateText}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        tone="brand"
        size="lg"
        className="h-12 w-full gap-2 px-5 text-base sm:w-auto"
        onClick={handleOpenApp}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        打开高德 App
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full gap-2 px-5 text-base sm:w-auto"
        onClick={() => void handleCopy()}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Clipboard className="h-4 w-4" aria-hidden />}
        {copied ? "已复制坐标" : "复制坐标"}
      </Button>
      <p
        className={cn(
          "text-xs leading-5 text-muted-foreground",
          attempted ? "opacity-100" : "opacity-0 sm:opacity-100",
        )}
      >
        如果没有自动跳转，可能是当前设备未安装高德地图；可复制坐标后手动搜索。
      </p>
    </div>
  )
}
