"use client";

import { ModeratorApplicationForm } from "@/components/features/moderator/application-form";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function ModeratorApplicationPage() {
    return (
        <div className="page-shell pt-6 pb-24 md:py-8">
            <div className="md:hidden">
                <MobilePageHeader title="申请成为审核员" fallbackHref="/profile" />
            </div>

            <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
                <div className="mb-8">
                    <p className="section-kicker">社区治理</p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight">申请成为审核员</h1>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
                        在满足基础条件后，申请加入审核队伍，帮助维护平台内容质量与社区秩序。
                    </p>
                </div>

                <ModeratorApplicationForm />
            </section>
        </div>
    );
}
