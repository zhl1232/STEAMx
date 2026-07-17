"use client";

import { useCallback, useEffect, useState } from "react";

import {
    CourseBoard,
    CourseBoardSkeleton,
} from "@/components/features/courses/course-board";
import { Button } from "@/components/ui/button";
import type { CourseListItem } from "@/lib/courses/types";

type CoursesResponse = {
    courses?: CourseListItem[];
};

export function CourseBoardLoader() {
    const [courses, setCourses] = useState<CourseListItem[] | null>(null);
    const [error, setError] = useState(false);
    const [requestKey, setRequestKey] = useState(0);

    const retry = useCallback(() => {
        setError(false);
        setCourses(null);
        setRequestKey((current) => current + 1);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        void fetch("/api/courses", { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error("Course request failed");
                return response.json() as Promise<CoursesResponse>;
            })
            .then((payload) => {
                setCourses(payload.courses ?? []);
            })
            .catch((requestError: unknown) => {
                if (requestError instanceof DOMException && requestError.name === "AbortError") return;
                setError(true);
            });

        return () => controller.abort();
    }, [requestKey]);

    if (error) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                <p>课程加载失败，请稍后重试。</p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={retry}
                    className="mt-4"
                >
                    重试
                </Button>
            </div>
        );
    }

    if (!courses) return <CourseBoardSkeleton />;
    return <CourseBoard courses={courses} />;
}
