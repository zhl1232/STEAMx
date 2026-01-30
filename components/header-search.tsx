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
        <div className={cn("relative w-full max-w-sm", className)}>
            <Input
                type="search"
                placeholder="搜索项目、创意..."
                className="w-full bg-background pr-9 md:w-[200px] lg:w-[300px] h-9 focus-visible:ring-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            <button
                onClick={handleSearch}
                className="absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                type="button"
            >
                <Search className="h-4 w-4" />
                <span className="sr-only">搜索</span>
            </button>
        </div>
    )
}
