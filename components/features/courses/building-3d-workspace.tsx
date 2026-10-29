"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import {
    Box,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    Loader2,
    Maximize2,
    Minimize2,
    Package,
    Presentation,
    RotateCcw,
    PartyPopper,
    RotateCw,
    Sparkles,
    Mic,
    Settings2,
    PanelLeftClose,
    PanelLeftOpen,
    X,
    ZoomIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildBuildingLessonFlow } from "@/lib/courses/building-lesson-flow";
import { getLessonCompletionFeedback } from "@/lib/courses/progress";
import { toLessonCompletionToast } from "./lesson-completion-toast";
import type { LessonCompletionResult } from "./lesson-completion-dialog";
import { cn } from "@/lib/utils";
import { resolveAssetDisplayUrl, toForcedAssetProxyUrl } from "@/lib/utils/asset-url";
import { parsePackedLdrawModelText, splitPackedMpd } from "@/lib/utils/ldraw-mpd";
import { prepareLessonBomForCourse } from "@/lib/courses/lesson-materials";
import { createLdrawStepHighlight } from "@/lib/utils/ldraw-step-highlight";
import type { LdrawBom } from "@/lib/utils/ldraw-bom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import { isWorkSubmissionEnabled } from "@/lib/works/capability";
import { PartThumbnail } from "./part-thumbnail";
import { ZoomableSlide } from "./zoomable-slide";
import { useBuildingTapNavigation } from "./use-building-tap-navigation";
import { circle, pill, pillGlass, pillOnDark, pillPrimary, pillQuiet } from "./lesson-control-styles";
import {
    LANDSCAPE_PHONE_QUERY,
    PORTRAIT_PHONE_QUERY,
    shouldAutoEnterImmersive,
    ROTATE_TIP_STORAGE_KEY,
    keyboardPageDelta,
    tapZoneAction,
    OVERLAY_AUTO_HIDE_MS,
    PAGE_INDICATOR_MS,
} from "@/lib/courses/slide-viewer";
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
    createLdrawEdgeRenderer: typeof import("@/lib/utils/ldraw-edges").createLdrawEdgeRenderer;
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

function subscribeToMobileViewport(onChange: () => void) {
    const media = window.matchMedia("(max-width: 1023px)");
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
}

function getMobileViewportSnapshot() {
    return window.matchMedia?.("(max-width: 1023px)").matches ?? false;
}

function getMobileViewportServerSnapshot() {
    return false;
}

function subscribeToOrientation(onChange: () => void) {
    const portrait = window.matchMedia?.(PORTRAIT_PHONE_QUERY);
    const landscape = window.matchMedia?.(LANDSCAPE_PHONE_QUERY);
    portrait?.addEventListener?.("change", onChange);
    landscape?.addEventListener?.("change", onChange);
    return () => {
        portrait?.removeEventListener?.("change", onChange);
        landscape?.removeEventListener?.("change", onChange);
    };
}

/** "portrait" = 竖着拿的手机，"landscape" = 横着拿的手机，"other" = 平板/电脑 */
function getPhoneOrientationSnapshot(): "portrait" | "landscape" | "other" {
    if (window.matchMedia?.(PORTRAIT_PHONE_QUERY).matches) return "portrait";
    if (window.matchMedia?.(LANDSCAPE_PHONE_QUERY).matches) return "landscape";
    return "other";
}

function getPhoneOrientationServerSnapshot(): "portrait" | "landscape" | "other" {
    return "other";
}

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
        // Prefer server-signed /api/assets?...&sig= (see withSignedBuildingLessonVideo).
        // Fall back to forced proxy so video never embeds a permanent CDN URL.
        videoUrl: (() => {
            const raw = typeof content?.videoUrl === "string" ? content.videoUrl.trim() : "";
            if (!raw) return undefined;
            if (raw.startsWith("/api/assets/")) return raw;
            return toForcedAssetProxyUrl(raw) ?? resolveAssetDisplayUrl(raw) ?? raw;
        })(),
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

type PartLine = {
    key: string;
    partId?: string;
    colorCode?: number;
    label: string;
    colorHex: string;
    count: number;
    /** LDraw 官方英文零件名，供老师/家长核对 */
    title?: string;
};

/**
 * 课时 steps3d 常比模型多出末尾的「完成 / 对照检查」步（个别课还多出模型没拆到的搭建步）。
 * 这些步没有新增零件，必须显式给空清单：沿用上一步会让家长把同一批零件配两遍。
 */
const EMPTY_BOM_STEP: LdrawBom["steps"][number] = {
    stepIndex: -1,
    partCount: 0,
    entries: [],
};

function toPartLines(entries: LdrawBom["entries"]): PartLine[] {
    return entries.map((entry) => ({
        key: `${entry.partId}|${entry.colorCode}`,
        partId: entry.partId,
        colorCode: entry.colorCode,
        label: `${entry.colorName}${entry.partName}`,
        colorHex: entry.colorHex,
        count: entry.count,
        title: entry.partDescription || undefined,
    }));
}

function PartLineList({ id, lines, compact = false }: { id?: string; lines: PartLine[]; compact?: boolean }) {
    return (
        <ul id={id} className={cn("grid gap-1.5", compact ? "grid-cols-2 lg:grid-cols-1" : "grid-cols-1")}>
            {lines.map((line) => (
                <li
                    key={line.key}
                    className="flex min-w-0 items-center gap-2 rounded-sm border border-border bg-background px-2 py-1.5"
                    title={line.title}
                >
                    {line.partId && line.colorCode !== undefined ? (
                        <PartThumbnail partId={line.partId} colorCode={line.colorCode} colorHex={line.colorHex} />
                    ) : (
                        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white">
                            <span className="h-7 w-7 rounded-sm border border-black/15" style={{ backgroundColor: line.colorHex }} />
                        </span>
                    )}
                    <span className="min-w-0 flex-1">
                        {/* 零件名较长（如「白色2×2 积木（眼睛）」），换行比截断更有用 */}
                        <span className="block text-xs font-medium leading-snug text-foreground lg:text-[13px]">
                            {line.label}
                        </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                        ×{line.count}
                    </span>
                </li>
            ))}
        </ul>
    );
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
        import("@/lib/utils/ldraw-edges"),
    ]).then(([ldraw, ldrawLine, edges]) => ({
        createLdrawEdgeRenderer: edges.createLdrawEdgeRenderer,
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
    return Promise.allSettled([loadThreeCore(), content.ldrawModelUrl ? loadLdrawRuntime() : content.modelUrl ? loadGltfLoader() : Promise.resolve()]);
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
    navigationSlot,
    voiceControlsSlot,
    mobileHeaderSlot,
    sidebar,
    onViewChange,
}: {
    courseId: number;
    lesson: CourseLessonRow;
    activeStepIndex: number;
    onStepChange: (index: number) => void;
    initialCompleted?: boolean;
    onCompleted?: (result: LessonCompletionResult) => void;
    navigationSlot?: ReactNode;
    voiceControlsSlot?: ReactNode;
    /** 手机顶栏左侧：返回 + 课名（手机上取代页面原来的标题栏） */
    mobileHeaderSlot?: ReactNode | ((context: { view: "lesson" | "works"; onBackToLesson: () => void }) => ReactNode);
    /** 电脑端左侧目录的收起/展开（≥1280px 才有侧栏） */
    sidebar?: { collapsed: boolean; onToggle: () => void };
    onViewChange?: (view: "lesson" | "works") => void;
}) {
    const workspaceRef = useRef<HTMLElement>(null);
    const mountRef = useRef<HTMLDivElement>(null);
    const partsScrollRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneState | null>(null);
    const nativeFullscreenSessionRef = useRef(false);
    const immersiveRequestedRef = useRef(false);
    const immersiveRequestIdRef = useRef(0);
    const immersiveScrollYRef = useRef<number | null>(null);
    const buildControlsButtonRef = useRef<HTMLButtonElement>(null);
    const partsCloseButtonRef = useRef<HTMLButtonElement>(null);
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
    const changeView = (nextView: "lesson" | "works") => {
        setView(nextView);
        const url = new URL(window.location.href);
        if (nextView === "works") url.searchParams.set("view", "works");
        else url.searchParams.delete("view");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    };

    useEffect(() => {
        onViewChange?.(view);
    }, [onViewChange, view]);
    const [failedSlides, setFailedSlides] = useState<Set<number>>(() => new Set());
    const [failedVideos, setFailedVideos] = useState<Set<string>>(() => new Set());
    const [ldrawEditEnabled, setLdrawEditEnabled] = useState(false);
    const [isImmersive, setIsImmersive] = useState(false);
    const [rawBom, setBom] = useState<LdrawBom | null>(null);
    const bom = useMemo(() => rawBom ? prepareLessonBomForCourse(courseId, rawBom) : null, [courseId, rawBom]);
    const [bomLoading, setBomLoading] = useState(false);
    const [modelRetry, setModelRetry] = useState(0);
    const isMobileViewport = useSyncExternalStore(
        subscribeToMobileViewport,
        getMobileViewportSnapshot,
        getMobileViewportServerSnapshot,
    );
    const phoneOrientation = useSyncExternalStore(
        subscribeToOrientation,
        getPhoneOrientationSnapshot,
        getPhoneOrientationServerSnapshot,
    );
    const isPortraitPhone = phoneOrientation === "portrait";
    const [voiceExpanded, setVoiceExpanded] = useState(false);
    const [voiceReady, setVoiceReady] = useState(false);
    const [voiceMediaReady, setVoiceMediaReady] = useState<string | null>(null);
    const [voicePrefetchPending, setVoicePrefetchPending] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<string>("idle");
    const voiceActive = voiceStatus === "listening" || voiceStatus === "processing" || voiceStatus === "starting";
    const [partsDrawerOpen, setPartsDrawerOpen] = useState(false);
    const [buildControlsOpen, setBuildControlsOpen] = useState(false);
    const autoImmersiveRef = useRef(false);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [pageIndicatorVisible, setPageIndicatorVisible] = useState(false);
    const previousOrientationRef = useRef(phoneOrientation);
    const initialLandscapeHandledRef = useRef(false);
    // null = 跟随默认（搭建第一步展开全部零件，后续步骤收起）
    const [allPartsExpanded, setAllPartsExpanded] = useState<boolean | null>(null);
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
    const ldrawModelFileName = useMemo(
        () => (content.ldrawModelUrl ? getLdrawModelFileName(content.ldrawModelUrl) : null),
        [content.ldrawModelUrl],
    );
    // 零件清单在进入搭建区之前就取好，孩子翻到第一步时总数已经在。
    const needsPartList = showBuildPage || upcomingBuildPage !== null;
    // 3D 画面在超出模型步数时停在成品（focusStep 里 clamp），零件清单则给空清单而不是重复上一步。
    const bomStep = bom && bom.steps.length > 0
        ? bom.steps[activeBuildStepIndex] ?? EMPTY_BOM_STEP
        : null;
    const stepPartLines = useMemo<PartLine[]>(() => {
        if (bomStep) return toPartLines(bomStep.entries);

        // 没有模型清单时退回课时 content 里手写的零件；其数量是全课用量，不是本步用量。
        return (activeStep?.partIds ?? []).map((partId) => {
            const part = partsById.get(partId);
            return {
                key: partId,
                label: part?.name ?? partId,
                colorHex: part?.color ?? "#94a3b8",
                count: part?.quantity ?? 1,
            };
        });
    }, [activeStep, bomStep, partsById]);
    const allPartLines = useMemo(() => (bom ? toPartLines(bom.entries) : []), [bom]);
    const allPartsOpen = allPartsExpanded ?? (!isMobileViewport && activeBuildStepIndex === 0);

    const restoreImmersiveScroll = useCallback(() => {
        const scrollY = immersiveScrollYRef.current;
        if (scrollY === null) return;
        immersiveScrollYRef.current = null;
        window.scrollTo?.({ top: scrollY, behavior: "auto" });
    }, []);

    // Every exit path must leave the next fullscreen session with a clear canvas.
    const clearImmersiveState = useCallback(() => {
        immersiveRequestedRef.current = false;
        immersiveRequestIdRef.current += 1;
        nativeFullscreenSessionRef.current = false;
        autoImmersiveRef.current = false;
        setPartsDrawerOpen(false);
        setBuildControlsOpen(false);
        setOverlayVisible(false);
        setPageIndicatorVisible(false);
        getScreenOrientation()?.unlock?.();
        setIsImmersive(false);
    }, []);

    useEffect(() => {
        if (!showBuildPage) {
            setPartsDrawerOpen(false);
            setBuildControlsOpen(false);
        }
    }, [showBuildPage]);

    useEffect(() => {
        if (isImmersive && showBuildPage && partsDrawerOpen) partsCloseButtonRef.current?.focus();
    }, [isImmersive, showBuildPage, partsDrawerOpen]);

    useEffect(() => {
        activeBuildStepIndexRef.current = activeBuildStepIndex;
        if (partsScrollRef.current) partsScrollRef.current.scrollTop = 0;
    }, [activeBuildStepIndex]);

    useEffect(() => {
        setBom(null);
        setBomLoading(false);
        setAllPartsExpanded(null);
    }, [ldrawModelFileName]);

    useEffect(() => {
        // needsPartList 会在翻出搭建区后回到 false，取到清单就别再取第二次。
        if (!ldrawModelFileName || !needsPartList || bom) return;

        const abortController = new AbortController();
        setBomLoading(true);
        void fetch(
            // 模型文件不变时也需更新统计口径，避免 force-cache 继续返回重复的组合件。
            `/api/courses/ldraw-bom?model=${encodeURIComponent(ldrawModelFileName)}&v=2`,
            { cache: "force-cache", signal: abortController.signal },
        )
            .then((response) => (response.ok ? (response.json() as Promise<LdrawBom>) : null))
            .then((data) => {
                if (!abortController.signal.aborted && data && Array.isArray(data.steps)) {
                    setBomLoading(false);
                    setBom(data);
                }
            })
            // 零件清单只是搭建辅助，取不到就退回课时自带的零件字段。
            .catch(() => undefined)
            .finally(() => {
                if (!abortController.signal.aborted) setBomLoading(false);
            });

        return () => abortController.abort();
    }, [bom, ldrawModelFileName, needsPartList]);

    useEffect(() => {
        const restoreView = () => {
            const searchParams = new URLSearchParams(window.location.search);
            setLdrawEditEnabled(searchParams.get("ldrawEdit") === "1");
            setView(hasWorks && searchParams.get("view") === "works" ? "works" : "lesson");
        };
        restoreView();
        window.addEventListener("popstate", restoreView);
        return () => window.removeEventListener("popstate", restoreView);
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
        const runtimeReady = preloadThreeRuntime(content);

        if (content.ldrawModelUrl) {
            const modelFileName = getLdrawModelFileName(content.ldrawModelUrl);
            if (modelFileName) {
                preloadUrl = `/api/courses/ldraw-step?model=${encodeURIComponent(modelFileName)}&step=${upcomingBuildPage.stepIndex}`;
            }
        } else if (content.modelUrl) {
            preloadUrl = resolveAssetDisplayUrl(content.modelUrl) ?? content.modelUrl;
        }

        if (preloadUrl) {
            setVoicePrefetchPending(true);
            void Promise.all([runtimeReady, fetch(preloadUrl, {
                cache: "force-cache",
                signal: abortController.signal,
            }).then((response) => response.ok ? response.arrayBuffer() : undefined)])
                .catch(() => undefined)
                .finally(() => { if (!abortController.signal.aborted) setVoicePrefetchPending(false); });
        }

        return () => { abortController.abort(); setVoicePrefetchPending(false); };
    }, [content, upcomingBuildPage]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (document.fullscreenElement === workspaceRef.current) {
                if (!immersiveRequestedRef.current) {
                    // A request that finished after the user closed the view must not reopen it.
                    void document.exitFullscreen().catch(() => undefined);
                    return;
                }
                nativeFullscreenSessionRef.current = true;
                setIsImmersive(true);
                return;
            }
            if (!nativeFullscreenSessionRef.current) return;

            clearImmersiveState();
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            immersiveRequestedRef.current = false;
            immersiveRequestIdRef.current += 1;
        };
    }, [clearImmersiveState]);

    useEffect(() => {
        if (!isImmersive) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
            getScreenOrientation()?.unlock?.();
            restoreImmersiveScroll();
        };
    }, [isImmersive, restoreImmersiveScroll]);

    useEffect(() => {
        if (!isImmersive) return;
        const exitOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented && !document.fullscreenElement) clearImmersiveState();
        };
        document.addEventListener("keydown", exitOnEscape);
        return () => document.removeEventListener("keydown", exitOnEscape);
    }, [isImmersive, clearImmersiveState]);

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
                // Dev-only, read-only measurements for the active builder canvas.
                if (process.env.NODE_ENV !== "production") {
                    (renderer.domElement as HTMLCanvasElement & { ldrawStats?: () => unknown }).ldrawStats = () => ({
                        calls: renderer.info.render.calls,
                        lines: renderer.info.render.lines,
                        geometries: renderer.info.memory.geometries,
                        renderedFrames,
                        camera: camera.position.toArray(),
                        target: controls.target.toArray(),
                    });
                }

                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.minDistance = 4;
                controls.maxDistance = 16;
                const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
                const stepHighlight = createLdrawStepHighlight({
                    getFaceColor: (code) => (ldrawLoader?.getMaterial(code) as (import("three").Material & { color?: import("three").Color }) | undefined)?.color,
                    reducedMotion: motionPreference.matches,
                    invalidate: requestRender,
                });

                let frame = 0;
                let resizeObserver: ResizeObserver | null = null;
                let disposed = false;
                let renderedFrames = 0;
                function requestRender() {
                    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(renderFrame);
                }
                function renderFrame(time: number) {
                    frame = 0;
                    if (disposed || document.hidden) return;
                    const moving = controls.update();
                    const pulsing = stepHighlight.update(time);
                    renderer.render(scene, camera);
                    renderedFrames += 1;
                    if (moving || pulsing) requestRender();
                }
                const onMotionChange = () => stepHighlight.setReducedMotion(motionPreference.matches);
                const onVisibilityChange = () => {
                    if (document.hidden) {
                        cancelAnimationFrame(frame);
                        frame = 0;
                        stepHighlight.finish();
                    } else requestRender();
                };
                controls.addEventListener("change", requestRender);
                motionPreference.addEventListener("change", onMotionChange);
                document.addEventListener("visibilitychange", onVisibilityChange);
                let edgeRenderer: ReturnType<LoadedLdraw["createLdrawEdgeRenderer"]> | null = null;
                const cleanupScene = () => {
                    if (disposed) return;
                    disposed = true;
                    cancelAnimationFrame(frame);
                    resizeObserver?.disconnect();
                    controls.removeEventListener("change", requestRender);
                    motionPreference.removeEventListener("change", onMotionChange);
                    document.removeEventListener("visibilitychange", onVisibilityChange);
                    controls.dispose();
                    // Restore shared source edge materials before scene disposal.
                    stepHighlight.dispose();
                    disposeObject3D(scene);
                    edgeRenderer?.dispose();
                    scene.clear();
                    if (process.env.NODE_ENV !== "production") {
                        delete (renderer.domElement as HTMLCanvasElement & { ldrawStats?: () => unknown }).ldrawStats;
                    }
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
                if (ldrawLoader && ldrawRuntime) {
                    edgeRenderer = ldrawRuntime.createLdrawEdgeRenderer((code) => ldrawLoader.getMaterial(code));
                }
                const ldrawMaterialsPromise = ldrawLoader
                    ? (async () => {
                        ldrawLoader.addDefaultMaterials();
                        await ldrawLoader.preloadMaterials(ldrawColorUrl);
                        if (!ldrawLoader.getMaterial("71")) {
                            console.warn("LDraw colour table is incomplete (missing code 71)", ldrawColorUrl);
                            if (ldrawColorUrl !== DEFAULT_LDRAW_COLOR_URL) {
                                await ldrawLoader.preloadMaterials(DEFAULT_LDRAW_COLOR_URL);
                            }
                        }
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
                    if (!cancelled) edgeRenderer?.prepare(model);
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
                                stepHighlight.registerStep(nextStep, stepRoot);
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
                    requestRender();
                    if (ldrawAssembly) {
                        const contentStep = Math.min(Math.max(stepIndex, 0), content.steps3d.length - 1);
                        // Keep the content step, not the clamped model step: wrap-up
                        // pages without new geometry must not highlight old pieces.
                        stepHighlight.setStep(contentStep);
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
                    requestRender();
                };
                resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(mount);
                resize();
                // Publish controls before awaiting the first model: step changes
                // during a slow load must update visibility and the current hint.
                state = {
                    cleanup: () => {
                        cleanupScene();
                        cleanupIncompleteScene = null;
                    },
                    focusStep,
                };
                sceneRef.current = state;
                focusStep(activeBuildStepIndexRef.current, true);
                if (ldrawAssembly) {
                    const loadLdrawSteps = root.userData.loadLdrawSteps as (() => Promise<void>) | undefined;
                    await loadLdrawSteps?.();
                    if (cancelled) return;
                }

                requestRender();
            } catch (error) {
                cleanupIncompleteScene?.();
                cleanupIncompleteScene = null;
                if (sceneRef.current === state) sceneRef.current = null;
                state = null;
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
    }, [content, modelRetry, showBuildPage]);

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
                courseProgress?: LessonCompletionResult["courseProgress"];
            };
            if (!res.ok) throw new Error(data.error || "完成失败");
            setCompleted(true);
            if (onCompleted) onCompleted(data);
            else toast(toLessonCompletionToast(getLessonCompletionFeedback({ ...data, courseId })));
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
        if (next !== clampedPageIndex) onStepChange(next);
    };

    const enterImmersive = useCallback(async (options?: { silent?: boolean; keepOrientation?: boolean }) => {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        const silent = options?.silent ?? false;

        const requestId = ++immersiveRequestIdRef.current;
        immersiveRequestedRef.current = true;
        immersiveScrollYRef.current = window.scrollY;
        setIsImmersive(true);
        if (!workspace.requestFullscreen) {
            if (silent) return;
            toast({
                title: "已进入横向展示",
                description: "将设备横放即可全屏查看课程内容。",
            });
            return;
        }

        nativeFullscreenSessionRef.current = true;
        try {
            await workspace.requestFullscreen({ navigationUI: "hide" });
            if (requestId !== immersiveRequestIdRef.current) return;
            try {
                const isDesktopViewport = window.matchMedia?.("(min-width: 1024px)").matches ?? false;
                if (!isDesktopViewport && !options?.keepOrientation) {
                    await getScreenOrientation()?.lock?.("landscape");
                    if (requestId !== immersiveRequestIdRef.current && !immersiveRequestedRef.current) {
                        getScreenOrientation()?.unlock?.();
                    }
                }
            } catch {
                if (requestId !== immersiveRequestIdRef.current) return;
                if (silent) return;
                toast({
                    title: "已进入全屏",
                    description: "当前浏览器不能自动旋转，请将设备横放。",
                });
            }
        } catch {
            if (requestId !== immersiveRequestIdRef.current) return;
            nativeFullscreenSessionRef.current = false;
            // 转屏不算用户点击，浏览器多半不让真全屏；这时安静地用页面内全屏
            if (silent) return;
            toast({
                title: "已进入横向展示",
                description: "当前浏览器不支持页面全屏，请将设备横放。",
            });
        }
    }, [toast]);

    const exitImmersive = useCallback(async () => {
        clearImmersiveState();
        if (document.fullscreenElement === workspaceRef.current) {
            await document.exitFullscreen().catch(() => undefined);
        }
    }, [clearImmersiveState]);

    const isSlidePage = view === "lesson" && (activePage?.kind === "slide" || activePage?.kind === "video");
    // 手机竖屏第一次看课件时轻提示一次「横过来看更清楚」，之后不再打扰
    useEffect(() => {
        if (!isPortraitPhone || !isSlidePage || isImmersive) return;
        try {
            if (window.localStorage.getItem(ROTATE_TIP_STORAGE_KEY)) return;
            window.localStorage.setItem(ROTATE_TIP_STORAGE_KEY, "1");
        } catch {
            return;
        }
        toast({ title: "横过来看更清楚", description: "也可以双指放大、左右滑动翻页。" });
    }, [isImmersive, isPortraitPhone, isSlidePage, toast]);
    // 所有断点的 3D 全屏都把空间交给画布；操作和零件只按需浮在画面上。
    const buildFullscreen = isImmersive && showBuildPage;
    // 沉浸式看课件：只留课件本身，其它界面全藏，点中间呼出控制条
    const slideImmersive = isImmersive && isSlidePage;
    const hideChrome = slideImmersive || buildFullscreen;
    // 只有普通课件图能点按呼出控制条；视频页、完成页、加载失败页一直显示控制条
    const slideTappable =
        activePage?.kind === "slide" &&
        !(activePage.sourceIndex === videoSlide0 && content.videoUrl) &&
        !(clampedPageIndex === flow.length - 1 && activePage.title === "完成本课") &&
        !failedSlides.has(activePage.sourceIndex);
    const navigationShown = overlayVisible || (slideImmersive && !slideTappable);
    const overlayShown = navigationShown || buildFullscreen;

    // 控制条 3 秒后自动隐藏
    useEffect(() => {
        if (!overlayVisible) return;
        const timer = setTimeout(() => setOverlayVisible(false), OVERLAY_AUTO_HIDE_MS);
        return () => clearTimeout(timer);
    }, [overlayVisible, clampedPageIndex]);

    // 翻页后短暂显示页码
    const pageIndicatorKeyRef = useRef(clampedPageIndex);
    useEffect(() => {
        if (pageIndicatorKeyRef.current === clampedPageIndex) return;
        pageIndicatorKeyRef.current = clampedPageIndex;
        if (!isImmersive) return;
        setPageIndicatorVisible(true);
        const timer = setTimeout(() => setPageIndicatorVisible(false), PAGE_INDICATOR_MS);
        return () => clearTimeout(timer);
    }, [clampedPageIndex, isImmersive]);

    const handleImmersiveTap = (xRatio: number, zoomed = false) => {
        if (!hideChrome) return;
        const action = tapZoneAction(xRatio, zoomed);
        if (action === "prev") goPage(-1);
        else if (action === "next") goPage(1);
        else setOverlayVisible((visible) => !visible);
    };

    useBuildingTapNavigation({
        surfaceRef: mountRef,
        enabled: buildFullscreen,
        pageKey: clampedPageIndex,
        onTap: handleImmersiveTap,
    });

    // 打开页面时手机已经横着：直接进入全屏看课件（只做一次，和横过来时一样）
    useEffect(() => {
        if (initialLandscapeHandledRef.current) return;
        if (phoneOrientation === "other") return; // 还没读到真实方向（首屏 SSR 快照）
        if (phoneOrientation === "portrait") {
            initialLandscapeHandledRef.current = true;
            return;
        }
        if (!isSlidePage) return; // 课件还没加载好，等一下
        initialLandscapeHandledRef.current = true;
        if (shouldAutoEnterImmersive({
            wasPortrait: false,
            isFirstLandscapeLoad: true,
            isLandscapePhone: true,
            isImmersive,
            isSlidePage,
        })) {
            autoImmersiveRef.current = true;
            void enterImmersive({ silent: true });
        }
    }, [enterImmersive, isImmersive, isSlidePage, phoneOrientation]);

    // 方案 A：看课件时手机横过来自动全屏，竖回去自动退出（只退自动进入的那次）
    useEffect(() => {
        const previous = previousOrientationRef.current;
        previousOrientationRef.current = phoneOrientation;
        if (previous === phoneOrientation) return;
        if (shouldAutoEnterImmersive({
            wasPortrait: previous === "portrait",
            isLandscapePhone: phoneOrientation === "landscape",
            isImmersive,
            isSlidePage,
        })) {
            autoImmersiveRef.current = true;
            void enterImmersive({ silent: true });
            return;
        }
        if (phoneOrientation === "portrait" && autoImmersiveRef.current && isImmersive) {
            void exitImmersive();
        }
    }, [enterImmersive, exitImmersive, isImmersive, isSlidePage, phoneOrientation]);

    // 键盘 ← / → 翻页（在输入框里打字时不翻）
    const goPageRef = useRef(goPage);
    goPageRef.current = goPage;
    useEffect(() => {
        if (view !== "lesson") return;
        const onKeyDown = (event: KeyboardEvent) => {
            const delta = keyboardPageDelta(event);
            if (delta === 0) return;
            event.preventDefault();
            goPageRef.current(delta);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [view]);

    const isFinalPage = flow.length > 0 && clampedPageIndex === flow.length - 1;
    const activeVoiceMedia = activePage?.kind === "video" || (activePage?.kind === "slide" && activePage.sourceIndex === videoSlide0)
        ? content.videoUrl : activePage?.kind === "slide" ? activePage.imageUrl : null;
    const voiceCourseReady = view === "lesson" && !bomLoading && !voicePrefetchPending && (
        showBuildPage ? !loading && !loadError : !!activeVoiceMedia && voiceMediaReady === activeVoiceMedia
    );
    const pageControls = (
            <div className={cn("mx-auto flex w-full max-w-2xl items-center justify-between gap-3", buildFullscreen && "[&_button]:h-11 [&_button]:px-3")}>
                <button
                    type="button"
                    className={cn(pill, pillQuiet)}
                    disabled={clampedPageIndex === 0}
                    onClick={() => goPage(-1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                </button>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {buildFullscreen ? `${clampedPageIndex + 1} / ${flow.length}` : `课程 ${clampedPageIndex + 1}/${flow.length} 页`}
                </span>
                {isFinalPage ? (
                    <button
                        type="button"
                        className={cn(pill, pillPrimary)}
                        disabled={completing || completed}
                        onClick={() => void handleComplete()}
                    >
                        {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {completed ? "已完成" : "完成本课"}
                    </button>
                ) : (
                    <button type="button" className={cn(pill, pillPrimary)} onClick={() => goPage(1)}>
                        下一页
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </div>
    );
    const flowControls = (
        <div className={cn(
            "relative z-30 shrink-0 border-t border-border/60 bg-background/90 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md",
            !isImmersive && (showBuildPage
                ? "max-lg:sticky max-lg:bottom-0"
                : "max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:right-0"),
        )}>
            {pageControls}
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
            {isImmersive && !buildFullscreen ? (
                <div className="absolute inset-0 z-30 hidden flex-col items-center justify-center gap-3 bg-[#0f172a] text-white portrait:flex landscape:hidden lg:hidden">
                    <RotateCw className="h-9 w-9" />
                    <p className="text-sm font-semibold">请将设备横放</p>
                </div>
            ) : null}
            {hideChrome ? (
                <>
                    {/* 沉浸式控制条：顶部退出 + 页码；底部上一页/下一页 */}
                    <div
                        data-testid="immersive-overlay"
                        data-visible={overlayShown ? "true" : "false"}
                        className={cn(
                            "pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))] text-white transition-opacity duration-200",
                            overlayShown ? "opacity-100" : "opacity-0",
                            buildFullscreen && "bg-none from-transparent pb-0 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]",
                        )}
                    >
                        <button
                            type="button"
                            aria-label="关闭全屏"
                            className={cn(
                                pill, pillOnDark, circle,
                                buildFullscreen && "h-11 w-11",
                                (overlayShown) && "pointer-events-auto",
                            )}
                            onClick={() => { setOverlayVisible(false); void exitImmersive(); }}
                        >
                            <X className="h-5 w-5" />
                        </button>
                        {buildFullscreen ? (
                            <button
                                ref={buildControlsButtonRef}
                                type="button"
                                aria-expanded={buildControlsOpen}
                                aria-controls="building-immersive-controls"
                                className={cn(pill, pillGlass, "pointer-events-auto h-11")}
                                onClick={() => {
                                    setPartsDrawerOpen(false);
                                    setOverlayVisible(true);
                                    setBuildControlsOpen((open) => !open);
                                }}
                            >
                                <Settings2 className="h-4 w-4" />搭建操作
                            </button>
                        ) : <span className={cn(pill, pillOnDark, "pointer-events-none tabular-nums")}>
                            {clampedPageIndex + 1} / {flow.length}
                        </span>}
                    </div>
                    {buildFullscreen && buildControlsOpen ? (
                        <div
                            id="building-immersive-controls"
                            role="region"
                            aria-label="搭建操作"
                            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[calc(max(0.5rem,env(safe-area-inset-top))+3.25rem)] z-50 max-h-[calc(100%-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[min(24rem,calc(100%-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] space-y-3 overflow-y-auto rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-md"
                        >
                            <p className="text-center text-sm tabular-nums text-muted-foreground">{clampedPageIndex + 1} / {flow.length}</p>
                            <p className="text-center text-xs text-muted-foreground">点左右翻页 · 点中间显示按钮 · 拖动旋转</p>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <button
                                    type="button"
                                    className={cn(pill, pillQuiet, "h-11 px-3")}
                                    aria-controls="building-3d-step-parts"
                                    aria-expanded={partsDrawerOpen}
                                    onClick={() => { setBuildControlsOpen(false); setPartsDrawerOpen(true); }}
                                >
                                    <Box className="h-4 w-4" />本步零件{bomStep ? ` ${bomStep.partCount} 块` : ""}
                                </button>
                                <button type="button" className={cn(pill, pillQuiet, "h-11 px-3")} onClick={() => sceneRef.current?.focusStep(activeBuildStepIndex, true)}>
                                    <RotateCcw className="h-4 w-4" />视角
                                </button>
                            </div>
                            {isFinalPage && hasWorks ? (
                                <button type="button" className={cn(pill, pillQuiet, "h-11 w-full")} onClick={() => void exitImmersive()}>
                                    退出全屏上传作品
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {hideChrome ? (
                        <div
                            data-testid="immersive-navigation"
                            data-visible={navigationShown ? "true" : "false"}
                            aria-hidden={!navigationShown}
                            inert={!navigationShown}
                            className={cn(
                                "pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6 transition-opacity duration-200",
                                navigationShown ? "opacity-100" : "opacity-0",
                            )}
                        >
                            <button
                                type="button"
                                disabled={clampedPageIndex === 0}
                                className={cn(pill, pillOnDark, "h-11", navigationShown && "pointer-events-auto")}
                                onClick={() => goPage(-1)}
                            >
                                <ChevronLeft className="h-4 w-4" />上一页
                            </button>
                            {isFinalPage ? (
                                <button
                                    type="button"
                                    disabled={completing || completed}
                                    className={cn(pill, pillPrimary, "h-11", navigationShown && "pointer-events-auto")}
                                    onClick={() => void handleComplete()}
                                >
                                    <Check className="h-4 w-4" />{completed ? "已完成" : "完成本课"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className={cn(pill, pillPrimary, "h-11", navigationShown && "pointer-events-auto")}
                                    onClick={() => goPage(1)}
                                >
                                    下一页<ChevronRight className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ) : null}
                    {pageIndicatorVisible && !navigationShown ? (
                        <div data-testid="page-indicator" className={cn(pill, pillOnDark, "pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 tabular-nums animate-in fade-in")}>
                            {clampedPageIndex + 1} / {flow.length}
                        </div>
                    ) : null}
                </>
            ) : null}
            <div className={cn("relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background px-3 max-md:px-2", hideChrome && "hidden")}>
                {sidebar && view === "lesson" ? (
                    <button
                        type="button"
                        data-testid="sidebar-toggle"
                        aria-label={sidebar.collapsed ? "展开目录" : "收起目录"}
                        title={sidebar.collapsed ? "展开目录" : "收起目录"}
                        className={cn(pill, pillQuiet, "hidden px-3 xl:inline-flex")}
                        onClick={sidebar.onToggle}
                    >
                        {sidebar.collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        {sidebar.collapsed ? "展开目录" : "收起目录"}
                    </button>
                ) : null}
                {mobileHeaderSlot ? <div className="flex min-w-0 flex-1 items-center md:max-w-[50%] md:flex-none">{typeof mobileHeaderSlot === "function" ? mobileHeaderSlot({ view, onBackToLesson: () => changeView("lesson") }) : mobileHeaderSlot}</div> : null}
                {hasWorks && view === "lesson" ? (
                    <div className="ml-3 flex shrink-0 items-center gap-2 max-md:ml-0 max-md:gap-1.5">
                    <button
                        type="button"
                        onClick={() => changeView("lesson")}
                        className={cn(pill, pillPrimary, "max-md:hidden")}
                        aria-pressed={true}
                    >
                        <Presentation className="h-4 w-4" />
                        课程内容
                    </button>
                    <button
                        type="button"
                        onClick={() => { void exitImmersive(); changeView("works"); }}
                        className={cn(pill, "text-muted-foreground hover:bg-foreground/[0.06]")}
                    >
                        <Sparkles className="h-4 w-4 max-md:hidden" />
                        作品
                    </button>
                    </div>
                ) : null}
                {view === "lesson" && content.ldrawModelUrl ? (
                    <Link
                        href={`/courses/${courseId}/lessons/${lesson.id}/parts`}
                        prefetch={false}
                        aria-label="本课零件清单"
                        title="本课零件清单"
                        className={cn(pill, "max-md:px-2 text-muted-foreground hover:bg-foreground/[0.06]")}
                    >
                        <Package className="h-4 w-4 max-md:hidden" /><span className="md:hidden">零件</span><span className="max-md:hidden">零件清单</span>
                    </Link>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-2 max-md:gap-1.5">
                    {view === "works" ? (
                        <button type="button" className={cn(pill, pillQuiet)} onClick={() => changeView("lesson")}>
                            <Presentation className="h-4 w-4" />回到课程
                        </button>
                    ) : null}
                    {view === "lesson" && voiceControlsSlot ? (
                        <span className="inline-flex h-10 w-[76px] shrink-0 max-md:w-10" data-voice-entry-slot>
                            <button
                                type="button"
                                data-testid={voiceReady || voiceActive ? "voice-toggle" : undefined}
                                aria-label={voiceReady || voiceActive ? (voiceExpanded ? "收起语音搭建" : "语音搭建") : "语音设置"}
                                title={voiceReady || voiceActive ? "语音搭建" : "语音设置"}
                                aria-pressed={voiceExpanded}
                                className={cn(pill, "relative w-full px-3 max-md:px-0", voiceActive ? pillPrimary : pillQuiet, voiceExpanded && !voiceActive && "bg-foreground/15 ring-1 ring-foreground/20")}
                                onClick={() => setVoiceExpanded((open) => !open)}
                            >
                                {voiceReady || voiceActive ? <Mic className="h-4 w-4" /> : <Settings2 className="h-4 w-4" aria-hidden="true" />}
                                <span className="max-md:hidden">语音</span>
                                {voiceActive ? <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400 ring-2 ring-background" /> : null}
                            </button>
                        </span>
                    ) : null}
                    {view === "lesson" && navigationSlot ? (
                        <div className="hidden md:block" data-desktop-lesson-navigation>
                            {isValidElement(navigationSlot)
                                ? cloneElement(navigationSlot as ReactElement<{ className?: string }>, {
                                    // 电脑端左侧目录展开时，顶栏的「目录」按钮重复了，藏起来
                                    className: sidebar && !sidebar.collapsed ? "xl:hidden" : undefined,
                                })
                                : navigationSlot}
                        </div>
                    ) : null}
                    {view === "lesson" ? (
                        <button
                            type="button"
                            className={cn(pill, pillQuiet, circle)}
                            aria-label={isImmersive ? "退出全屏" : "全屏横向展示"}
                            title={isImmersive ? "退出全屏" : "全屏横向展示"}
                            onClick={() => void (isImmersive ? exitImmersive() : enterImmersive())}
                        >
                            {isImmersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                    ) : null}
                </div>
            </div>

            {/* 沉浸式时只藏起来不卸载，正在进行的语音搭建不中断 */}
            {view === "lesson" ? (
                <div data-voice-slot-wrapper className={cn("absolute right-3 top-14 z-50 w-[min(26rem,calc(100%-1.5rem))] overflow-hidden rounded-lg border border-border bg-background shadow-lg", (hideChrome || !voiceExpanded) && "hidden")}>
                    {isValidElement(voiceControlsSlot)
                        ? cloneElement(voiceControlsSlot as ReactElement<{ onStatusChange?: (status: string) => void; onAvailabilityChange?: (ready: boolean) => void; courseReady?: boolean }>, { onStatusChange: setVoiceStatus, onAvailabilityChange: setVoiceReady, courseReady: voiceCourseReady })
                        : voiceControlsSlot}
                </div>
            ) : null}

            {view === "works" && hasWorks ? (
                <LessonWorksGallery
                    courseId={courseId}
                    lessonId={lesson.id}
                    lessonTitle={lesson.title}
                />
            ) : null}

            <div className={cn("flex min-h-0 flex-1 flex-col", view === "works" && "hidden", view === "lesson" && !isImmersive && !showBuildPage && !(isFinalPage && hasWorks) && "max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))]")}>
            {view === "lesson" && (activePage?.kind === "slide" || activePage?.kind === "video") ? (() => {
                const videoUrl = activePage.kind === "video" || activePage.sourceIndex === videoSlide0
                    ? content.videoUrl
                    : undefined;
                const failed = videoUrl ? failedVideos.has(videoUrl) : activePage.kind === "slide" && failedSlides.has(activePage.sourceIndex);
                const retry = () => {
                    if (videoUrl) {
                        setFailedVideos((previous) => { const next = new Set(previous); next.delete(videoUrl); return next; });
                    } else if (activePage.kind === "slide") {
                        setFailedSlides((previous) => { const next = new Set(previous); next.delete(activePage.sourceIndex); return next; });
                    }
                };
                return (
                    <div className={cn(
                        "flex min-h-0 flex-none flex-col items-center justify-center bg-[#0f172a] p-3 lg:flex-1 lg:p-6",
                        isImmersive && "flex-1 p-0 lg:p-0 bg-black",
                        // 方案 B：竖屏手机上课件占满剩余高度
                        isPortraitPhone && !isImmersive && "flex-1 p-1",
                    )}>
                        <div
                            aria-label="课程媒体"
                            className={cn(
                                "relative aspect-video w-full max-w-[900px] overflow-hidden rounded-sm lg:aspect-auto lg:h-full",
                                isImmersive && "h-full max-w-none rounded-none",
                                isPortraitPhone && !isImmersive && "aspect-auto min-h-[208px] flex-1",
                            )}
                        >
                            {failed ? (
                                <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-y-auto bg-white/5 p-3 text-center text-white">
                                    <p className="text-sm font-semibold">{videoUrl ? "视频加载失败" : "课件图片加载失败"}</p>
                                    <p className="text-xs leading-relaxed text-white/70">请重试，或先继续下一页。</p>
                                    <Button type="button" variant="outline" className="h-11 shrink-0 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={retry}>重试</Button>
                                </div>
                            ) : videoUrl ? (
                                <video
                                    key={videoUrl}
                                    src={videoUrl}
                                    controls
                                    playsInline
                                    onLoadedData={() => setVoiceMediaReady(videoUrl)}
                                    onError={() => setFailedVideos((previous) => new Set(previous).add(videoUrl))}
                                    className="absolute inset-0 h-full w-full bg-black object-contain"
                                />
                            ) : activePage.kind === "slide" && isFinalPage && activePage.title === "完成本课" ? (
                                // 课件最后一页是老师口吻的「授课完毕」，在线学习时换成学生视角的完成页，原课件不动。
                                <div data-testid="building-final-page" className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-gradient-to-b from-[#1e293b] to-[#0f172a] p-4 text-center text-white">
                                    {content.finishedImageUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={content.finishedImageUrl} alt={`${lesson.title}成品`} className="max-h-[45%] max-w-[70%] rounded-sm bg-white object-contain p-2" />
                                    ) : (
                                        <PartyPopper className="h-12 w-12 text-amber-300" aria-hidden />
                                    )}
                                    <p className="text-2xl font-bold sm:text-3xl">{completed ? "这节课你已完成！" : "你完成啦！"}</p>
                                    <p className="text-sm text-white/75">{completed ? "可以去学下一课，或再看看作品。" : "点下方「完成本课」，记下这次的进步。"}</p>
                                </div>
                            ) : activePage.kind === "slide" ? (
                                <ZoomableSlide
                                    key={activePage.imageUrl}
                                    src={activePage.imageUrl}
                                    alt={activePage.title}
                                    onLoad={() => setVoiceMediaReady(activePage.imageUrl)}
                                    onError={() => setFailedSlides((previous) => new Set(previous).add(activePage.sourceIndex))}
                                    onSwipe={(delta) => goPage(delta)}
                                    onTap={slideImmersive ? handleImmersiveTap : undefined}
                                />
                            ) : null}
                        </div>
                    </div>
                );
            })() : null}

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
                "grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_272px] lg:grid-rows-1",
                // 手机把剩余高度给画布，零件区只占内容高度，避免 auto 行被撑出空白。
                !isImmersive && "max-lg:grid-rows-[minmax(220px,1fr)_auto]",
                isImmersive &&
                    "grid-cols-[minmax(0,1fr)_minmax(260px,32vw)] grid-rows-1 max-lg:grid-rows-1",
                buildFullscreen && "relative grid-cols-1 grid-rows-1 lg:grid-cols-1 max-lg:grid-rows-1",
                !showBuildPage && "hidden",
            )}>
                <div className={cn(
                    "relative min-h-[320px] overflow-hidden bg-[#f8fbff] max-lg:min-h-0",
                    isImmersive && "min-h-0",
                )}>
                    {/* 手机画布跟随网格尺寸，避免 canvas 的旧像素高度反过来撑大页面。 */}
                    <div
                        ref={mountRef}
                        className={cn("h-full w-full", !isImmersive && "max-lg:absolute max-lg:inset-0")}
                        aria-label="3D 搭建图纸"
                    />
                    {loading ? (
                        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#f8fbff]/80">
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
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-3 h-11"
                                    onClick={() => {
                                        setLoadError(null);
                                        setModelRetry((value) => value + 1);
                                    }}
                                >
                                    重试
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    <div className={cn("absolute left-3 top-3 flex gap-2", buildFullscreen && "hidden")}>
                        <button
                            type="button"
                            className={cn(pill, pillGlass)}
                            onClick={() => sceneRef.current?.focusStep(activeBuildStepIndex, true)}
                        >
                            <RotateCcw className="h-4 w-4" />
                            视角
                        </button>
                        {isMobileViewport && !isImmersive ? (
                            <button
                                type="button"
                                className={cn(pill, pillGlass)}
                                data-testid="build-fullscreen"
                                onClick={() => void enterImmersive({ keepOrientation: true })}
                            >
                                <Maximize2 className="h-4 w-4" />
                                全屏
                            </button>
                        ) : null}
                        <div className="hidden items-center gap-1 rounded-sm border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground [@media(min-width:768px)_and_(pointer:fine)]:flex">
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

                <aside
                    data-testid="build-parts-panel"
                    data-drawer={buildFullscreen ? (partsDrawerOpen ? "open" : "closed") : undefined}
                    className={cn(
                        "min-h-0 border-t border-border bg-card lg:border-l lg:border-t-0",
                        // 全屏时完全收起，打开后才以可滚动浮层显示，不给画布预留行或列。
                        buildFullscreen &&
                            "absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 max-h-[min(65%,calc(100%-5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(24rem,calc(100%-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] flex-col overflow-hidden rounded-lg border shadow-lg lg:border-t",
                        buildFullscreen && (partsDrawerOpen ? "flex" : "hidden"),
                    )}
                >
                    {buildFullscreen ? (
                        <button
                            ref={partsCloseButtonRef}
                            type="button"
                            aria-expanded={partsDrawerOpen}
                            aria-controls="building-3d-step-parts"
                            onClick={() => { setPartsDrawerOpen(false); buildControlsButtonRef.current?.focus(); }}
                            className="flex min-h-11 w-full shrink-0 items-center justify-between gap-2 border-b border-border px-3 text-sm font-semibold text-foreground"
                        >
                            收起零件<ChevronDown className="h-4 w-4" />
                        </button>
                    ) : null}
                    <div className={cn(
                        "flex h-full min-h-0 flex-col",
                        !isImmersive && "max-lg:h-auto max-lg:max-h-[min(28dvh,14rem)]",
                        buildFullscreen && !partsDrawerOpen && "hidden",
                    )}>
                        {(() => {
                            const desc = activeStep?.description?.trim();
                            const isGeneric = !desc || desc.includes("按照三维示范") || desc.includes("添加本步零件") || desc === activeStep?.title;
                            const hasCustomTitle = activeStep?.title && !/^搭建第\s*\d+\s*步$/.test(activeStep.title);
                            return (
                                <div className="shrink-0 border-b border-border px-3 py-2 lg:px-3.5 lg:py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                            <h3 className="text-sm font-bold text-foreground">
                                                {hasCustomTitle ? activeStep.title : `搭建 ${activeBuildStepIndex + 1}/${content.steps3d.length} 步`}
                                            </h3>
                                            {hasCustomTitle ? <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                                搭建 {activeBuildStepIndex + 1}/{content.steps3d.length} 步
                                            </span> : null}
                                        </div>
                                        {completed ? (
                                            <span className="rounded-full bg-[hsl(var(--status-success-surface))] px-2 py-0.5 text-xs font-semibold text-[hsl(var(--status-success))]">
                                                已完成
                                            </span>
                                        ) : null}
                                    </div>
                                    {!isGeneric ? (
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            {desc}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })()}
                        <div ref={partsScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 lg:px-4 lg:py-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <h4 className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                    <Box className="h-3.5 w-3.5" />
                                    本步零件
                                    {bomStep ? (
                                        <span className="ml-1 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                                            {bomStep.partCount} 块
                                        </span>
                                    ) : null}
                                </h4>
                                {content.ldrawModelUrl && stepPartLines.length > 0 ? (
                                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                        <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] border-2 border-current" />
                                        清晰轮廓为本步新增
                                    </span>
                                ) : null}
                            </div>
                            {stepPartLines.length > 0 ? (
                                <PartLineList id="building-3d-step-parts" lines={stepPartLines} compact={!isImmersive} />
                            ) : (
                                <p className="rounded-sm border border-dashed border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                                    {bomStep
                                        ? "这一步模型里没有新增零件，照图纸检查一下已经搭好的部分。"
                                        : bomLoading ? "正在准备零件清单…" : "这一课的零件清单暂时看不到，先照 3D 图纸搭。"}
                                </p>
                            )}

                            {bom && allPartLines.length > 0 ? (
                                <div className="mt-3 rounded-sm border border-border bg-background">
                                    <button
                                        type="button"
                                        onClick={() => setAllPartsExpanded(!allPartsOpen)}
                                        aria-expanded={allPartsOpen}
                                        aria-controls="building-3d-all-parts"
                                        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                                    >
                                        <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                            <Package className="h-3.5 w-3.5" />
                                            全部零件
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-foreground">
                                            {bom.kindCount} 种 · {bom.partCount} 块
                                            <ChevronDown
                                                className={cn(
                                                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                                    allPartsOpen && "rotate-180",
                                                )}
                                            />
                                        </span>
                                    </button>
                                    {allPartsOpen ? (
                                        <div className="border-t border-border px-3 py-2">
                                            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                                                开始前先照这份清单把零件找齐，搭起来更顺。
                                                <Link
                                                    href={`/courses/${courseId}/lessons/${lesson.id}/parts`}
                                                    prefetch={false}
                                                    className="ml-1 font-semibold text-[hsl(var(--brand-blue))] hover:underline"
                                                >
                                                    单独打开清单页
                                                </Link>
                                            </p>
                                            <PartLineList id="building-3d-all-parts" lines={allPartLines} />
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        {ldrawEditEnabled && content.ldrawModelUrl ? (
                            <LDrawDebugEditor
                                modelUrl={content.ldrawModelUrl}
                                activeStepIndex={activeBuildStepIndex}
                            />
                        ) : null}
                    </div>
                </aside>
            </div>
            </div>
            {view === "lesson" && isFinalPage && hasWorks && !buildFullscreen ? (
                <div className={cn("shrink-0 border-t border-border bg-background px-3 py-3 [&_button]:min-h-11", !isImmersive && !showBuildPage && "max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))]")}>
                    <LessonWorkUpload
                        courseId={courseId}
                        lessonId={lesson.id}
                        lessonTitle={lesson.title}
                    />
                </div>
            ) : null}
            {view === "lesson" && activePage && !hideChrome ? flowControls : null}
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
