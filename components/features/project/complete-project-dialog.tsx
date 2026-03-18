"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useProjects } from "@/context/project-context";
import { uploadFileSecure } from "@/lib/utils/upload";
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
import { Upload, X } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Input } from "@/components/ui/input";

interface CompleteProjectDialogProps {
    projectId: number | string;
    projectTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CompleteProjectDialog({
    projectId,
    projectTitle,
    open,
    onOpenChange,
    onSuccess
}: CompleteProjectDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const { completeProject } = useProjects();

    const [proofImages, setProofImages] = useState<string[]>([]);
    const [videoUrl, setVideoUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !user) return;

        setIsUploading(true);

        try {
            const uploadedUrls: string[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) {
                    toast({ title: '仅支持图片格式', variant: 'destructive' });
                    continue;
                }
                if (file.size > 10 * 1024 * 1024) {
                    toast({ title: '图片不能超过 10MB', variant: 'destructive' });
                    continue;
                }

                const url = await uploadFileSecure(file, 'project-completions');
                if (!url) throw new Error('上传失败');
                uploadedUrls.push(url);
            }

            setProofImages([...proofImages, ...uploadedUrls]);
            toast({
                title: "上传成功",
                description: `已上传 ${uploadedUrls.length} 张图片`
            });
        } catch (error: unknown) {
            toast({
                title: "上传失败",
                description: error instanceof Error ? error.message : "上传失败",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setProofImages(proofImages.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!user) return;

        if (proofImages.length === 0) {
            toast({
                title: "请上传作品照片",
                description: "至少上传一张作品照片来证明你完成了这个项目",
                variant: "destructive"
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await completeProject(projectId, {
                images: proofImages,
                videoUrl: videoUrl || undefined,
                notes: notes || undefined,
            });

            toast({
                title: "项目完成！",
                description: "获得 20 XP！你的作品已记录到个人主页",
            });

            onSuccess();
            onOpenChange(false);

            setProofImages([]);
            setVideoUrl("");
            setNotes("");
        } catch (error: unknown) {
            toast({
                title: "提交失败",
                description: error instanceof Error ? error.message : "提交失败",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

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

                    {/* 作品照片 */}
                    <div className="space-y-3">
                        <Label className="text-base">
                            作品照片 <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            上传至少 1 张作品照片
                        </p>

                        {/* 已上传的图片 */}
                        {proofImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-3">
                                {proofImages.map((url, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        <OptimizedImage
                                            src={url}
                                            alt={`作品 ${index + 1}`}
                                            fill
                                            variant="grid"
                                            className="object-cover rounded-lg"
                                        />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                        >
                                            <X className="h-4 w-4 text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 上传按钮 */}
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                disabled={isUploading}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full"
                            >
                                {isUploading ? (
                                    <>上传中...</>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        上传照片
                                    </>
                                )}
                            </Button>
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
                            placeholder="分享你的制作过程、遇到的挑战或学到的东西..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={5}
                        />
                        <p className="text-xs text-muted-foreground">
                            记录你的心得，帮助其他人学习
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        取消
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || proofImages.length === 0}
                    >
                        {isSubmitting ? "提交中..." : "提交完成记录 (+20 XP)"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
