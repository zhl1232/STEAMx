import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { CourseBoard } from "@/components/features/courses/course-board";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
    title: "Scratch 训练营",
    description: "少儿 Scratch 图形化编程课程，在浏览器中创作动画与游戏。",
    path: "/courses",
});

export default function CoursesPage() {
    return (
        <div className="min-h-screen app-canvas-community">
            <MobileGlobalHeader variant="title" title="训练营" showUserButton={false} />
            <main className="app-shell-wide pb-28 pt-4 md:py-6">
                <header className="mb-5 px-1">
                    <h1 className="text-2xl font-black text-foreground">Scratch 训练营</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        分步引导学习 Scratch，支持在线编辑、保存作品与上传项目文件。
                    </p>
                </header>
                <div className="surface-panel overflow-hidden">
                    <CourseBoard />
                </div>
            </main>
        </div>
    );
}
