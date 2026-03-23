"use client";

import { ModeratorApplicationsList } from "@/components/admin/moderator-applications-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";

export default function ModeratorApplicationsPage() {
    const { isAdmin, loading } = useAuth();

    if (loading) {
        return <div className="container mx-auto py-8"><Skeleton className="h-64" /></div>;
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="container mx-auto py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">审核员申请</h1>
                <p className="text-muted-foreground mt-2">
                    审核并管理社区审核员申请
                </p>
            </div>

            <ModeratorApplicationsList />
        </div>
    );
}
