export default function DesignSystemContent() {
  return (
    <section className="w-full bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-[2rem] border border-border/50 bg-background/95 p-6 shadow-sm sm:p-8">
        <div className="max-w-2xl space-y-3">
          <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            只读设计系统展示
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Design System v1.2 Demo</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              该页面仅用于展示视觉样式与组件组合，不包含写操作，也不要求登录。
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="dark">
            <div className="group relative w-full overflow-hidden rounded-xl bg-card text-card-foreground transition-all duration-500 hover:-translate-y-1">
              <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-b from-border to-transparent opacity-50 transition-all duration-500 group-hover:from-primary/50 group-hover:to-accent/20 group-hover:opacity-100 group-hover:blur-[1px]" />

              <div className="relative h-full w-full rounded-xl border border-white/5 bg-card p-5 shadow-xl sm:p-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary shadow-[0_0_10px_-3px_hsl(var(--primary))]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8" /><path d="m4.93 10.93 1.41 1.41" /><path d="M2 18h2" /><path d="M20 18h2" /><path d="m19.07 10.93-1.41 1.41" /><path d="M22 22H2" /><path d="m16 6-4 4-4-4" /><path d="M16 18a4 4 0 0 0-8 0" /></svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-wide">量子核心 V2</h2>
                      <p className="text-xs text-muted-foreground">节点 ID: #8X-29A</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_1px_hsl(var(--accent))]" />
                    </span>
                    <span className="text-xs font-medium text-accent">Online</span>
                  </div>
                </div>

                <div className="mb-6 space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">算力负载</span>
                      <span className="font-mono text-primary">78%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-background/50">
                      <div className="h-full w-[78%] bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_0px_hsl(var(--primary))]" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled
                    className="h-9 rounded-md border border-input bg-transparent px-4 text-sm font-medium text-muted-foreground opacity-100"
                  >
                    查看日志
                  </button>

                  <button
                    type="button"
                    disabled
                    className="group/btn relative h-9 overflow-hidden rounded-md bg-primary text-sm font-bold text-primary-foreground opacity-100 shadow-[0_0_20px_-8px_hsl(var(--primary))]"
                  >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover/btn:translate-x-full" />
                    <span className="relative">重启节点</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full rounded-xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex flex-col space-y-1.5 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold tracking-tight">系统负载监控</h2>
                <span className="inline-flex w-fit items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent shadow-[0_0_10px_-3px_hsl(var(--accent))]">
                  运行中
                </span>
              </div>
              <p className="text-sm text-muted-foreground">实时监控服务器节点状态与吞吐量</p>
            </div>

            <div className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
              <div className="flex items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/20 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></svg>
                </div>
                <div className="ml-4 min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-none">CPU 核心利用率</p>
                  <p className="text-xs text-muted-foreground">4 核心 / 3.2 GHz</p>
                </div>
                <div className="ml-auto shrink-0 font-medium text-primary">+24.5%</div>
              </div>

              <div className="flex items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/20 text-accent">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <div className="ml-4 min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-none">网络吞吐量</p>
                  <p className="text-xs text-muted-foreground">入站流量监控</p>
                </div>
                <div className="ml-auto shrink-0 font-medium text-accent">1.2 GB/s</div>
              </div>
            </div>

            <div className="p-5 pt-0 sm:p-6 sm:pt-0">
              <button
                type="button"
                disabled
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-100 shadow-[0_0_20px_-5px_hsl(var(--primary))]"
              >
                查看完整报告
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
