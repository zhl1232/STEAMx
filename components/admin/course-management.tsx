"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LESSON_TYPE_OPTIONS } from "@/lib/courses/lesson-types";
import { getApiErrorMessage } from "@/lib/utils/http";
import type { CourseStatus } from "@/lib/courses/types";

interface AdminCourse {
    id: number;
    title: string;
    description: string | null;
    image_url: string | null;
    status: CourseStatus;
    difficulty_stars: number;
    sort_order: number;
    tags: string[] | null;
    course_lessons?: { count: number }[];
}

interface AdminLesson {
    id: number;
    course_id: number;
    title: string;
    lesson_type: string;
    sort_order: number;
    duration_minutes: number | null;
}

const STATUS_LABELS: Record<CourseStatus, string> = {
    draft: "草稿",
    approved: "已发布",
    archived: "已归档",
};

const EMPTY_COURSE = {
    title: "",
    description: "",
    image_url: "/projects/tech_programming.webp",
    status: "draft" as CourseStatus,
    difficulty_stars: 1,
    sort_order: 0,
    tags: "Scratch,编程",
};

const EMPTY_LESSON = {
    title: "",
    lesson_type: "scratch",
    sort_order: 0,
    duration_minutes: 30,
};

export function CourseManagement() {
    const { toast } = useToast();
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [courseDialog, setCourseDialog] = useState(false);
    const [lessonDialog, setLessonDialog] = useState(false);
    const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
    const [lessons, setLessons] = useState<AdminLesson[]>([]);
    const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
    const [lessonForm, setLessonForm] = useState(EMPTY_LESSON);

    const fetchCourses = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/courses");
            if (!res.ok) throw new Error(await getApiErrorMessage(res, "加载失败"));
            const data = await res.json();
            setCourses(data.courses ?? []);
        } catch (e) {
            toast({
                title: "加载失败",
                description: e instanceof Error ? e.message : undefined,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        void fetchCourses();
    }, [fetchCourses]);

    const loadLessons = async (courseId: number) => {
        setSelectedCourseId(courseId);
        const res = await fetch(`/api/courses/${courseId}`);
        if (!res.ok) return;
        const data = await res.json();
        setLessons(data.course?.lessons ?? []);
    };

    const saveCourse = async () => {
        const payload = {
            ...courseForm,
            tags: courseForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        };
        const url = editingCourseId
            ? `/api/admin/courses/${editingCourseId}`
            : "/api/admin/courses";
        const method = editingCourseId ? "PATCH" : "POST";
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            toast({
                title: "保存失败",
                description: await getApiErrorMessage(res, "操作失败"),
                variant: "destructive",
            });
            return;
        }
        toast({ title: editingCourseId ? "课程已更新" : "课程已创建" });
        setCourseDialog(false);
        setEditingCourseId(null);
        setCourseForm(EMPTY_COURSE);
        void fetchCourses();
    };

    const saveLesson = async () => {
        if (!selectedCourseId) return;
        const res = await fetch(`/api/admin/courses/${selectedCourseId}/lessons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lessonForm),
        });
        if (!res.ok) {
            toast({
                title: "添加课时失败",
                description: await getApiErrorMessage(res, "操作失败"),
                variant: "destructive",
            });
            return;
        }
        toast({ title: "课时已添加" });
        setLessonDialog(false);
        setLessonForm(EMPTY_LESSON);
        void loadLessons(selectedCourseId);
    };

    const deleteCourse = async (id: number) => {
        if (!confirm("确定删除该课程及全部课时？")) return;
        const res = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
        if (!res.ok) {
            toast({ title: "删除失败", variant: "destructive" });
            return;
        }
        toast({ title: "已删除" });
        if (selectedCourseId === id) {
            setSelectedCourseId(null);
            setLessons([]);
        }
        void fetchCourses();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold">训练营课程</h2>
                <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
                    <DialogTrigger asChild>
                        <Button
                            onClick={() => {
                                setEditingCourseId(null);
                                setCourseForm(EMPTY_COURSE);
                            }}
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            新建课程
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>
                                {editingCourseId ? "编辑课程" : "新建课程"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-3">
                            <div>
                                <Label>标题</Label>
                                <Input
                                    value={courseForm.title}
                                    onChange={(e) =>
                                        setCourseForm((f) => ({ ...f, title: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <Label>描述</Label>
                                <Textarea
                                    value={courseForm.description}
                                    onChange={(e) =>
                                        setCourseForm((f) => ({
                                            ...f,
                                            description: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <Label>封面 URL</Label>
                                <Input
                                    value={courseForm.image_url}
                                    onChange={(e) =>
                                        setCourseForm((f) => ({
                                            ...f,
                                            image_url: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <Label>状态</Label>
                                <Select
                                    value={courseForm.status}
                                    onValueChange={(v) =>
                                        setCourseForm((f) => ({
                                            ...f,
                                            status: v as CourseStatus,
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">草稿</SelectItem>
                                        <SelectItem value="approved">已发布</SelectItem>
                                        <SelectItem value="archived">已归档</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>标签（逗号分隔）</Label>
                                <Input
                                    value={courseForm.tags}
                                    onChange={(e) =>
                                        setCourseForm((f) => ({ ...f, tags: e.target.value }))
                                    }
                                />
                            </div>
                            <Button onClick={() => void saveCourse()}>保存</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>标题</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>课时</TableHead>
                        <TableHead>操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5}>加载中…</TableCell>
                        </TableRow>
                    ) : (
                        courses.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>{c.id}</TableCell>
                                <TableCell className="font-medium">{c.title}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">
                                        {STATUS_LABELS[c.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {c.course_lessons?.[0]?.count ?? "—"}
                                </TableCell>
                                <TableCell className="space-x-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void loadLessons(c.id)}
                                    >
                                        课时
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setEditingCourseId(c.id);
                                            setCourseForm({
                                                title: c.title,
                                                description: c.description ?? "",
                                                image_url: c.image_url ?? "",
                                                status: c.status,
                                                difficulty_stars: c.difficulty_stars,
                                                sort_order: c.sort_order,
                                                tags: (c.tags ?? []).join(","),
                                            });
                                            setCourseDialog(true);
                                        }}
                                    >
                                        编辑
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => void deleteCourse(c.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {selectedCourseId ? (
                <div className="admin-section rounded-sm border p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-bold">课程 #{selectedCourseId} 课时</h3>
                        <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline">
                                    <Plus className="mr-1 h-4 w-4" />
                                    添加课时
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>添加课时</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-3">
                                    <div>
                                        <Label>标题</Label>
                                        <Input
                                            value={lessonForm.title}
                                            onChange={(e) =>
                                                setLessonForm((f) => ({
                                                    ...f,
                                                    title: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label>课时类型</Label>
                                        <Select
                                            value={lessonForm.lesson_type}
                                            onValueChange={(v) =>
                                                setLessonForm((f) => ({
                                                    ...f,
                                                    lesson_type: v,
                                                }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LESSON_TYPE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>时长（分钟）</Label>
                                        <Input
                                            type="number"
                                            value={lessonForm.duration_minutes}
                                            onChange={(e) =>
                                                setLessonForm((f) => ({
                                                    ...f,
                                                    duration_minutes: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label>排序</Label>
                                        <Input
                                            type="number"
                                            value={lessonForm.sort_order}
                                            onChange={(e) =>
                                                setLessonForm((f) => ({
                                                    ...f,
                                                    sort_order: Number(e.target.value),
                                                }))
                                            }
                                        />
                                    </div>
                                    <Button onClick={() => void saveLesson()}>添加</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                    <ul className="space-y-1 text-sm">
                        {lessons.map((l) => (
                            <li key={l.id} className="flex justify-between border-b py-2">
                                <span>
                                    {l.sort_order}. {l.title}
                                    <Badge variant="outline" className="ml-2">
                                        {LESSON_TYPE_OPTIONS.find((option) => option.value === l.lesson_type)?.label ?? l.lesson_type}
                                    </Badge>
                                </span>
                                <a
                                    href={`/courses/${selectedCourseId}/lessons/${l.id}`}
                                    className="text-[hsl(var(--nav-active))] hover:underline"
                                >
                                    打开
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
