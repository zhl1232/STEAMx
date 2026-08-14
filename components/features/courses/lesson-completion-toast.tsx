import Link from "next/link";

import { ToastAction } from "@/components/ui/toast";
import type { LessonCompletionFeedback } from "@/lib/courses/progress";

/**
 * 把课时完成反馈转成 toast 参数。整门课刚学完时附一个「看凭证」按钮，
 * 否则学员看到的只有一句「课程已完成」，找不到结课凭证在哪。
 */
export function toLessonCompletionToast(feedback: LessonCompletionFeedback) {
  return {
    title: feedback.title,
    description: feedback.description,
    action: feedback.certificateHref ? (
      <ToastAction altText="查看结课凭证" asChild>
        <Link href={feedback.certificateHref} prefetch={false}>
          看凭证
        </Link>
      </ToastAction>
    ) : undefined,
  };
}
