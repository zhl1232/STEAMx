import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { Skeleton } from "@/components/ui/skeleton";

const USER_ITEM_LINE_WIDTHS = [
  { name: "w-28", body1: "w-full", body2: "w-2/3" },
  { name: "w-24", body1: "w-11/12", body2: "w-3/5" },
  { name: "w-32", body1: "w-full", body2: "w-1/2" },
  { name: "w-20", body1: "w-10/12", body2: "w-2/3" },
] as const;

function getTitleWidth(title: string) {
  if (title === "粉丝") return "w-14";
  if (title === "关注") return "w-14";
  return "w-16";
}

function UserListItemSkeleton({ index }: { index: number }) {
  const widths = USER_ITEM_LINE_WIDTHS[index % USER_ITEM_LINE_WIDTHS.length];

  return (
    <div className="surface-panel block rounded-(--radius-lg) px-4 py-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className={`h-6 rounded-full ${widths.name}`} />
          </div>
          <Skeleton className={`mt-3 h-4 rounded-full ${widths.body1}`} />
          <Skeleton className={`mt-2 h-4 rounded-full ${widths.body2}`} />
        </div>

        <div className="shrink-0">
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function MobileUserListSkeleton({ title }: { title: string }) {
  return (
    <div className="app-shell-wide pb-24 pt-6 md:hidden">
      <MobilePageHeader title={title} fallbackHref="/profile" />

      <div className="space-y-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <UserListItemSkeleton key={`${title}-${index}`} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DesktopUserListSkeleton({ title }: { title: string }) {
  return (
    <div className="hidden md:block">
      <div className="app-shell-wide pb-24 pt-6 md:py-8">
        <div className="space-y-6">
          <section className="hidden overflow-hidden md:block">
            <div className="surface-panel flex items-center gap-3 px-6 py-5">
              <Skeleton className="h-10 w-10 rounded-sm" />
              <div>
                <Skeleton className={`h-7 rounded-full ${getTitleWidth(title)}`} />
                <Skeleton className="mt-2 h-4 w-12 rounded-full" />
              </div>
            </div>
          </section>

          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <UserListItemSkeleton key={`${title}-desktop-${index}`} index={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileUserListSkeleton({ title }: { title: string }) {
  return (
    <>
      <MobileUserListSkeleton title={title} />
      <DesktopUserListSkeleton title={title} />
    </>
  );
}
