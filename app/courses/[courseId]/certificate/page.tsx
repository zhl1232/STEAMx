import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award, ImageOff } from "lucide-react";

import { CertificateShareButton } from "@/components/features/courses/certificate-share-button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { formatCertificateDate, getCourseCertificate } from "@/lib/courses/certificate";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ courseId: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { courseId } = await params;
  // 凭证只有本人可见，不该被索引
  return buildPageMetadata({
    title: "结课凭证",
    description: "学完整门技能课程后的结课凭证与作品册",
    path: `/courses/${courseId}/certificate`,
    noIndex: true,
  });
}

export default async function CourseCertificatePage({ params }: PageProps) {
  const { courseId: raw } = await params;
  const courseId = Number(raw);
  if (!Number.isFinite(courseId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/courses/${courseId}/certificate`);

  const certificate = await getCourseCertificate(supabase, { courseId, userId: user.id });
  if (!certificate) notFound();

  const completedAt = formatCertificateDate(certificate.completedAtIso);
  const courseHref = `/courses/${certificate.courseId}`;
  const cover = certificate.works.find((work) => work.image)?.image ?? certificate.courseImage;

  return (
    <div className="min-h-screen app-canvas-community">
      <div className="md:hidden">
        <MobilePageHeader title="结课凭证" fallbackHref={courseHref} />
      </div>
      <main className="app-shell pb-28 pt-4 md:py-6">
        <Link
          href={courseHref}
          className="mb-3 hidden items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground md:mb-4 md:inline-flex md:text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回课程
        </Link>

        <section className="surface-card overflow-hidden rounded-xl">
          <div className="bg-[linear-gradient(135deg,hsl(var(--brand-amber)/0.16),hsl(var(--brand-blue)/0.1))] px-5 py-7 text-center md:px-10 md:py-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--brand-amber))]">
              <Award className="h-3.5 w-3.5" aria-hidden />
              结课凭证
            </span>
            <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight text-foreground md:text-[2rem]">
              {certificate.learnerName} 学完了
              <br className="md:hidden" />《{certificate.courseTitle}》
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {completedAt} · 完成全部 {certificate.lessonCount} 节课
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <CertificateShareButton
                certificate={{
                  courseId: certificate.courseId,
                  courseTitle: certificate.courseTitle,
                  learnerName: certificate.learnerName,
                  completedAt,
                  lessonCount: certificate.lessonCount,
                  cover,
                }}
              />
            </div>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="certificate-works-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2
              id="certificate-works-heading"
              className="text-base font-black tracking-tight text-foreground md:text-lg"
            >
              作品册
            </h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {certificate.works.length} 件
              {certificate.pendingWorkCount > 0 ? ` · ${certificate.pendingWorkCount} 件审核中` : ""}
            </span>
          </div>

          {certificate.works.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {certificate.works.map((work) => (
                <li key={work.id}>
                  <Link
                    href={`/works/${work.id}`}
                    prefetch={false}
                    className="surface-card surface-card-interactive group block overflow-hidden rounded-md"
                  >
                    <div className="relative aspect-square bg-muted">
                      {work.image ? (
                        <OptimizedImage
                          src={work.image}
                          alt={`${work.lessonTitle} 的作品`}
                          fill
                          variant="grid"
                          className="object-cover transition duration-500 group-hover:scale-[1.035]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground/60">
                          <ImageOff className="h-7 w-7" aria-hidden />
                        </div>
                      )}
                    </div>
                    <p className="truncate px-3 py-2.5 text-sm font-bold text-foreground">
                      {work.lessonTitle}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="surface-card rounded-md px-6 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                {certificate.pendingWorkCount > 0 ? "作品还在审核中" : "这门课还没有上传过作品"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {certificate.pendingWorkCount > 0
                  ? "审核通过后会自动收进这本册子，通常很快。"
                  : "回到任意一节课拍照上传，作品会自动收进这本册子。"}
              </p>
              <Link
                href={courseHref}
                prefetch={false}
                className="mt-4 inline-block text-sm font-bold text-[hsl(var(--brand-blue))] hover:underline"
              >
                回到课程
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
