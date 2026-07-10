"use client";

import { ScratchHostProvider } from "@/components/features/courses/scratch-host-context";

export default function CourseLessonsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ScratchHostProvider>{children}</ScratchHostProvider>;
}
