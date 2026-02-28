import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function Loading() {
    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="mb-8">
                <div className="inline-flex items-center text-sm text-muted-foreground mb-4 opacity-50">
                    <ArrowLeft className="mr-2 h-4 w-4" /> 返回探索
                </div>

                <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted relative">
                    <Skeleton className="w-full h-full absolute inset-0 rounded-lg" />
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
                <div className="space-y-12">
                    <div className="space-y-8">
                        <div>
                            <Skeleton className="h-10 w-2/3 mb-4 rounded-md" />
                            <div className="flex items-center justify-between gap-3">
                                <Skeleton className="h-4 w-24 rounded-md" />
                                <Skeleton className="h-5 w-14 rounded-md shrink-0" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Skeleton className="h-6 w-1/4 mb-2 rounded-md" />
                            <Skeleton className="h-4 w-full rounded-md" />
                            <Skeleton className="h-4 w-full rounded-md" />
                            <Skeleton className="h-4 w-5/6 rounded-md" />
                            <Skeleton className="h-4 w-4/6 rounded-md" />
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-6 hidden md:block">
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                        <Skeleton className="h-[150px] w-full rounded-lg" />
                    </div>
                </div>
            </div>
        </div>
    );
}
