import { ProjectStepImage } from './project-step-image'

/** One complete storyboard, shared by both detail layouts; never a step thumbnail. */
export function ProjectDemonstration({ image, title, notice }: { image: string; title: string; notice: string }) {
  return (
    <figure className="mb-5">
      <ProjectStepImage src={image} alt={`${title}：${notice}`} className="aspect-2/3 sm:aspect-3/4" />
      <figcaption className="mt-2 text-sm leading-6 text-muted-foreground">{notice}</figcaption>
    </figure>
  )
}
