import { ImageUpload } from "@/components/ui/image-upload"

interface ObservationSubmitPhotoSectionProps {
  evidenceImage: string | null
  onEvidenceChange: (url: string | null) => void
}

export function ObservationSubmitPhotoSection({ evidenceImage, onEvidenceChange }: ObservationSubmitPhotoSectionProps) {
  return (
    <section className="surface-subtle p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          1
        </div>
        <div>
          <h2 className="text-lg font-semibold">先上传观察照片</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            每条记录至少需要一张照片，方便后续核对物种和行为。先把照片放上来，再补物种和位置。
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <ImageUpload value={evidenceImage} onChange={onEvidenceChange} pathPrefix="observations" placeholder="上传观察照片" />
      </div>
    </section>
  )
}
