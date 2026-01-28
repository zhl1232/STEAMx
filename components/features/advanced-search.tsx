"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AdvancedSearchProps {
  onSearch: (query: string) => void
  defaultValue?: string
}

export function AdvancedSearch({ onSearch, defaultValue = "" }: AdvancedSearchProps) {
  const [query, setQuery] = React.useState(defaultValue)

  const handleSearch = () => {
    onSearch(query)
  }

  return (
    <div className="flex w-full items-center space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索项目、材料或作者..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="pl-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setQuery("")
              onSearch("")
            }}
            className="absolute right-2 top-2 h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button onClick={handleSearch}>搜索</Button>
    </div>
  )
}
