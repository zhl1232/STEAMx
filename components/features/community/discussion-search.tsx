"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

interface DiscussionSearchProps {
  onSearch: (query: string, tag: string | null, sortBy: SortOption) => void;
  availableTags?: string[];
}

export type SortOption = "newest" | "hottest" | "most_replies" | "latest_reply";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "最新发布" },
  { value: "hottest", label: "最热门" },
  { value: "most_replies", label: "回复最多" },
  { value: "latest_reply", label: "回复最新" },
];

export function DiscussionSearch({ onSearch, availableTags = [] }: DiscussionSearchProps) {
  const [query, setQuery] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [showTags, setShowTags] = React.useState(false);
  
  // 防抖搜索查询，500ms延迟
  const debouncedQuery = useDebounce(query, 500);

  // 当防抖后的查询变化时，自动触发搜索
  React.useEffect(() => {
    onSearch(debouncedQuery, selectedTag, sortBy);
  }, [debouncedQuery, selectedTag, sortBy, onSearch]);

  const handleTagClick = (tag: string) => {
    const newTag = selectedTag === tag ? null : tag;
    setSelectedTag(newTag);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedTag(null);
    setSortBy("newest");
  };

  const hasFilters = query || selectedTag || sortBy !== "newest";

  return (
    <div className="space-y-3">
      {/* Search bar row */}
      <div className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索讨论..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="pl-9 h-10 rounded-full bg-muted/40 border border-border/60 focus:bg-background focus:border-primary/50 transition-all"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setQuery("");
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shrink-0 md:w-auto md:px-4 md:rounded-md">
              <SlidersHorizontal className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">
                  {sortOptions.find((opt) => opt.value === sortBy)?.label}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                className={sortBy === option.value ? "bg-muted" : ""}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tag Filter - 移动端可折叠，桌面端始终展开 */}
      {availableTags.length > 0 && (
        <div>
          {/* 移动端：点击展开/收起标签 */}
          <button
            type="button"
            onClick={() => setShowTags(!showTags)}
            className="md:hidden flex items-center gap-1 text-sm font-medium text-muted-foreground mb-2 active:opacity-70"
          >
            标签筛选
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTags ? 'rotate-180' : ''}`} />
            {selectedTag && (
              <Badge variant="secondary" className="ml-1 text-xs py-0 h-5">{selectedTag}</Badge>
            )}
          </button>

          {/* 桌面端标题 */}
          <span className="hidden md:block text-sm font-medium text-muted-foreground mb-2">标签筛选</span>

          {/* 标签列表：移动端根据 showTags 控制显示，桌面端始终显示 */}
          <div className={`flex flex-wrap gap-1.5 sm:gap-2 ${showTags ? '' : 'hidden md:flex'}`}>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className={`
                  inline-flex items-center rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all
                  ${selectedTag === tag
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted border border-transparent hover:border-border"
                  }
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasFilters && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-muted-foreground text-xs sm:text-sm">当前筛选：</span>
          {query && (
            <Badge variant="secondary" className="text-xs">
              搜索: {query}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => {
                  setQuery("");
                }}
              />
            </Badge>
          )}
          {selectedTag && (
            <Badge variant="secondary" className="text-xs">
              标签: {selectedTag}
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={() => {
                  setSelectedTag(null);
                }}
              />
            </Badge>
          )}
          {sortBy !== "newest" && (
            <Badge variant="secondary" className="text-xs">
              排序: {sortOptions.find((opt) => opt.value === sortBy)?.label}
            </Badge>
          )}
          <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs">
            清除所有
          </Button>
        </div>
      )}
    </div>
  );
}
