"use client";

import { ModeratorApplicationsList } from "@/components/admin/moderator-applications-list";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/lib/context/auth-context';

export default function ModeratorApplicationsPage() {
    const { isAdmin, loading } = useAuth();

    if (loading) {
        return <div className="page-shell py-8"><Skeleton className="h-64" /></div>;
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="page-shell pt-6 pb-24 md:py-8">
            <div className="md:hidden">
                <MobilePageHeader title="审核员申请管理" fallbackHref="/admin" />
            </div>

            <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
                <div className="mb-8">
                    <p className="section-kicker">后台管理</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">审核员申请管理</h1>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground md:text-base">
                        管理用户的审核员申请，确保社区内容治理团队的质量与活跃度。
                    </p>
                </div>

                <ModeratorApplicationsList />
            </section>
        </div>
    );
}
