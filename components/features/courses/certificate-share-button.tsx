"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShareCertificateData } from "@/components/features/works/share-work-dialog";

const ShareCertificateDialog = dynamic(
  () => import("@/components/features/works/share-work-dialog").then((module) => module.ShareCertificateDialog),
  { ssr: false },
);

/** 凭证页本身只有本人可见，转发靠这张导出的图片 */
export function CertificateShareButton({ certificate }: { certificate: ShareCertificateData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button tone="brand" shape="pill" size="lg" className="gap-2 font-bold" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" aria-hidden />
        保存 / 分享凭证
      </Button>
      {open ? (
        <ShareCertificateDialog certificate={certificate} open={open} onOpenChange={setOpen} />
      ) : null}
    </>
  );
}
