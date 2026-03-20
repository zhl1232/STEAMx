"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useProjects } from "@/context/project-context";
import { uploadFileSecureWithProgress } from "@/lib/utils/upload";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, ChevronUp, ChevronDown, ImagePlus, Info, Video, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

const MAX_IMAGES = 9;
const MAX_VIDEO_DURATION = 15;
const MAX_VIDEO_SIZE_MB = 30;

interface UploadingImage {
    id: string;
    file: File;
    preview: string;
    progress: number;
    error?: string;
    url?: string;
}

type VideoUploadStatus = "idle" | "validating" | "uploading" | "compressing" | "done" | "error";

interface CompleteProjectDialogProps {
    projectId: number | string;
    projectTitle: string;
    challengeId?: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            const duration = video.duration;
            URL.revokeObjectURL(video.src);
            resolve(duration);
        };
        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject(new Error("无法读取视频信息"));
        };
        video.src = URL.createObjectURL(file);
    });
}

type VideoUploadResult = { url: string } | { error: string } | null;

function uploadVideoWithProgress(
    file: File,
    onProgress?: (loaded: number, total: number) => void,
    abortSignal?: { xhr?: XMLHttpRequest }
): Promise<VideoUploadResult> {
    return new Promise((resolve) => {
        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        if (abortSignal) abortSignal.xhr = xhr;
        xhr.open("POST", "/api/upload-video");

        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded, e.total);
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.publicUrl ? { url: data.publicUrl } : { error: "服务端未返回视频地址" });
                } catch {
                    resolve({ error: "解析服务端响应失败" });
                }
            } else {
                let msg = "视频上传失败";
                try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* use default */ }
                logger.error("Video upload failed", { status: xhr.status });
                resolve({ error: msg });
            }
        };

        xhr.onerror = () => {
            logger.error("Video upload XHR error");
            resolve({ error: "网络错误，请检查网络连接" });
        };

        xhr.onabort = () => {
            resolve(null);
        };

        xhr.send(formData);
    });
}

export function CompleteProjectDialog({
    projectId,
    projectTitle,
    challengeId,
    open,
    onOpenChange,
    onSuccess,
}: CompleteProjectDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { completeProject } = useProjects();

    const [step, setStep] = useState<1 | 2>(1);

    // Image state
    const [proofImages, setProofImages] = useState<string[]>([]);
    const [imageCaptions, setImageCaptions] = useState<string[]>([]);
    const [uploading, setUploading] = useState<UploadingImage[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Video state
    const [videoUrl, setVideoUrl] = useState("");
    const [videoUploadStatus, setVideoUploadStatus] = useState<VideoUploadStatus>("idle");
    const [videoUploadProgress, setVideoUploadProgress] = useState(0);
    const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
    const videoInputRef = useRef<HTMLInputElement>(null);
    const videoXhrRef = useRef<{ xhr?: XMLHttpRequest }>({});

    // Step 2 state
    const [notes, setNotes] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        return () => { videoXhrRef.current.xhr?.abort(); };
    }, []);

    const totalImages = proofImages.length + uploading.length;
    const canAddMore = totalImages < MAX_IMAGES;
    const isImageUploadInProgress = uploading.some((u) => !u.error);
    const isVideoUploading = videoUploadStatus === "uploading" || videoUploadStatus === "compressing" || videoUploadStatus === "validating";
    const hasMedia = proofImages.length > 0 || videoUrl !== "";

    // ─── Image upload logic ───

    const processFiles = useCallback(async (files: FileList | File[]) => {
        if (!user) return;
        const fileArray = Array.from(files);
        const validFiles: File[] = [];

        for (const file of fileArray) {
            if (!file.type.startsWith("image/")) {
                toast({ title: "仅支持图片格式", variant: "destructive" });
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                toast({ title: "图片不能超过 10MB", variant: "destructive" });
                continue;
            }
            validFiles.push(file);
        }

        const remaining = MAX_IMAGES - totalImages;
        if (validFiles.length > remaining) {
            toast({
                title: `最多上传 ${MAX_IMAGES} 张`,
                description: `还可上传 ${remaining} 张，多余的已忽略`,
                variant: "destructive",
            });
        }
        const batch = validFiles.slice(0, Math.max(0, remaining));
        if (batch.length === 0) return;

        const newItems: UploadingImage[] = batch.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            file,
            preview: URL.createObjectURL(file),
            progress: 0,
        }));

        setUploading((prev) => [...prev, ...newItems]);

        await Promise.all(
            newItems.map(async (item) => {
                const url = await uploadFileSecureWithProgress(
                    item.file,
                    "project-completions",
                    (loaded, total) => {
                        const pct = Math.round((loaded / total) * 100);
                        setUploading((prev) =>
                            prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u))
                        );
                    }
                );

                if (url) {
                    setProofImages((prev) => [...prev, url]);
                    setImageCaptions((prev) => [...prev, ""]);
                    setUploading((prev) => prev.filter((u) => u.id !== item.id));
                    URL.revokeObjectURL(item.preview);
                } else {
                    setUploading((prev) =>
                        prev.map((u) =>
                            u.id === item.id ? { ...u, error: "上传失败，请重试", progress: 0 } : u
                        )
                    );
                }
            })
        );
    }, [user, toast, totalImages]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFiles(e.target.files);
        e.target.value = "";
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) {
                processFiles(e.dataTransfer.files);
            }
        },
        [processFiles]
    );

    const removeImage = (index: number) => {
        setProofImages((prev) => prev.filter((_, i) => i !== index));
        setImageCaptions((prev) => prev.filter((_, i) => i !== index));
    };

    const removeUploadingItem = (id: string) => {
        setUploading((prev) => {
            const item = prev.find((u) => u.id === id);
            if (item) URL.revokeObjectURL(item.preview);
            return prev.filter((u) => u.id !== id);
        });
    };

    const moveImage = (index: number, direction: "up" | "down") => {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= proofImages.length) return;
        setProofImages((prev) => {
            const arr = [...prev];
            [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
            return arr;
        });
        setImageCaptions((prev) => {
            const arr = [...prev];
            [arr[index], arr[newIndex]] = [arr[newIndex] ?? "", arr[index] ?? ""];
            return arr;
        });
    };

    const updateCaption = (index: number, value: string) => {
        setImageCaptions((prev) => {
            const arr = [...prev];
            while (arr.length <= index) arr.push("");
            arr[index] = value;
            return arr;
        });
    };

    // ─── Video upload logic ───

    const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !user) return;

        const allowedTypes = ["video/mp4", "video/webm"];
        if (!allowedTypes.includes(file.type)) {
            toast({ title: "仅支持 MP4、WebM 格式的视频", variant: "destructive" });
            return;
        }

        if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
            toast({ title: `视频不能超过 ${MAX_VIDEO_SIZE_MB}MB`, variant: "destructive" });
            return;
        }

        setVideoUploadStatus("validating");

        try {
            const duration = await getVideoDuration(file);
            if (duration > MAX_VIDEO_DURATION) {
                toast({
                    title: `视频时长不能超过 ${MAX_VIDEO_DURATION} 秒`,
                    description: `当前视频时长 ${Math.round(duration)} 秒，请裁剪后重试`,
                    variant: "destructive",
                });
                setVideoUploadStatus("idle");
                return;
            }
        } catch {
            toast({ title: "无法读取视频信息，请更换文件", variant: "destructive" });
            setVideoUploadStatus("idle");
            return;
        }

        setVideoUploadStatus("uploading");
        setVideoUploadProgress(0);

        videoXhrRef.current.xhr?.abort();
        videoXhrRef.current = {};
        const result = await uploadVideoWithProgress(file, (loaded, total) => {
            const pct = Math.round((loaded / total) * 100);
            setVideoUploadProgress(pct);
            if (pct >= 100) {
                setVideoUploadStatus("compressing");
            }
        }, videoXhrRef.current);

        if (result && "url" in result) {
            setVideoUrl(result.url);
            setVideoPreviewUrl(result.url);
            setVideoUploadStatus("done");
            toast({ title: "视频上传成功" });
        } else if (result === null) {
            setVideoUploadStatus("idle");
        } else {
            setVideoUploadStatus("error");
            toast({ title: result.error, variant: "destructive" });
        }
    };

    const removeVideo = () => {
        videoXhrRef.current.xhr?.abort();
        setVideoUrl("");
        setVideoPreviewUrl("");
        setVideoUploadStatus("idle");
        setVideoUploadProgress(0);
    };

    // ─── Submit ───

    const handleSubmit = async () => {
        if (!user) return;

        if (proofImages.length === 0) {
            toast({
                title: "请上传作品照片",
                description: "至少上传一张作品照片来证明你完成了这个项目",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const nonEmptyCaptions = imageCaptions.some((c) => c.trim().length > 0);
            await completeProject(projectId, {
                images: proofImages,
                videoUrl: videoUrl || undefined,
                notes: notes || undefined,
                isPublic,
                imageCaptions: nonEmptyCaptions ? imageCaptions : undefined,
            });

            // Trigger confetti on success
            try {
                const confetti = (await import("canvas-confetti")).default;
                confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { x: 0.5, y: 0.6 },
                    colors: ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b"],
                });
            } catch {
                // confetti is non-critical
            }

            toast({
                title: "作品已提交审核！",
                description: "审核通过后将公开展示并获得 XP 奖励",
            });

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: unknown) {
            toast({
                title: "提交失败",
                description: error instanceof Error ? error.message : "提交失败",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = useCallback(() => {
        videoXhrRef.current.xhr?.abort();
        setStep(1);
        setProofImages([]);
        setImageCaptions([]);
        setUploading([]);
        setVideoUrl("");
        setVideoPreviewUrl("");
        setVideoUploadStatus("idle");
        setVideoUploadProgress(0);
        setNotes("");
        setIsPublic(true);
    }, []);

    // ─── Render ───

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>上传你的作品</DialogTitle>
                    <DialogDescription>
                        分享你的成果，审核通过后可获得 20 XP
                    </DialogDescription>
                    {/* Stepper indicator */}
                    <div className="flex items-center gap-2 pt-2">
                        <div className={cn(
                            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold",
                            step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>1</div>
                        <div className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full bg-primary transition-all", step >= 2 ? "w-full" : "w-0")} />
                        </div>
                        <div className={cn(
                            "flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold",
                            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>2</div>
                    </div>
                </DialogHeader>

                {step === 1 ? (
                    /* ═══ Step 1: 上传媒体 ═══ */
                    <div className="space-y-6 py-4">
                        {/* 项目名称 */}
                        <div className="p-3 rounded-lg bg-muted/50">
                            <p className="font-medium text-center text-sm">{projectTitle}</p>
                        </div>

                        {/* PBL 联动提示 */}
                        {challengeId && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    此项目关联了挑战赛。填写反思与试错记录可额外获得{" "}
                                    <span className="font-semibold">+10 XP</span>。
                                </p>
                            </div>
                        )}

                        {/* 作品照片 — 拖拽上传区 */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">
                                    作品照片 <span className="text-red-500">*</span>
                                </Label>
                                <span className="text-xs text-muted-foreground">
                                    {proofImages.length}/{MAX_IMAGES}
                                </span>
                            </div>

                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={cn(
                                    "relative rounded-lg border-2 border-dashed transition-colors p-4",
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                                )}
                            >
                                {proofImages.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        {proofImages.map((url, index) => (
                                            <div key={url} className="space-y-1.5">
                                                <div className="relative group aspect-square">
                                                    <OptimizedImage
                                                        src={url}
                                                        alt={`作品 ${index + 1}`}
                                                        fill
                                                        variant="grid"
                                                        className="object-cover rounded-lg"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                                                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        {index > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => moveImage(index, "up")}
                                                                className="p-1 bg-black/60 hover:bg-black/80 rounded-full"
                                                                title="前移"
                                                            >
                                                                <ChevronUp className="h-3 w-3 text-white" />
                                                            </button>
                                                        )}
                                                        {index < proofImages.length - 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => moveImage(index, "down")}
                                                                className="p-1 bg-black/60 hover:bg-black/80 rounded-full"
                                                                title="后移"
                                                            >
                                                                <ChevronDown className="h-3 w-3 text-white" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImage(index)}
                                                            className="p-1 bg-black/60 hover:bg-red-600 rounded-full"
                                                        >
                                                            <X className="h-3 w-3 text-white" />
                                                        </button>
                                                    </div>
                                                    <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium bg-black/50 text-white px-1.5 py-0.5 rounded">
                                                        {index + 1}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {uploading.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        {uploading.map((item) => (
                                            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.preview}
                                                    alt="上传中"
                                                    className="w-full h-full object-cover opacity-60"
                                                />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                                                    {item.error ? (
                                                        <>
                                                            <p className="text-xs text-red-400 text-center">{item.error}</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeUploadingItem(item.id)}
                                                                className="text-xs text-red-300 underline"
                                                            >
                                                                移除
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <Progress value={item.progress} className="h-1.5 w-full" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {canAddMore && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex flex-col items-center gap-2 py-6 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ImagePlus className="h-8 w-8" />
                                        <span className="text-sm">
                                            {proofImages.length === 0
                                                ? "点击或拖拽上传作品照片"
                                                : "继续添加照片"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            支持 JPG / PNG / WebP，单张不超过 10MB
                                        </span>
                                    </button>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileInput}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* 作品视频（可选） */}
                        <div className="space-y-3">
                            <Label className="text-base">作品视频（可选）</Label>

                            {videoUploadStatus === "done" && videoPreviewUrl ? (
                                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                    <video
                                        src={videoPreviewUrl}
                                        className="w-full h-full object-contain"
                                        controls
                                        playsInline
                                        muted
                                    />
                                    <button
                                        type="button"
                                        onClick={removeVideo}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 rounded-full z-10"
                                    >
                                        <X className="h-3.5 w-3.5 text-white" />
                                    </button>
                                </div>
                            ) : isVideoUploading ? (
                                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 space-y-3">
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span className="text-sm">
                                            {videoUploadStatus === "validating"
                                                ? "正在校验视频..."
                                                : videoUploadStatus === "compressing"
                                                  ? "服务器正在压缩视频..."
                                                  : "上传中..."}
                                        </span>
                                    </div>
                                    {videoUploadStatus === "uploading" && (
                                        <Progress value={videoUploadProgress} className="h-1.5" />
                                    )}
                                    {videoUploadStatus === "compressing" && (
                                        <Progress className="h-1.5 [&>div]:animate-pulse" value={100} />
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => videoInputRef.current?.click()}
                                        className={cn(
                                            "w-full flex flex-col items-center gap-2 py-5 rounded-lg border-2 border-dashed transition-colors",
                                            "border-muted-foreground/25 hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground",
                                            videoUploadStatus === "error" && "border-red-300"
                                        )}
                                    >
                                        <Video className="h-7 w-7" />
                                        <span className="text-sm">
                                            {videoUploadStatus === "error" ? "上传失败，点击重试" : "点击上传短视频"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            MP4 / WebM，最长 {MAX_VIDEO_DURATION} 秒，不超过 {MAX_VIDEO_SIZE_MB}MB
                                        </span>
                                    </button>

                                </div>
                            )}

                            <input
                                ref={videoInputRef}
                                type="file"
                                accept="video/mp4,video/webm"
                                onChange={handleVideoSelect}
                                className="hidden"
                            />
                        </div>
                    </div>
                ) : (
                    /* ═══ Step 2: 补充信息 + 预览 ═══ */
                    <div className="space-y-6 py-4">
                        {/* 媒体预览摘要 */}
                        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                            <p className="text-sm font-medium">已上传的媒体</p>
                            <div className="flex gap-2 flex-wrap">
                                {proofImages.map((url, i) => (
                                    <div key={url} className="relative h-14 w-14 rounded-md overflow-hidden shrink-0">
                                        <OptimizedImage src={url} alt={`预览 ${i + 1}`} fill variant="grid" className="object-cover" />
                                    </div>
                                ))}
                                {videoPreviewUrl && (
                                    <div className="relative h-14 w-14 rounded-md overflow-hidden shrink-0 bg-black flex items-center justify-center">
                                        <Video className="h-5 w-5 text-white/80" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 图片说明 */}
                        {proofImages.length > 0 && (
                            <div className="space-y-3">
                                <Label className="text-base">图片说明（可选）</Label>
                                <div className="space-y-2">
                                    {proofImages.map((url, index) => (
                                        <div key={url} className="flex items-center gap-2">
                                            <div className="relative h-8 w-8 rounded shrink-0 overflow-hidden">
                                                <OptimizedImage src={url} alt="" fill variant="grid" className="object-cover" />
                                            </div>
                                            <Input
                                                placeholder={`图 ${index + 1} 的说明…`}
                                                value={imageCaptions[index] ?? ""}
                                                onChange={(e) => updateCaption(index, e.target.value)}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 完成笔记 */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">完成笔记（可选）</Label>
                            <Textarea
                                id="notes"
                                placeholder={
                                    challengeId
                                        ? "分享你的制作过程、遇到的挑战或反思要点…"
                                        : "分享你的制作过程、遇到的挑战或学到的东西…"
                                }
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {/* 是否公开展示 */}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is-public"
                                checked={isPublic}
                                onCheckedChange={(checked) => setIsPublic(checked === true)}
                            />
                            <Label htmlFor="is-public" className="text-sm font-normal cursor-pointer">
                                公开展示此完成记录（其他用户可在作品墙看到）
                            </Label>
                        </div>
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                取消
                            </Button>
                            <div className="flex gap-2 flex-1 sm:flex-initial">
                                {proofImages.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || isImageUploadInProgress || isVideoUploading}
                                        className="text-muted-foreground"
                                    >
                                        跳过，直接提交
                                    </Button>
                                )}
                                <Button
                                    onClick={() => setStep(2)}
                                    disabled={proofImages.length === 0 || isImageUploadInProgress || isVideoUploading}
                                >
                                    {isImageUploadInProgress || isVideoUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            上传中...
                                        </>
                                    ) : (
                                        <>
                                            下一步
                                            <ChevronRight className="h-4 w-4 ml-1" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                上一步
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || proofImages.length === 0}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        提交中...
                                    </>
                                ) : (
                                    "提交作品"
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
