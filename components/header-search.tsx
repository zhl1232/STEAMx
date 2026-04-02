"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

export function HeaderSearch({ className }: { className?: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialQuery = searchParams.get("q") || ""
    const [query, setQuery] = React.useState(initialQuery)

    // Sync with URL
    React.useEffect(() => {
        setQuery(searchParams.get("q") || "")
    }, [searchParams])

    const handleSearch = () => {
        if (!query.trim()) {
            router.push("/explore")
            return
        }

        const params = new URLSearchParams(searchParams.toString())
        params.set("q", query.trim())
        // Reset page when searching
        params.delete("page")

        router.push(`/explore?${params.toString()}`)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch()
        }
    }

    return (
        <div className={cn("relative flex h-10 w-full max-w-md items-center", className)}>
            <Input
                type="search"
                placeholder="搜索项目、创意..."
                className="h-10 w-full rounded-full border-border/70 bg-background/82 pr-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] focus-visible:ring-1 md:w-[220px] lg:w-[320px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button
                onClick={handleSearch}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                type="button"
            >
                <Search className="h-4 w-4" />
                <span className="sr-only">搜索</span>
            </button>
        </div>
    )
}
