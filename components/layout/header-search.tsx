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
                "relative flex h-10 w-full max-w-md items-center overflow-hidden rounded-[12px] border border-[#d8e2ef] bg-[#f7fbff] shadow-[0_10px_24px_-22px_rgba(27,70,126,0.32),inset_0_1px_0_rgba(255,255,255,0.72)] transition-[border-color,background-color,box-shadow] focus-within:border-[#8db8f0] focus-within:bg-white focus-within:shadow-[0_14px_28px_-22px_rgba(20,120,234,0.42),0_0_0_1px_rgba(141,184,240,0.28)] dark:border-[#2d3746] dark:bg-[#141b25] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] dark:focus-within:border-[#8bbdff]/55 dark:focus-within:bg-[#1a2432] dark:focus-within:shadow-[0_0_0_1px_rgba(139,189,255,0.22),0_18px_32px_-26px_rgba(0,0,0,0.75)] md:w-[200px] lg:w-[240px] xl:w-[320px] 2xl:w-[390px]",
                className
            )}
        >
            <input
                type="search"
                placeholder="搜索项目、文章、用户..."
                className="h-full w-full appearance-none bg-transparent pl-4 pr-11 text-[14px] text-[#25364b] outline-none placeholder:text-[#8a97aa] dark:text-[#e8eef7] dark:placeholder:text-[#7f8da0] [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                suppressHydrationWarning
            />
            <button
                onClick={handleSearch}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-[#6e7e95] transition-colors hover:bg-[#e8f1fd] hover:text-[#1478ea] dark:text-[#93a4bb] dark:hover:bg-white/8 dark:hover:text-[#dcecff]"
                type="button"
            >
                <Search className="h-4 w-4" />
                <span className="sr-only">搜索</span>
            </button>
        </div>
    )
}
