export function LedCardExtension({ className }: { className?: string }) {
  return (
    <details className={className}>
      <summary className="cursor-pointer text-base font-semibold leading-6 text-foreground">拓展探索（选做）</summary>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-foreground/85">
        <li><strong>为什么打开会亮？</strong>慢慢开合，观察铜桥什么时候同时碰到两个触点。</li>
        <li><strong>怎样让接触更稳定？</strong>观察铜桥是否平贴触点，想想滑道太松或太紧会怎样。</li>
      </ol>
    </details>
  )
}
