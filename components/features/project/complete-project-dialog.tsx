"use client";

import { useState, useRef, useCallback } from "react";
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
import { Upload, X, ChevronUp, ChevronDown, ImagePlus, Info } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 9;

interface UploadingImage {
    id: string;
    file: File;
    preview: string;
    progress: number;
    error?: string;
    url?: string;
}

interface CompleteProjectDialogProps {
    projectId: number | string;
    projectTitle: string;
    challengeId?: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
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

    const [proofImages, setProofImages] = useState<string[]>([]);
    const [imageCaptions, setImageCaptions] = useState<string[]>([]);
    const [uploading, setUploading] = useState<UploadingImage[]>([]);
    const [videoUrl, setVideoUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalImages = proofImages.length + uploading.length;
    const canAddMore = totalImages < MAX_IMAGES;

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
                } else {
                    setUploading((prev) =>
                        prev.map((u) =>
                            u.id === item.id ? { ...u, error: "上传失败，请重试", progress: 0 } : u
                        )
                    );
                }
                URL.revokeObjectURL(item.preview);
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
            [arr[index], arr[newIndex]] = [arr[newIndex], arr[newIndex] !== undefined ? arr[index] : ""];
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

            toast({
                title: "项目完成！",
                description: "获得 20 XP！你的作品已记录到个人主页",
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

    const resetForm = () => {
        setProofImages([]);
        setImageCaptions([]);
        setUploading([]);
        setVideoUrl("");
        setNotes("");
        setIsPublic(true);
    };

    const isUploadInProgress = uploading.some((u) => !u.error);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>恭喜完成项目！🎉</DialogTitle>
                    <DialogDescription>
                        上传你的作品照片或视频，分享你的成果！完成后将获得 20 XP
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 项目名称 */}
                    <div className="p-4 rounded-lg bg-muted/50">
                        <p className="font-medium text-center">{projectTitle}</p>
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
                            {/* 已上传的图片 */}
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
                                            <Input
                                                placeholder="为这张图写一句说明…"
                                                value={imageCaptions[index] ?? ""}
                                                onChange={(e) => updateCaption(index, e.target.value)}
                                                className="h-7 text-xs"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 正在上传的图片 */}
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

                            {/* 拖拽/点击提示 */}
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
                    <div className="space-y-2">
                        <Label htmlFor="video-url">作品视频链接（可选）</Label>
                        <Input
                            id="video-url"
                            type="url"
                            placeholder="https://..."
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            可以是 YouTube、Bilibili 等视频链接
                        </p>
                    </div>

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
                            rows={4}
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
                            公开展示此完成记录（其他用户可在你的主页看到）
                        </Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || proofImages.length === 0 || isUploadInProgress}
                    >
                        {isSubmitting
                            ? "提交中..."
                            : isUploadInProgress
                              ? "上传中..."
                              : "提交完成记录 (+20 XP)"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
