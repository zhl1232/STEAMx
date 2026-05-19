"use client"

import * as React from "react"
import { Search } from "lucide-react"
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
        <div
            className={cn(
                "nav-search-shell md:w-[200px] lg:w-[240px] xl:w-[320px] 2xl:w-[390px]",
                className
            )}
        >
            <input
                type="search"
                placeholder="搜索项目、文章、用户..."
                className="nav-search-input [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                suppressHydrationWarning
            />
            <button
                onClick={handleSearch}
                className="nav-search-submit"
                type="button"
            >
                <Search className="h-4 w-4" />
                <span className="sr-only">搜索</span>
            </button>
        </div>
    )
}
