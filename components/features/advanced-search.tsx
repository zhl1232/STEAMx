"use client"

import * as React from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface AdvancedSearchProps {
  onSearch: (query: string, filters: any) => void
}

export function AdvancedSearch({ onSearch }: AdvancedSearchProps) {
  const [query, setQuery] = React.useState("")
  const [difficulty, setDifficulty] = React.useState("all")

  const handleSearch = () => {
    onSearch(query, { difficulty })
  }

  const clearFilters = () => {
    setDifficulty("all")
    onSearch(query, { difficulty: "all" })
  }

  return (
    <div className="flex w-full items-center space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索项目、材料或作者..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // Debounce could be added here
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="pl-8"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setQuery("")
              onSearch("", { difficulty })
            }}
            className="absolute right-2 top-2 h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button onClick={handleSearch}>搜索</Button>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>高级筛选</SheetTitle>
            <SheetDescription>
              使用更多条件来精确查找你感兴趣的项目。
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-6 py-6">
            <div className="space-y-2">
              <Label>难度等级</Label>
              <RadioGroup value={difficulty} onValueChange={setDifficulty}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">全部</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1-2" id="easy" />
                  <Label htmlFor="easy">⭐⭐ 入门/简单 (1-2星)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3-4" id="medium" />
                  <Label htmlFor="medium">⭐⭐⭐ 中等/进阶 (3-4星)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="5-6" id="hard" />
                  <Label htmlFor="hard">⭐⭐⭐⭐⭐ 挑战/传说 (5-6星)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={clearFilters}>重置</Button>
            <SheetClose asChild>
              <Button onClick={handleSearch}>应用筛选</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
