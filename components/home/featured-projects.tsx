import { Project } from "@/lib/mappers/types"
import { ProjectCard } from "@/components/features/project-card"
import Link from "next/link"
import { ArrowRight, Flame } from "lucide-react"

interface FeaturedProjectsProps {
    projects: Project[]
}

export function FeaturedProjects({ projects }: FeaturedProjectsProps) {
    if (!projects || projects.length === 0) return null

    return (
        <section className="container mx-auto py-8 md:py-12">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Flame className="h-6 w-6 text-orange-500 fill-orange-500" />
                    <h2 className="text-2xl font-bold tracking-tight">热门推荐</h2>
                </div>
                <Link 
                    href="/explore" 
                    className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                    查看更多 <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                ))}
            </div>
            
            <div className="mt-8 text-center md:hidden">
                 <Link 
                    href="/explore" 
                    className="inline-flex h-10 items-center justify-center rounded-full border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                    探索更多项目
                </Link>
            </div>
        </section>
    )
}
