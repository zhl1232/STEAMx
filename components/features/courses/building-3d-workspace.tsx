"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Loader2,
    Maximize2,
    Minimize2,
    Presentation,
    RotateCcw,
    RotateCw,
    Sparkles,
    ZoomIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildBuildingLessonFlow } from "@/lib/courses/building-lesson-flow";
import { getLessonCompletionFeedback } from "@/lib/courses/progress";
import { cn } from "@/lib/utils";
import { resolveAssetDisplayUrl } from "@/lib/utils/asset-url";
import { parsePackedLdrawModelText, splitPackedMpd } from "@/lib/utils/ldraw-mpd";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import { isWorkSubmissionEnabled } from "@/lib/works/capability";
import type {
    Building3DBrickInstance,
    Building3DLessonContent,
    Building3DPart,
    Building3DStep,
    CourseLessonRow,
} from "@/lib/courses/types";

type ThreeModule = typeof import("three");

type LoadedThreeCore = {
    THREE: ThreeModule;
    OrbitControls: typeof import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;
};

type LoadedLdraw = {
    LDrawLoader: typeof import("three/examples/jsm/loaders/LDrawLoader.js").LDrawLoader;
    LDrawConditionalLineMaterial: typeof import("three/examples/jsm/materials/LDrawConditionalLineMaterial.js").LDrawConditionalLineMaterial;
};

const DEFAULT_LDRAW_COLOR_URL = "/courses/ldraw/LDConfig.ldr";

// 「上传作品」入口较重，仅在产出作品的课时按需加载。
const LessonWorkUpload = dynamic(
    () => import("@/components/features/courses/lesson-work-upload").then((m) => m.LessonWorkUpload),
    { ssr: false },
);
// 「作品」Tab 画廊：就地展示这一课的作品。
const LessonWorksGallery = dynamic(
    () => import("@/components/features/courses/lesson-works-gallery").then((m) => m.LessonWorksGallery),
    { ssr: false },
);

type SceneState = {
    cleanup: () => void;
    focusStep: (stepIndex: number, resetCamera?: boolean) => void;
};

type LockableScreenOrientation = {
    lock?: (orientation: "landscape") => Promise<void>;
    unlock?: () => void;
};

type LDrawEditableLine = {
    index: number;
    stepIndex: number;
    line: string;
    color: string;
    fileName: string;
    x: number;
    y: number;
    z: number;
    matrix: number[];
};

const DEFAULT_PARTS: Building3DPart[] = [
    { id: "base", name: "长底板", color: "#2563eb", quantity: 1 },
    { id: "axle", name: "连接轴", color: "#64748b", quantity: 2 },
    { id: "wheel", name: "车轮", color: "#111827", quantity: 4 },
    { id: "cab", name: "驾驶舱积木", color: "#f59e0b", quantity: 2 },
];

const DEFAULT_STEPS_3D: Building3DStep[] = [
    {
        title: "搭好底盘",
        description: "先把长底板放平，确认车身前后方向。",
        partIds: ["base"],
        cameraHint: "isometric",
    },
    {
        title: "装上车轮",
        description: "把两根连接轴放到底盘下方，再把四个车轮对称装上。",
        partIds: ["axle", "wheel"],
        cameraHint: "front",
    },
    {
        title: "加上驾驶舱",
        description: "在车身中间叠上驾驶舱积木，让重心保持在底盘中央。",
        partIds: ["cab"],
        cameraHint: "side",
    },
];

const VALID_BRICK_SHAPES = new Set(["box", "cylinder"]);

function isVector3(value: unknown): value is [number, number, number] {
    return (
        Array.isArray(value) &&
        value.length === 3 &&
        value.every((item) => typeof item === "number" && Number.isFinite(item))
    );
}

function normalizeBrickInstances(value: unknown): Building3DBrickInstance[] | undefined {
    if (!Array.isArray(value)) return undefined;

    const instances: Building3DBrickInstance[] = [];
    for (const raw of value) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        if (
            typeof item.id !== "string" ||
            typeof item.partId !== "string" ||
            !isVector3(item.position) ||
            !isVector3(item.scale)
        ) {
            continue;
        }

        const shape = typeof item.shape === "string" && VALID_BRICK_SHAPES.has(item.shape)
            ? item.shape as Building3DBrickInstance["shape"]
            : "box";

        instances.push({
            id: item.id,
            partId: item.partId,
            shape,
            position: item.position,
            scale: item.scale,
            rotation: isVector3(item.rotation) ? item.rotation : undefined,
            color: typeof item.color === "string" ? item.color : undefined,
        });
    }

    return instances.length > 0 ? instances : undefined;
}

function normalizeBuildingContent(lesson: CourseLessonRow): Building3DLessonContent {
    const content = lesson.content?.building3d;
    const parts = Array.isArray(content?.parts) && content.parts.length > 0
        ? content.parts
        : DEFAULT_PARTS;
    const steps3d = Array.isArray(content?.steps3d) && content.steps3d.length > 0
        ? content.steps3d
        : DEFAULT_STEPS_3D;

    const slideImageUrls = Array.isArray(content?.slideImageUrls)
        ? content.slideImageUrls.filter((url): url is string => typeof url === "string" && url.length > 0)
        : undefined;

    const videoSlideIndex =
        typeof content?.videoSlideIndex === "number" && Number.isFinite(content.videoSlideIndex)
            ? content.videoSlideIndex
            : undefined;

    return {
        modelUrl: resolveAssetDisplayUrl(typeof content?.modelUrl === "string" ? content.modelUrl : undefined) ?? undefined,
        ldrawModelUrl: resolveAssetDisplayUrl(typeof content?.ldrawModelUrl === "string" ? content.ldrawModelUrl : undefined) ?? undefined,
        ldrawColorUrl: resolveAssetDisplayUrl(typeof content?.ldrawColorUrl === "string" ? content.ldrawColorUrl : undefined) ?? undefined,
        attribution: typeof content?.attribution === "string" ? content.attribution : undefined,
        videoUrl: resolveAssetDisplayUrl(typeof content?.videoUrl === "string" ? content.videoUrl : undefined) ?? undefined,
        videoSlideIndex,
        slideImageUrls: slideImageUrls?.map((url) => resolveAssetDisplayUrl(url) ?? url),
        slidesPdfUrl: resolveAssetDisplayUrl(typeof content?.slidesPdfUrl === "string" ? content.slidesPdfUrl : undefined) ?? undefined,
        finishedImageUrl: resolveAssetDisplayUrl(typeof content?.finishedImageUrl === "string" ? content.finishedImageUrl : undefined) ?? undefined,
        parts,
        steps3d,
        brickInstances: normalizeBrickInstances(content?.brickInstances),
    };
}

function partMap(parts: Building3DPart[]) {
    return new Map(parts.map((part) => [part.id, part]));
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    return fallback;
}

function parseLDrawEditableLine(line: string, index: number, stepIndex: number): LDrawEditableLine | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("1 ")) return null;
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 15) return null;
    const numbers = tokens.slice(2, 14).map((token) => Number(token));
    if (numbers.some((value) => !Number.isFinite(value))) return null;
    return {
        index,
        stepIndex,
        line,
        color: tokens[1],
        fileName: tokens.slice(14).join(" "),
        x: numbers[0],
        y: numbers[1],
        z: numbers[2],
        matrix: numbers.slice(3),
    };
}

function parseLDrawStepLines(mainText: string): LDrawEditableLine[] {
    const lines = mainText.split(/\r?\n/);
    const editable: LDrawEditableLine[] = [];
    let stepIndex = 0;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (line.trim() === "0 STEP") {
            stepIndex += 1;
            continue;
        }
        const parsed = parseLDrawEditableLine(line, index, stepIndex);
        if (parsed) editable.push(parsed);
    }
    return editable;
}

function formatLDrawNumber(value: number) {
    if (Math.abs(value) < 0.0005) return "0.0000";
    return value.toFixed(4);
}

function formatLDrawMatrixNumber(value: number) {
    if (Math.abs(value) < 0.0000005) return "0.000000";
    return value.toFixed(6);
}

function formatLDrawLine(line: LDrawEditableLine) {
    return [
        "1",
        line.color,
        formatLDrawNumber(line.x),
        formatLDrawNumber(line.y),
        formatLDrawNumber(line.z),
        ...line.matrix.map(formatLDrawMatrixNumber),
        line.fileName,
    ].join(" ");
}

function multiplyLDrawMatrices(a: number[], b: number[]) {
    return [
        a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
        a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
        a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
        a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
        a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
        a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
        a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
        a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
        a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
    ];
}

function quarterTurnMatrix(axis: "x" | "y" | "z", direction: 1 | -1) {
    const s = direction;
    if (axis === "x") return [1, 0, 0, 0, 0, -s, 0, s, 0];
    if (axis === "y") return [0, 0, s, 0, 1, 0, -s, 0, 0];
    return [0, -s, 0, s, 0, 0, 0, 0, 1];
}

function updateEditableLine(
    line: LDrawEditableLine,
    patch: Partial<Pick<LDrawEditableLine, "x" | "y" | "z" | "matrix">>,
): LDrawEditableLine {
    return { ...line, ...patch, line: formatLDrawLine({ ...line, ...patch }) };
}

let threeCorePromise: Promise<LoadedThreeCore> | null = null;
let ldrawRuntimePromise: Promise<LoadedLdraw> | null = null;
let gltfLoaderPromise: Promise<typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader> | null = null;

function loadThreeCore(): Promise<LoadedThreeCore> {
    if (threeCorePromise) return threeCorePromise;

    threeCorePromise = Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
    ]).then(([THREE, controls]) => ({
        THREE,
        OrbitControls: controls.OrbitControls,
    }));
    void threeCorePromise.catch(() => {
        threeCorePromise = null;
    });
    return threeCorePromise;
}

function loadLdrawRuntime(): Promise<LoadedLdraw> {
    if (ldrawRuntimePromise) return ldrawRuntimePromise;

    ldrawRuntimePromise = Promise.all([
        import("three/examples/jsm/loaders/LDrawLoader.js"),
        import("three/examples/jsm/materials/LDrawConditionalLineMaterial.js"),
    ]).then(([ldraw, ldrawLine]) => ({
        LDrawLoader: ldraw.LDrawLoader,
        LDrawConditionalLineMaterial: ldrawLine.LDrawConditionalLineMaterial,
    }));
    void ldrawRuntimePromise.catch(() => {
        ldrawRuntimePromise = null;
    });
    return ldrawRuntimePromise;
}

function loadGltfLoader() {
    if (gltfLoaderPromise) return gltfLoaderPromise;

    gltfLoaderPromise = import("three/examples/jsm/loaders/GLTFLoader.js").then(
        (gltf) => gltf.GLTFLoader,
    );
    void gltfLoaderPromise.catch(() => {
        gltfLoaderPromise = null;
    });
    return gltfLoaderPromise;
}

function preloadThreeRuntime(content: Building3DLessonContent) {
    void loadThreeCore().catch(() => undefined);
    if (content.ldrawModelUrl) {
        void loadLdrawRuntime().catch(() => undefined);
    } else if (content.modelUrl) {
        void loadGltfLoader().catch(() => undefined);
    }
}

function normalizeLdrawAssembly(
    THREE: ThreeModule,
    assembly: import("three").Group,
    floorY: number,
) {
    assembly.scale.setScalar(1);
    assembly.position.set(0, 0, 0);
    assembly.rotation.x = Math.PI;
    assembly.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(assembly);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    assembly.scale.setScalar(4 / maxDim);
    assembly.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(assembly);
    const center = scaledBox.getCenter(new THREE.Vector3());
    assembly.position.set(-center.x, floorY - scaledBox.min.y, -center.z);
    assembly.updateMatrixWorld(true);
}

function prepareLdrawStepModel(model: import("three").Group) {
    model.traverse((object) => {
        const mesh = object as import("three").Mesh;
        if ((mesh as { isMesh?: boolean }).isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
    });
}

function disposeObject3D(root: import("three").Object3D) {
    const geometries = new Set<import("three").BufferGeometry>();
    const materials = new Set<import("three").Material>();
    const textures = new Set<import("three").Texture>();

    root.traverse((object) => {
        const mesh = object as import("three").Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of meshMaterials) {
            if (!material) continue;
            materials.add(material);
            for (const value of Object.values(material)) {
                if (value && typeof value === "object" && (value as { isTexture?: boolean }).isTexture) {
                    textures.add(value as import("three").Texture);
                }
            }
        }
    });

    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    for (const material of materials) material.dispose();
}

function getLdrawModelFileName(modelUrl: string): string | null {
    try {
        const pathname = new URL(modelUrl, window.location.origin).pathname;
        const fileName = pathname.split("/").pop() ?? "";
        return /^[A-Za-z0-9][A-Za-z0-9._-]*\.mpd$/.test(fileName) && !fileName.includes("..")
            ? fileName
            : null;
    } catch {
        return null;
    }
}

function getScreenOrientation() {
    return (window.screen as Screen & { orientation?: LockableScreenOrientation }).orientation;
}

function applyCameraHint(
    THREE: ThreeModule,
    camera: import("three").PerspectiveCamera,
    controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls,
    hint: Building3DStep["cameraHint"],
) {
    const positions = {
        front: new THREE.Vector3(0, 4, 9),
        back: new THREE.Vector3(0, 4, -9),
        side: new THREE.Vector3(9, 4, 0),
        top: new THREE.Vector3(0, 10, 0.01),
        isometric: new THREE.Vector3(7, 5, 8),
    };
    const target = positions[hint ?? "isometric"];
    camera.position.copy(target);
    controls.target.set(0, 0.8, 0);
    controls.update();
}

function createDemoBrickScene(
    THREE: ThreeModule,
    parts: Building3DPart[],
    steps: Building3DStep[],
    brickInstances?: Building3DBrickInstance[],
) {
    const root = new THREE.Group();
    const meshesByPartId = new Map<string, import("three").Mesh[]>();
    const partsById = partMap(parts);

    const makeMesh = (
        nodeId: string,
        partId: string,
        geometry: import("three").BufferGeometry,
        position: [number, number, number],
        scale: [number, number, number],
        rotation?: [number, number, number],
        color?: string,
    ) => {
        const part = partsById.get(partId);
        const material = new THREE.MeshStandardMaterial({
            color: color ?? part?.color ?? "#94a3b8",
            roughness: 0.48,
            metalness: 0.04,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = nodeId;
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        if (rotation) mesh.rotation.set(...rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.partId = partId;
        mesh.userData.nodeId = nodeId;
        root.add(mesh);
        const meshes = meshesByPartId.get(partId) ?? [];
        meshes.push(mesh);
        meshesByPartId.set(partId, meshes);
        return mesh;
    };

    const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 32);
    const axleGeometry = new THREE.CylinderGeometry(0.12, 0.12, 4.8, 18);
    const studGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 18);

    if (brickInstances?.length) {
        for (const brick of brickInstances) {
            const geometry = brick.shape === "cylinder" ? cylinderGeometry : baseGeometry;
            makeMesh(
                brick.id,
                brick.partId,
                geometry,
                brick.position,
                brick.scale,
                brick.rotation,
                brick.color,
            );
        }
        return { root, meshesByPartId };
    }

    makeMesh("base", "base", baseGeometry, [0, 0.45, 0], [4.8, 0.5, 2.4]);

    for (const x of [-1.7, 1.7]) {
        const axle = makeMesh(`axle-${x}`, "axle", axleGeometry, [x, 0.1, 0], [1, 1, 1]);
        axle.rotation.x = Math.PI / 2;
    }

    for (const x of [-1.7, 1.7]) {
        for (const z of [-1.45, 1.45]) {
            const wheel = makeMesh(`wheel-${x}-${z}`, "wheel", cylinderGeometry, [x, 0.08, z], [1, 1, 1]);
            wheel.rotation.x = Math.PI / 2;
        }
    }

    makeMesh("cab-front", "cab", baseGeometry, [0.55, 1.05, 0], [1.6, 0.7, 1.55]);
    makeMesh("cab-back", "cab", baseGeometry, [-0.75, 1.05, 0], [0.9, 0.7, 1.55]);

    for (const x of [-1.7, -0.55, 0.55, 1.7]) {
        for (const z of [-0.72, 0.72]) {
            makeMesh(`stud-${x}-${z}`, "base", studGeometry, [x, 0.78, z], [1, 1, 1]);
        }
    }

    const visiblePartIds = new Set<string>();
    for (const step of steps) {
        for (const partId of step.partIds) visiblePartIds.add(partId);
    }
    for (const part of parts) {
        if (!visiblePartIds.has(part.id) && !meshesByPartId.has(part.id)) {
            makeMesh(part.id, part.id, baseGeometry, [0, -3, 0], [0.4, 0.4, 0.4]);
        }
    }

    return { root, meshesByPartId };
}

function LDrawDebugEditor({
    modelUrl,
    activeStepIndex,
}: {
    modelUrl?: string;
    activeStepIndex: number;
}) {
    const { toast } = useToast();
    const [lines, setLines] = useState<LDrawEditableLine[]>([]);
    const [error, setError] = useState<string | null>(null);
    const activeLines = useMemo(
        () => lines.filter((line) => line.stepIndex === activeStepIndex),
        [activeStepIndex, lines],
    );
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<LDrawEditableLine | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadModelSource() {
            if (!modelUrl) return;
            setError(null);
            try {
                const response = await fetch(modelUrl, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const mpd = await response.text();
                const { mainText } = splitPackedMpd(mpd);
                if (!cancelled) setLines(parseLDrawStepLines(mainText));
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err, "无法读取 LDraw 源行"));
            }
        }
        void loadModelSource();
        return () => {
            cancelled = true;
        };
    }, [modelUrl]);

    useEffect(() => {
        const first = activeLines[0] ?? null;
        setSelectedIndex(first?.index ?? null);
        setDraft(first);
    }, [activeLines]);

    const selectLine = (line: LDrawEditableLine) => {
        setSelectedIndex(line.index);
        setDraft(line);
    };

    const applyDraft = (next: LDrawEditableLine) => {
        setDraft(next);
    };

    const nudge = (axis: "x" | "y" | "z", amount: number) => {
        if (!draft) return;
        applyDraft(updateEditableLine(draft, { [axis]: draft[axis] + amount }));
    };

    const rotate = (axis: "x" | "y" | "z", direction: 1 | -1) => {
        if (!draft) return;
        applyDraft(updateEditableLine(draft, {
            matrix: multiplyLDrawMatrices(draft.matrix, quarterTurnMatrix(axis, direction)),
        }));
    };

    const copyLine = async () => {
        if (!draft) return;
        const line = formatLDrawLine(draft);
        try {
            await navigator.clipboard.writeText(line);
            toast({ title: "已复制 LDraw 行" });
        } catch {
            toast({ title: "复制失败", description: line, variant: "destructive" });
        }
    };

    return (
        <div className="border-t border-border bg-[#f8fbff] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h4 className="text-xs font-bold text-foreground">LDraw 调试</h4>
                    <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        当前步骤 · 复制新行后回写源文件
                    </p>
                </div>
                <span className="rounded-sm border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    ?ldrawEdit=1
                </span>
            </div>
            {error ? (
                <p className="mt-2 rounded-sm border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                    {error}
                </p>
            ) : null}
            <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
                {activeLines.length > 0 ? activeLines.map((line) => (
                    <button
                        key={line.index}
                        type="button"
                        onClick={() => selectLine(line)}
                        className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-left text-xs transition-colors",
                            selectedIndex === line.index
                                ? "border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue)/0.08)] text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <span className="min-w-0 truncate">{line.fileName}</span>
                        <span className="shrink-0 font-mono">#{line.index + 1}</span>
                    </button>
                )) : (
                    <p className="rounded-sm border border-dashed border-border bg-background px-2 py-2 text-xs text-muted-foreground">
                        当前步骤没有可编辑零件行
                    </p>
                )}
            </div>
            {draft ? (
                <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                        {(["x", "y", "z"] as const).map((axis) => (
                            <div key={axis} className="rounded-sm border border-border bg-background p-1.5">
                                <p className="mb-1 text-center font-mono text-[11px] uppercase text-muted-foreground">
                                    {axis} {formatLDrawNumber(draft[axis])}
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                    <button type="button" className="rounded-sm bg-muted px-1 py-1 text-[11px] font-semibold" onClick={() => nudge(axis, -40)}>-40</button>
                                    <button type="button" className="rounded-sm bg-muted px-1 py-1 text-[11px] font-semibold" onClick={() => nudge(axis, 40)}>+40</button>
                                    <button type="button" className="rounded-sm bg-muted px-1 py-1 text-[11px] font-semibold" onClick={() => nudge(axis, -10)}>-10</button>
                                    <button type="button" className="rounded-sm bg-muted px-1 py-1 text-[11px] font-semibold" onClick={() => nudge(axis, 10)}>+10</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("y", 1)}>水平 +90</button>
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("z", 1)}>垂直 +90</button>
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("x", 1)}>前后 +90</button>
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("y", -1)}>水平 -90</button>
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("z", -1)}>垂直 -90</button>
                        <button type="button" className="rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-semibold" onClick={() => rotate("x", -1)}>前后 -90</button>
                    </div>
                    <pre className="max-h-28 overflow-auto rounded-sm border border-border bg-[#0f172a] p-2 text-[11px] leading-relaxed text-white">
                        {formatLDrawLine(draft)}
                    </pre>
                    <Button type="button" size="sm" variant="outline" className="w-full bg-background" onClick={copyLine}>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        复制这一行
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

export function Building3DWorkspace({
    courseId,
    lesson,
    activeStepIndex,
    onStepChange,
    initialCompleted = false,
    onCompleted,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    activeStepIndex: number;
    onStepChange: (index: number) => void;
    initialCompleted?: boolean;
    onCompleted?: () => void;
}) {
    const workspaceRef = useRef<HTMLElement>(null);
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneState | null>(null);
    const nativeFullscreenSessionRef = useRef(false);
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(initialCompleted);
    const content = useMemo(() => normalizeBuildingContent(lesson), [lesson]);
    const partsById = useMemo(() => partMap(content.parts), [content.parts]);
    const flow = useMemo(
        () => buildBuildingLessonFlow({ lessonTitle: lesson.title, content }),
        [content, lesson.title],
    );
    const clampedPageIndex = flow.length > 0
        ? Math.min(Math.max(activeStepIndex, 0), flow.length - 1)
        : 0;
    const activePage = flow[clampedPageIndex] ?? null;
    const activeBuildStepIndex = activePage?.kind === "build" ? activePage.stepIndex : 0;
    const activeBuildStepIndexRef = useRef(activeBuildStepIndex);
    const activeStep = content.steps3d[activeBuildStepIndex] ?? content.steps3d[0];
    const slideCount = content.slideImageUrls?.length ?? 0;
    // videoSlideIndex 为 1 基，转 0 基；越界视为没有内嵌视频页。
    const videoSlide0 =
        content.videoSlideIndex && content.videoSlideIndex >= 1 && content.videoSlideIndex <= slideCount
            ? content.videoSlideIndex - 1
            : -1;
    const hasWorks = isWorkSubmissionEnabled(lesson);
    const [view, setView] = useState<"lesson" | "works">("lesson");
    const [failedSlides, setFailedSlides] = useState<Set<number>>(() => new Set());
    const [ldrawEditEnabled, setLdrawEditEnabled] = useState(false);
    const [isImmersive, setIsImmersive] = useState(false);
    const showBuildPage = view === "lesson" && activePage?.kind === "build";
    const nextPage = view === "lesson" ? flow[clampedPageIndex + 1] ?? null : null;
    const upcomingBuildPage = view === "lesson" && !showBuildPage
        ? flow.find((page, index) => index > clampedPageIndex && page.kind === "build") ?? null
        : null;
    const nextSlideImageUrl =
        nextPage?.kind === "slide" &&
        !(nextPage.sourceIndex === videoSlide0 && content.videoUrl)
            ? nextPage.imageUrl
            : null;
    const nextVideoUrl =
        nextPage?.kind === "video" ||
        (nextPage?.kind === "slide" && nextPage.sourceIndex === videoSlide0)
            ? content.videoUrl
            : undefined;

    useEffect(() => {
        activeBuildStepIndexRef.current = activeBuildStepIndex;
    }, [activeBuildStepIndex]);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        setLdrawEditEnabled(searchParams.get("ldrawEdit") === "1");
        setView(hasWorks && searchParams.get("view") === "works" ? "works" : "lesson");
    }, [hasWorks, lesson.id]);

    useEffect(() => {
        if (!nextVideoUrl) return;
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = nextVideoUrl;
        video.load();

        return () => {
            video.removeAttribute("src");
            video.load();
        };
    }, [nextVideoUrl]);

    useEffect(() => {
        if (upcomingBuildPage?.kind !== "build") return;

        const abortController = new AbortController();
        let preloadUrl: string | null = null;
        preloadThreeRuntime(content);

        if (content.ldrawModelUrl) {
            const modelFileName = getLdrawModelFileName(content.ldrawModelUrl);
            if (modelFileName) {
                preloadUrl = `/api/courses/ldraw-step?model=${encodeURIComponent(modelFileName)}&step=${upcomingBuildPage.stepIndex}`;
            }
        } else if (content.modelUrl) {
            preloadUrl = resolveAssetDisplayUrl(content.modelUrl) ?? content.modelUrl;
        }

        if (preloadUrl) {
            void fetch(preloadUrl, {
                cache: "force-cache",
                signal: abortController.signal,
            })
                .then((response) => response.ok ? response.arrayBuffer() : undefined)
                .catch(() => undefined);
        }

        return () => abortController.abort();
    }, [content, upcomingBuildPage]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (document.fullscreenElement === workspaceRef.current) {
                nativeFullscreenSessionRef.current = true;
                setIsImmersive(true);
                return;
            }
            if (!nativeFullscreenSessionRef.current) return;

            nativeFullscreenSessionRef.current = false;
            getScreenOrientation()?.unlock?.();
            setIsImmersive(false);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!isImmersive) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isImmersive]);

    useEffect(() => {
        if (!showBuildPage) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        let state: SceneState | null = null;
        let cleanupIncompleteScene: (() => void) | null = null;
        const abortController = new AbortController();

        async function setup() {
            const mount = mountRef.current;
            if (!mount) return;
            setLoading(true);
            setLoadError(null);
            try {
                const [threeCore, ldrawRuntime, GLTFLoader] = await Promise.all([
                    loadThreeCore(),
                    content.ldrawModelUrl ? loadLdrawRuntime() : Promise.resolve(null),
                    !content.ldrawModelUrl && content.modelUrl
                        ? loadGltfLoader()
                        : Promise.resolve(null),
                ]);
                if (cancelled || !mountRef.current) return;
                const { THREE, OrbitControls } = threeCore;

                const FLOOR_Y = -0.18;

                const scene = new THREE.Scene();
                scene.background = new THREE.Color("#f8fbff");

                const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
                const renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: false,
                });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                mount.appendChild(renderer.domElement);

                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.minDistance = 4;
                controls.maxDistance = 16;

                let frame = 0;
                let resizeObserver: ResizeObserver | null = null;
                let disposed = false;
                const cleanupScene = () => {
                    if (disposed) return;
                    disposed = true;
                    cancelAnimationFrame(frame);
                    resizeObserver?.disconnect();
                    controls.dispose();
                    disposeObject3D(scene);
                    renderer.renderLists.dispose();
                    renderer.dispose();
                    renderer.forceContextLoss();
                    if (renderer.domElement.parentElement === mount) {
                        mount.removeChild(renderer.domElement);
                    }
                };
                cleanupIncompleteScene = cleanupScene;

                const hemi = new THREE.HemisphereLight("#ffffff", "#cbd5e1", 2.2);
                scene.add(hemi);
                const key = new THREE.DirectionalLight("#ffffff", 2);
                key.position.set(4, 7, 5);
                key.castShadow = true;
                scene.add(key);
                const floor = new THREE.Mesh(
                    new THREE.PlaneGeometry(14, 10),
                    new THREE.MeshStandardMaterial({ color: "#e8f1f8", roughness: 0.9 }),
                );
                floor.rotation.x = -Math.PI / 2;
                floor.position.y = FLOOR_Y;
                floor.receiveShadow = true;
                scene.add(floor);

                let root: import("three").Object3D | null = null;
                let revealPartsByStep = true;
                let ldrawAssembly: import("three").Group | null = null;
                const ldrawStepRoots = new Map<number, import("three").Group>();
                let visibleLdrawStep = 0;
                let requestedLdrawStep = -1;
                let loadedLdrawStep = -1;
                let ldrawStepCount: number | null = null;
                let ldrawLoadPromise: Promise<void> | null = null;
                const prefetchedLdrawSteps = new Set<number>();
                const defaultMaterials = new Map<
                    import("three").Mesh,
                    import("three").Material | import("three").Material[]
                >();
                const collectDefaultMaterials = (object: import("three").Object3D) => {
                    defaultMaterials.clear();
                    object.traverse((child) => {
                        if (!("isMesh" in child)) return;
                        const mesh = child as import("three").Mesh;
                        defaultMaterials.set(mesh, mesh.material);
                    });
                };
                const ldrawColorUrl =
                    resolveAssetDisplayUrl(content.ldrawColorUrl ?? DEFAULT_LDRAW_COLOR_URL)
                    ?? DEFAULT_LDRAW_COLOR_URL;
                const createLdrawLoader = () => {
                    if (!ldrawRuntime) throw new Error("LDraw 运行时未能加载");
                    const loader = new ldrawRuntime.LDrawLoader();
                    // 高细节零件的平滑法线预处理会阻塞主线程数秒；条件线已能保留曲面轮廓。
                    loader.smoothNormals = false;
                    loader.setConditionalLineMaterial(ldrawRuntime.LDrawConditionalLineMaterial);
                    return loader;
                };
                const ldrawLoader = content.ldrawModelUrl ? createLdrawLoader() : null;
                const ldrawMaterialsPromise = ldrawLoader
                    ? (async () => {
                        ldrawLoader.addDefaultMaterials();
                        await ldrawLoader.preloadMaterials(ldrawColorUrl);
                    })()
                    : null;
                const parseLdrawStepModel = async (mpdText: string) => {
                    if (!ldrawLoader || !ldrawMaterialsPromise) {
                        throw new Error("LDraw 运行时未能加载");
                    }
                    await ldrawMaterialsPromise;
                    const model = await parsePackedLdrawModelText(
                        ldrawLoader,
                        mpdText,
                        ldrawColorUrl,
                        {
                            allowSmallPackedMpd: true,
                            preloadMaterials: false,
                        },
                    );
                    prepareLdrawStepModel(model);
                    return model;
                };

                if (content.ldrawModelUrl) {
                    const modelFileName = getLdrawModelFileName(content.ldrawModelUrl);
                    if (!modelFileName) throw new Error("LDraw 模型地址无效");
                    ldrawAssembly = new THREE.Group();
                    root = ldrawAssembly;
                    revealPartsByStep = false;
                    scene.add(root);

                    const prefetchLdrawStep = (step: number) => {
                        if (
                            cancelled ||
                            step < 0 ||
                            (ldrawStepCount !== null && step >= ldrawStepCount) ||
                            prefetchedLdrawSteps.has(step)
                        ) {
                            return;
                        }
                        prefetchedLdrawSteps.add(step);
                        void fetch(
                            `/api/courses/ldraw-step?model=${encodeURIComponent(modelFileName)}&step=${step}`,
                            { cache: "force-cache", signal: abortController.signal },
                        )
                            .then((response) => {
                                if (!response.ok) throw new Error(`LDraw 第 ${step + 1} 步预加载失败`);
                                return response.arrayBuffer();
                            })
                            .catch(() => {
                                prefetchedLdrawSteps.delete(step);
                            });
                    };

                    const loadLdrawSteps = async () => {
                        if (ldrawLoadPromise) return ldrawLoadPromise;
                        setLoading(true);
                        setLoadError(null);
                        ldrawLoadPromise = (async () => {
                            while (!cancelled && loadedLdrawStep < requestedLdrawStep) {
                                const nextStep = loadedLdrawStep + 1;
                                const response = await fetch(
                                    `/api/courses/ldraw-step?model=${encodeURIComponent(modelFileName)}&step=${nextStep}`,
                                    { cache: "force-cache", signal: abortController.signal },
                                );
                                if (!response.ok) {
                                    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                                    throw new Error(payload?.error ?? `LDraw 第 ${nextStep + 1} 步加载失败`);
                                }
                                const responseStepCount = Number(response.headers.get("X-LDraw-Step-Count"));
                                if (Number.isSafeInteger(responseStepCount) && responseStepCount > 0) {
                                    ldrawStepCount = responseStepCount;
                                    const lastModelStep = responseStepCount - 1;
                                    visibleLdrawStep = Math.min(visibleLdrawStep, lastModelStep);
                                    requestedLdrawStep = Math.min(requestedLdrawStep, lastModelStep);
                                }
                                const stepRoot = await parseLdrawStepModel(await response.text());
                                if (cancelled || !ldrawAssembly) {
                                    disposeObject3D(stepRoot);
                                    return;
                                }
                                ldrawStepRoots.set(nextStep, stepRoot);
                                ldrawAssembly.add(stepRoot);
                                loadedLdrawStep = nextStep;
                                normalizeLdrawAssembly(THREE, ldrawAssembly, FLOOR_Y);
                                for (const [index, loadedRoot] of ldrawStepRoots) {
                                    loadedRoot.visible = index <= visibleLdrawStep;
                                }
                            }
                            prefetchLdrawStep(loadedLdrawStep + 1);
                        })();
                        try {
                            await ldrawLoadPromise;
                        } catch (error) {
                            if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
                                setLoadError(getErrorMessage(error, "LDraw 模型加载失败"));
                            }
                        } finally {
                            ldrawLoadPromise = null;
                            if (!cancelled) setLoading(false);
                        }
                    };

                    root.userData.loadLdrawSteps = loadLdrawSteps;
                } else if (content.modelUrl) {
                    try {
                        if (!GLTFLoader) throw new Error("GLTF 运行时未能加载");
                        const gltf = await new GLTFLoader().loadAsync(content.modelUrl);
                        root = gltf.scene;
                        revealPartsByStep = false;
                        root.traverse((object) => {
                            if (!("isMesh" in object)) return;
                            const mesh = object as import("three").Mesh;
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                        });
                        scene.add(root);
                    } catch (error) {
                        setLoadError(getErrorMessage(error, "3D 模型加载失败"));
                    }
                } else {
                    const demo = createDemoBrickScene(THREE, content.parts, content.steps3d, content.brickInstances);
                    root = demo.root;
                    scene.add(root);
                }

                if (!root) {
                    throw new Error("3D 场景未能构建成功（模型为空）");
                }

                collectDefaultMaterials(root);

                const highlightMaterial = new THREE.MeshStandardMaterial({
                    color: "#f59e0b",
                    emissive: "#7c2d12",
                    emissiveIntensity: 0.18,
                    roughness: 0.38,
                });

                const focusStep = (stepIndex: number, resetCamera = false) => {
                    if (ldrawAssembly) {
                        const contentStep = Math.min(Math.max(stepIndex, 0), content.steps3d.length - 1);
                        const clamped = ldrawStepCount === null
                            ? contentStep
                            : Math.min(contentStep, ldrawStepCount - 1);
                        visibleLdrawStep = clamped;
                        requestedLdrawStep = clamped;
                        for (const [index, stepRoot] of ldrawStepRoots) {
                            stepRoot.visible = index <= clamped;
                        }
                        const ldrawStep = content.steps3d[Math.min(clamped, content.steps3d.length - 1)];
                        if (resetCamera) {
                            applyCameraHint(THREE, camera, controls, ldrawStep?.cameraHint);
                        }
                        const loadLdrawSteps = root?.userData.loadLdrawSteps as (() => Promise<void>) | undefined;
                        void loadLdrawSteps?.();
                        return;
                    }

                    const step = content.steps3d[Math.min(stepIndex, content.steps3d.length - 1)];
                    const visibleParts = new Set<string>();
                    for (let i = 0; i <= stepIndex; i++) {
                        const priorStep = content.steps3d[i];
                        for (const partId of priorStep?.partIds ?? []) visibleParts.add(partId);
                        for (const nodeId of priorStep?.highlightNodeIds ?? []) visibleParts.add(nodeId);
                    }
                    const activeParts = new Set([
                        ...(step?.partIds ?? []),
                        ...(step?.highlightNodeIds ?? []),
                    ]);

                    for (const [mesh, material] of defaultMaterials) {
                        const partId = typeof mesh.userData.partId === "string" ? mesh.userData.partId : mesh.name;
                        const nodeId = typeof mesh.userData.nodeId === "string" ? mesh.userData.nodeId : mesh.name;
                        const shown =
                            !revealPartsByStep || !partId || visibleParts.has(partId) || visibleParts.has(nodeId);
                        mesh.visible = shown;
                        mesh.material = activeParts.has(partId) || activeParts.has(nodeId) ? highlightMaterial : material;
                    }
                    if (resetCamera) {
                        applyCameraHint(THREE, camera, controls, step?.cameraHint);
                    }
                };

                const resize = () => {
                    const width = mount.clientWidth || 640;
                    const height = mount.clientHeight || 420;
                    renderer.setSize(width, height, true);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                };
                resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(mount);
                resize();
                focusStep(activeBuildStepIndexRef.current, true);
                if (ldrawAssembly) {
                    const loadLdrawSteps = root.userData.loadLdrawSteps as (() => Promise<void>) | undefined;
                    await loadLdrawSteps?.();
                    if (cancelled) return;
                }

                const animate = () => {
                    frame = requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                };
                animate();

                state = {
                    cleanup: () => {
                        cleanupScene();
                        cleanupIncompleteScene = null;
                    },
                    focusStep,
                };
                sceneRef.current = state;
            } catch (error) {
                cleanupIncompleteScene?.();
                cleanupIncompleteScene = null;
                if (!cancelled) setLoadError(getErrorMessage(error, "3D 场景初始化失败"));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void setup();

        return () => {
            cancelled = true;
            abortController.abort();
            if (state) state.cleanup();
            else cleanupIncompleteScene?.();
            cleanupIncompleteScene = null;
            if (sceneRef.current === state) sceneRef.current = null;
        };
    }, [content, showBuildPage]);

    useEffect(() => {
        sceneRef.current?.focusStep(activeBuildStepIndex);
    }, [activeBuildStepIndex, showBuildPage]);

    const handleComplete = useCallback(async () => {
        if (!user) {
            promptLogin();
            return;
        }
        setCompleting(true);
        try {
            const res = await fetch(`/api/courses/${courseId}/lessons/${lesson.id}/complete`, {
                method: "POST",
            });
            const data = (await res.json().catch(() => ({}))) as {
                error?: string;
                alreadyCompleted?: boolean;
                courseCompletionState?: "not_complete" | "created" | "already_recorded" | "configuration_error";
            };
            if (!res.ok) throw new Error(data.error || "完成失败");
            setCompleted(true);
            const feedback = getLessonCompletionFeedback(data);
            toast({ title: feedback.title, description: feedback.description });
            onCompleted?.();
        } catch (error) {
            toast({
                title: "无法标记完成",
                description: error instanceof Error ? error.message : undefined,
                variant: "destructive",
            });
        } finally {
            setCompleting(false);
        }
    }, [courseId, lesson.id, onCompleted, promptLogin, toast, user]);

    const goPage = (delta: number) => {
        const next = Math.min(Math.max(clampedPageIndex + delta, 0), flow.length - 1);
        onStepChange(next);
    };

    const enterImmersive = useCallback(async () => {
        const workspace = workspaceRef.current;
        if (!workspace) return;

        setIsImmersive(true);
        if (!workspace.requestFullscreen) {
            toast({
                title: "已进入横向展示",
                description: "将设备横放即可全屏查看课程内容。",
            });
            return;
        }

        nativeFullscreenSessionRef.current = true;
        try {
            await workspace.requestFullscreen();
            try {
                await getScreenOrientation()?.lock?.("landscape");
            } catch {
                toast({
                    title: "已进入全屏",
                    description: "当前浏览器不能自动旋转，请将设备横放。",
                });
            }
        } catch {
            nativeFullscreenSessionRef.current = false;
            toast({
                title: "已进入横向展示",
                description: "当前浏览器不支持页面全屏，请将设备横放。",
            });
        }
    }, [toast]);

    const exitImmersive = useCallback(async () => {
        nativeFullscreenSessionRef.current = false;
        getScreenOrientation()?.unlock?.();
        setIsImmersive(false);
        if (document.fullscreenElement === workspaceRef.current) {
            await document.exitFullscreen().catch(() => undefined);
        }
    }, []);

    const isFinalPage = flow.length > 0 && clampedPageIndex === flow.length - 1;
    const flowControls = (
        <div className={cn(
            "space-y-2 border-t border-border bg-card p-3",
            isImmersive && "p-2",
        )}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        isImmersive && activePage?.kind === "build" && "h-11 px-2",
                    )}
                    disabled={clampedPageIndex === 0}
                    onClick={() => goPage(-1)}
                >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一页
                </Button>
                <span className="min-w-14 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                    {clampedPageIndex + 1} / {flow.length}
                </span>
                {isFinalPage ? (
                    <Button
                        type="button"
                        className={cn(
                            isImmersive && activePage?.kind === "build" && "h-11 px-2",
                        )}
                        disabled={completing || completed}
                        onClick={() => void handleComplete()}
                    >
                        {completing ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-1 h-4 w-4" />
                        )}
                        {completed ? "已完成" : "完成这课"}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        className={cn(
                            isImmersive && activePage?.kind === "build" && "h-11 px-2",
                        )}
                        onClick={() => goPage(1)}
                    >
                        下一页
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                )}
            </div>
            {isFinalPage && hasWorks ? (
                <LessonWorkUpload
                    courseId={courseId}
                    lessonId={lesson.id}
                    lessonTitle={lesson.title}
                />
            ) : null}
        </div>
    );

    return (
        <section
            ref={workspaceRef}
            className={cn(
                "relative flex min-h-0 flex-1 flex-col bg-[hsl(var(--background))]",
                isImmersive &&
                    "fixed inset-0 z-[100] h-dvh w-dvw max-w-none overflow-hidden",
            )}
        >
            {nextSlideImageUrl ? (
                <link rel="preload" as="image" href={nextSlideImageUrl} />
            ) : null}
            {view === "lesson" ? (
                <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="absolute right-2 top-2 z-40 h-11 w-11 bg-card/90 shadow-sm lg:hidden"
                    aria-label={isImmersive ? "退出全屏" : "全屏横向展示"}
                    title={isImmersive ? "退出全屏" : "全屏横向展示"}
                    onClick={() => void (isImmersive ? exitImmersive() : enterImmersive())}
                >
                    {isImmersive ? (
                        <Minimize2 className="h-5 w-5" />
                    ) : (
                        <Maximize2 className="h-5 w-5" />
                    )}
                </Button>
            ) : null}
            {isImmersive ? (
                <div className="absolute inset-0 z-30 hidden flex-col items-center justify-center gap-3 bg-[#0f172a] text-white portrait:flex landscape:hidden lg:hidden">
                    <RotateCw className="h-9 w-9" />
                    <p className="text-sm font-semibold">请将设备横放</p>
                </div>
            ) : null}
            {hasWorks ? (
                <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1.5">
                    <button
                        type="button"
                        onClick={() => setView("lesson")}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors",
                            view === "lesson"
                                ? "bg-[hsl(var(--brand-blue))] text-white"
                                : "text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <Presentation className="h-4 w-4" />
                        课程内容
                    </button>
                    <button
                        type="button"
                        onClick={() => setView("works")}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors",
                            view === "works"
                                ? "bg-[hsl(var(--brand-blue))] text-white"
                                : "text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <Sparkles className="h-4 w-4" />
                        作品
                    </button>
                </div>
            ) : null}

            {view === "works" && hasWorks ? (
                <LessonWorksGallery
                    courseId={courseId}
                    lessonId={lesson.id}
                    lessonTitle={lesson.title}
                />
            ) : null}

            {view === "lesson" && activePage?.kind === "slide" ? (
                <div className={cn(
                    "flex min-h-0 flex-none flex-col bg-[#0f172a] lg:flex-1",
                    isImmersive && "flex-1",
                )}>
                    <div className={cn(
                        "flex min-h-0 flex-none items-center justify-center overflow-hidden p-3 lg:flex-1 lg:p-6",
                        isImmersive && "flex-1 p-2",
                    )}>
                        {activePage.sourceIndex === videoSlide0 && content.videoUrl ? (
                            <video
                                key={content.videoUrl}
                                src={content.videoUrl}
                                controls
                                playsInline
                                className={cn(
                                    "aspect-video h-auto w-full max-w-[900px] rounded-sm bg-black shadow-lg",
                                    isImmersive && "h-full w-full max-w-none object-contain",
                                )}
                            />
                        ) : failedSlides.has(activePage.sourceIndex) ? (
                            <div className="flex max-w-sm flex-col items-center gap-2 rounded-sm border border-dashed border-white/25 bg-white/5 px-6 py-8 text-center">
                                <Presentation className="h-8 w-8 text-white/40" />
                                <p className="text-sm font-semibold text-white/80">本页课件待导入</p>
                                <p className="text-xs leading-relaxed text-white/50">
                                    课件图片加载失败，请检查资源或刷新页面重试。
                                </p>
                            </div>
                        ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={activePage.imageUrl}
                                alt={activePage.title}
                                onError={() =>
                                    setFailedSlides((prev) => {
                                        const next = new Set(prev);
                                        next.add(activePage.sourceIndex);
                                        return next;
                                    })
                                }
                                className={cn(
                                    "h-auto w-full max-w-[900px] rounded-sm bg-white object-contain shadow-lg",
                                    isImmersive && "h-full max-w-none",
                                )}
                            />
                        )}
                    </div>
                    {flowControls}
                </div>
            ) : null}

            {view === "lesson" && activePage?.kind === "video" && content.videoUrl ? (
                <div className="flex min-h-0 flex-1 flex-col bg-black">
                    <div className={cn(
                        "flex min-h-[360px] flex-1 items-center justify-center p-3 max-lg:h-[62dvh] max-lg:flex-none",
                        isImmersive && "min-h-0 p-2 max-lg:h-auto max-lg:flex-1",
                    )}>
                        <video
                            key={content.videoUrl}
                            src={content.videoUrl}
                            controls
                            playsInline
                            className="max-h-full max-w-full rounded-sm"
                        />
                    </div>
                    {flowControls}
                </div>
            ) : null}

            {view === "lesson" && !activePage ? (
                <div className="flex min-h-[420px] flex-1 items-center justify-center bg-muted/20 p-6 text-center">
                    <div className="max-w-sm rounded-sm border border-border bg-card p-5">
                        <Presentation className="mx-auto h-8 w-8 text-muted-foreground" />
                        <h3 className="mt-3 text-base font-bold text-foreground">课程内容暂不可用</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            这节课的在线内容还没有准备好。
                        </p>
                    </div>
                </div>
            ) : null}

            <div className={cn(
                "grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] max-lg:grid-rows-[44dvh_auto] lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-1",
                isImmersive &&
                    "grid-cols-[minmax(0,1fr)_minmax(260px,32vw)] grid-rows-1 max-lg:grid-rows-1",
                !showBuildPage && "hidden",
            )}>
                <div className={cn(
                    "relative min-h-[320px] overflow-hidden bg-[#f8fbff] max-lg:min-h-0",
                    isImmersive && "min-h-0",
                )}>
                    <div ref={mountRef} className="h-full w-full" aria-label="3D 搭建图纸" />
                    {loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-[#f8fbff]/80">
                            <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-xs">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在加载 3D 图纸
                            </div>
                        </div>
                    ) : null}
                    {loadError && !loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-[#f8fbff]/88 p-6">
                            <div className="max-w-sm rounded-sm border border-border bg-card px-4 py-3 text-center shadow-xs">
                                <p className="text-sm font-semibold text-foreground">3D 模型加载失败</p>
                                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                                    {loadError}
                                </p>
                            </div>
                        </div>
                    ) : null}
                    <div className="absolute left-3 top-3 flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="bg-card/90"
                            onClick={() => sceneRef.current?.focusStep(activeBuildStepIndex, true)}
                        >
                            <RotateCcw className="mr-1 h-4 w-4" />
                            视角
                        </Button>
                        <div className="hidden items-center gap-1 rounded-sm border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground md:flex">
                            <ZoomIn className="h-3.5 w-3.5" />
                            拖动旋转 · 滚轮缩放
                        </div>
                    </div>
                    {content.attribution ? (
                        <p className="pointer-events-none absolute bottom-2 left-3 right-3 truncate text-[10px] leading-tight text-muted-foreground/80">
                            {content.attribution}
                        </p>
                    ) : null}
                </div>

                <aside className={cn(
                    "min-h-0 border-t border-border bg-card lg:border-l lg:border-t-0",
                    isImmersive && "overflow-hidden border-l border-t-0",
                )}>
                    <div className="flex h-full flex-col">
                        <div className="border-b border-border px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-[hsl(var(--brand-blue))]">
                                    搭建步骤 {activeBuildStepIndex + 1}/{content.steps3d.length}
                                </p>
                                {completed ? (
                                    <span className="rounded-full bg-[hsl(var(--status-success-surface))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--status-success))]">
                                        已完成
                                    </span>
                                ) : null}
                            </div>
                            <h3 className="mt-1 text-base font-bold text-foreground">
                                {activeStep?.title}
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                {activeStep?.description}
                            </p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                            <h4 className="mb-2 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                <Box className="h-3.5 w-3.5" />
                                本步零件
                            </h4>
                            <ul className="space-y-2">
                                {(activeStep?.partIds ?? []).map((partId) => {
                                    const part = partsById.get(partId);
                                    return (
                                        <li key={partId} className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-2">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <span
                                                    className="h-4 w-4 shrink-0 rounded-sm border border-black/10"
                                                    style={{ backgroundColor: part?.color ?? "#94a3b8" }}
                                                />
                                                <span className="truncate text-sm font-medium text-foreground">
                                                    {part?.name ?? partId}
                                                </span>
                                            </span>
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                x{part?.quantity ?? 1}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        {ldrawEditEnabled && content.ldrawModelUrl ? (
                            <LDrawDebugEditor
                                modelUrl={content.ldrawModelUrl}
                                activeStepIndex={activeBuildStepIndex}
                            />
                        ) : null}
                        {flowControls}
                    </div>
                </aside>
            </div>
        </section>
    );
}

export function UnsupportedLessonWorkspace({ lessonType }: { lessonType: string }) {
    return (
        <div className="flex min-h-[420px] flex-1 items-center justify-center bg-muted/20 p-6 text-center">
            <div className="max-w-sm rounded-sm border border-border bg-card p-5">
                <h3 className="text-base font-bold text-foreground">这个课时类型暂未接入</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    当前课时类型为 {lessonType}。课程数据可以保留，后续接入对应工作区后即可学习。
                </p>
            </div>
        </div>
    );
}
