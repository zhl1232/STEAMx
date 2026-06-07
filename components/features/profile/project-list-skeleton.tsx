import { Skeleton } from "@/components/ui/skeleton";

export function ProjectListSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="surface-card flex gap-3 p-3">
          <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col justify-between py-1">
            <div>
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="mt-3 h-5 w-3/4 rounded-full" />
              <Skeleton className="mt-2 h-3 w-full rounded-full" />
              <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
            </div>
            <div className="mt-4 flex gap-3">
              <Skeleton className="h-3 w-12 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
