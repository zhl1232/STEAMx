export function ProjectListSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-panel overflow-hidden rounded-[24px] p-3">
          <div className="flex gap-3">
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-[18px] bg-muted" />
            <div className="flex flex-1 flex-col justify-between py-1">
              <div>
                <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
                <div className="mt-3 h-5 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="mt-2 h-3 w-full animate-pulse rounded-full bg-muted" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mt-4 flex gap-3">
                <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
