"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, ChevronLeft, ChevronRight, FileText, Film, Loader2, PlayCircle, Presentation, RotateCcw, Sparkles, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveAssetDisplayUrl } from "@/lib/utils/asset-url";
import { loadPackedLdrawModel } from "@/lib/utils/ldraw-mpd";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import type {
    Building3DBrickInstance,
    Building3DLessonContent,
    Building3DPart,
    Building3DStep,
    CourseLessonRow,
} from "@/lib/courses/types";

type ThreeModule = typeof import("three");

type LoadedThree = {
    THREE: ThreeModule;
    OrbitControls: typeof import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;
    GLTFLoader: typeof import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoader;
    LDrawLoader: typeof import("three/examples/jsm/loaders/LDrawLoader.js").LDrawLoader;
    LDrawConditionalLineMaterial: typeof import("three/examples/jsm/materials/LDrawConditionalLineMaterial.js").LDrawConditionalLineMaterial;
};

const DEFAULT_LDRAW_COLOR_URL = "/courses/ldraw/LDConfig.ldr";

// 「上传作品」入口较重（含项目上下文 + 作品提交弹窗），仅在有背书项目的课时按需加载。
const LessonWorkUpload = dynamic(
    () => import("@/components/features/courses/lesson-work-upload").then((m) => m.LessonWorkUpload),
    { ssr: false },
);
// 「作品」Tab 画廊：就地展示这一课的作品，仅在有背书项目时按需加载。
const LessonWorksGallery = dynamic(
    () => import("@/components/features/courses/lesson-works-gallery").then((m) => m.LessonWorksGallery),
    { ssr: false },
);

type SceneState = {
    cleanup: () => void;
    focusStep: (stepIndex: number) => void;
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
        worksProjectId:
            typeof content?.worksProjectId === "number" && Number.isFinite(content.worksProjectId)
                ? content.worksProjectId
                : undefined,
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

async function loadThree(): Promise<LoadedThree> {
    const [THREE, controls, gltf, ldraw, ldrawLine] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/loaders/LDrawLoader.js"),
        import("three/examples/jsm/materials/LDrawConditionalLineMaterial.js"),
    ]);

    return {
        THREE,
        OrbitControls: controls.OrbitControls,
        GLTFLoader: gltf.GLTFLoader,
        LDrawLoader: ldraw.LDrawLoader,
        LDrawConditionalLineMaterial: ldrawLine.LDrawConditionalLineMaterial,
    };
}

/**
 * 把 LDrawLoader 加载出的模型摆正、缩放并落到地面：
 * LDraw 坐标系 +Y 朝下且单位很大，需绕 X 翻 180° 再按包围盒缩放到约 4 个单位。
 */
function prepareLdrawModel(THREE: ThreeModule, model: import("three").Group, floorY: number) {
    model.rotation.x = Math.PI;
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(4 / maxDim);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y += floorY - scaledBox.min.y;

    model.traverse((object) => {
        const mesh = object as import("three").Mesh;
        if ((mesh as { isMesh?: boolean }).isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
    });

    return model;
}

function applyCameraHint(
    THREE: ThreeModule,
    camera: import("three").PerspectiveCamera,
    controls: import("three/examples/jsm/controls/OrbitControls.js").OrbitControls,
    hint: Building3DStep["cameraHint"],
) {
    const positions = {
        front: new THREE.Vector3(0, 4, 9),
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
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<SceneState | null>(null);
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(initialCompleted);
    const activeStepIndexRef = useRef(activeStepIndex);
    const content = useMemo(() => normalizeBuildingContent(lesson), [lesson]);
    const partsById = useMemo(() => partMap(content.parts), [content.parts]);
    const activeStep = content.steps3d[Math.min(activeStepIndex, content.steps3d.length - 1)] ?? content.steps3d[0];

    const hasSlideImages = Boolean(content.slideImageUrls?.length);
    const hasVideo = Boolean(content.videoUrl);
    // 「课件」Tab：有 PPT 图就用翻页器，否则只有 PDF 时回退内嵌 PDF。
    const hasSlides = hasSlideImages || Boolean(content.slidesPdfUrl);
    // 独立「动画」Tab 仅在没有 PPT 图（视频无处安放）时作为兜底出现。
    const standaloneVideo = hasVideo && !hasSlideImages;
    const slideCount = content.slideImageUrls?.length ?? 0;
    // videoSlideIndex 为 1 基，转 0 基；越界视为没有内嵌视频页。
    const videoSlide0 =
        content.videoSlideIndex && content.videoSlideIndex >= 1 && content.videoSlideIndex <= slideCount
            ? content.videoSlideIndex - 1
            : -1;
    const hasWorks = Boolean(content.worksProjectId);
    const [view, setView] = useState<"build" | "video" | "slides" | "works">(
        hasSlides ? "slides" : standaloneVideo ? "video" : "build",
    );
    const [slideIndex, setSlideIndex] = useState(0);
    const [failedSlides, setFailedSlides] = useState<Set<number>>(() => new Set());
    const currentSlide = Math.min(slideIndex, Math.max(slideCount - 1, 0));

    useEffect(() => {
        activeStepIndexRef.current = activeStepIndex;
    }, [activeStepIndex]);

    useEffect(() => {
        let cancelled = false;
        let state: SceneState | null = null;

        async function setup() {
            const mount = mountRef.current;
            if (!mount) return;
            setLoading(true);
            setLoadError(null);
            try {
                const { THREE, OrbitControls, GLTFLoader, LDrawLoader, LDrawConditionalLineMaterial } =
                    await loadThree();
                if (cancelled || !mountRef.current) return;

                const FLOOR_Y = -0.18;

                const scene = new THREE.Scene();
                scene.background = new THREE.Color("#f8fbff");

                const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
                const renderer = new THREE.WebGLRenderer({
                    antialias: true,
                    alpha: false,
                    preserveDrawingBuffer: true,
                });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                renderer.shadowMap.enabled = true;
                mount.appendChild(renderer.domElement);

                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.minDistance = 4;
                controls.maxDistance = 16;

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
                // LDraw 模型用模型内 `0 STEP` 元数据驱动分步显隐（buildingStep）。
                let ldrawNumSteps = 0;

                if (content.ldrawModelUrl) {
                    try {
                        const ldrawLoader = new LDrawLoader();
                        ldrawLoader.smoothNormals = true;
                        ldrawLoader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
                        const colorUrl =
                            resolveAssetDisplayUrl(content.ldrawColorUrl ?? DEFAULT_LDRAW_COLOR_URL)
                            ?? DEFAULT_LDRAW_COLOR_URL;
                        const model = await loadPackedLdrawModel(
                            ldrawLoader,
                            content.ldrawModelUrl,
                            colorUrl,
                        );
                        if (cancelled || !mountRef.current) return;
                        prepareLdrawModel(THREE, model, FLOOR_Y);
                        root = model;
                        revealPartsByStep = false;
                        const parsedStepCount = model.userData.numBuildingSteps;
                        ldrawNumSteps =
                            typeof parsedStepCount === "number" && parsedStepCount > 0
                                ? parsedStepCount
                                : content.steps3d.length;
                        scene.add(root);
                    } catch (error) {
                        setLoadError(getErrorMessage(error, "LDraw 模型加载失败"));
                    }
                } else if (content.modelUrl) {
                    try {
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

                const defaultMaterials = new Map<
                    import("three").Mesh,
                    import("three").Material | import("three").Material[]
                >();
                root.traverse((object) => {
                    if (!("isMesh" in object)) return;
                    const mesh = object as import("three").Mesh;
                    defaultMaterials.set(mesh, mesh.material);
                });

                const highlightMaterial = new THREE.MeshStandardMaterial({
                    color: "#f59e0b",
                    emissive: "#7c2d12",
                    emissiveIntensity: 0.18,
                    roughness: 0.38,
                });

                const focusStep = (stepIndex: number) => {
                    if (ldrawNumSteps > 0) {
                        const clamped = Math.min(Math.max(stepIndex, 0), ldrawNumSteps - 1);
                        root?.traverse((object) => {
                            const buildingStep = (object.userData as { buildingStep?: number }).buildingStep;
                            if (typeof buildingStep === "number") {
                                object.visible = buildingStep <= clamped;
                            }
                        });
                        const ldrawStep = content.steps3d[Math.min(clamped, content.steps3d.length - 1)];
                        applyCameraHint(THREE, camera, controls, ldrawStep?.cameraHint);
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
                    applyCameraHint(THREE, camera, controls, step?.cameraHint);
                };

                const resize = () => {
                    const width = mount.clientWidth || 640;
                    const height = mount.clientHeight || 420;
                    renderer.setSize(width, height, true);
                    camera.aspect = width / height;
                    camera.updateProjectionMatrix();
                };
                const resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(mount);
                resize();
                focusStep(activeStepIndexRef.current);

                let frame = 0;
                const animate = () => {
                    frame = requestAnimationFrame(animate);
                    controls.update();
                    renderer.render(scene, camera);
                };
                animate();

                state = {
                    cleanup: () => {
                        cancelAnimationFrame(frame);
                        resizeObserver.disconnect();
                        controls.dispose();
                        renderer.dispose();
                        if (renderer.domElement.parentElement === mount) {
                            mount.removeChild(renderer.domElement);
                        }
                    },
                    focusStep,
                };
                sceneRef.current = state;
            } catch (error) {
                setLoadError(getErrorMessage(error, "3D 场景初始化失败"));
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void setup();

        return () => {
            cancelled = true;
            state?.cleanup();
            if (sceneRef.current === state) sceneRef.current = null;
        };
    }, [content]);

    useEffect(() => {
        sceneRef.current?.focusStep(activeStepIndex);
    }, [activeStepIndex]);

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
            const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyCompleted?: boolean };
            if (!res.ok) throw new Error(data.error || "完成失败");
            setCompleted(true);
            toast({
                title: data.alreadyCompleted ? "本课已完成 ✓" : "搭建课已完成 🎉",
                description: data.alreadyCompleted ? undefined : "+15 经验值",
            });
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

    const goStep = (delta: number) => {
        const next = Math.min(Math.max(activeStepIndex + delta, 0), content.steps3d.length - 1);
        onStepChange(next);
    };

    const showTabs = standaloneVideo || hasSlides || hasWorks;

    return (
        <section className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--background))]">
            {showTabs ? (
                <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-2 py-1.5">
                    {hasSlides ? (
                        <button
                            type="button"
                            onClick={() => setView("slides")}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors",
                                view === "slides"
                                    ? "bg-[hsl(var(--brand-blue))] text-white"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            <Presentation className="h-4 w-4" />
                            课件
                        </button>
                    ) : null}
                    {standaloneVideo ? (
                        <button
                            type="button"
                            onClick={() => setView("video")}
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors",
                                view === "video"
                                    ? "bg-[hsl(var(--brand-blue))] text-white"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            <Film className="h-4 w-4" />
                            动画
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setView("build")}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors",
                            view === "build"
                                ? "bg-[hsl(var(--brand-blue))] text-white"
                                : "text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <Box className="h-4 w-4" />
                        3D 搭建
                    </button>
                    {hasWorks ? (
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
                    ) : null}
                </div>
            ) : null}

            {view === "works" && content.worksProjectId ? (
                <LessonWorksGallery
                    projectId={content.worksProjectId}
                    projectTitle={lesson.title}
                />
            ) : null}

            {view === "video" && content.videoUrl ? (
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-2">
                    <video
                        key={content.videoUrl}
                        src={content.videoUrl}
                        controls
                        playsInline
                        className="max-h-full max-w-full rounded-sm"
                    />
                </div>
            ) : null}

            {view === "slides" ? (
                <div className="flex min-h-0 flex-1 flex-col bg-[#0f172a]">
                    {hasSlideImages && content.slideImageUrls ? (
                        <>
                            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
                                <span className="truncate text-xs font-semibold text-white/70">
                                    授课课件 · 共 {slideCount} 页
                                    {videoSlide0 >= 0 ? `（第 ${videoSlide0 + 1} 页为动画）` : ""}
                                </span>
                                {content.slidesPdfUrl ? (
                                    <a
                                        href={content.slidesPdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-white/20 px-2.5 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        搭建说明
                                    </a>
                                ) : null}
                            </div>
                            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
                                {currentSlide === videoSlide0 && content.videoUrl ? (
                                    <video
                                        key={content.videoUrl}
                                        src={content.videoUrl}
                                        controls
                                        playsInline
                                        poster={content.slideImageUrls[currentSlide]}
                                        className="max-h-full max-w-full rounded-sm bg-black shadow-lg"
                                    />
                                ) : failedSlides.has(currentSlide) ? (
                                    <div className="flex max-w-sm flex-col items-center gap-2 rounded-sm border border-dashed border-white/25 bg-white/5 px-6 py-8 text-center">
                                        <Presentation className="h-8 w-8 text-white/40" />
                                        <p className="text-sm font-semibold text-white/80">第 {currentSlide + 1} 页课件待导入</p>
                                        <p className="text-xs leading-relaxed text-white/50">
                                            课件图片加载失败，请检查 OSS 资源或刷新页面重试。
                                        </p>
                                    </div>
                                ) : (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={content.slideImageUrls[currentSlide]}
                                        alt={`课件第 ${currentSlide + 1} 页`}
                                        onError={() =>
                                            setFailedSlides((prev) => {
                                                const next = new Set(prev);
                                                next.add(currentSlide);
                                                return next;
                                            })
                                        }
                                        className="max-h-full max-w-full rounded-sm bg-white object-contain shadow-lg"
                                    />
                                )}
                            </div>
                            <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 bg-[#0b1220] p-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={slideIndex <= 0}
                                    onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    上一页
                                </Button>
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80">
                                    {videoSlide0 >= 0 && currentSlide === videoSlide0 ? (
                                        <PlayCircle className="h-4 w-4 text-[hsl(var(--brand-blue))]" />
                                    ) : null}
                                    {currentSlide + 1} / {slideCount}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={slideIndex >= slideCount - 1}
                                    onClick={() => setSlideIndex((i) => Math.min(slideCount - 1, i + 1))}
                                >
                                    下一页
                                    <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </>
                    ) : content.slidesPdfUrl ? (
                        <iframe
                            title="授课课件"
                            src={content.slidesPdfUrl}
                            className="min-h-0 flex-1 border-0"
                        />
                    ) : null}
                </div>
            ) : null}

            <div className={cn(
                "grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] max-lg:grid-rows-[44dvh_auto] lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-1",
                view !== "build" && "hidden",
            )}>
                <div className="relative min-h-[320px] max-lg:min-h-0 overflow-hidden bg-[#f8fbff]">
                    <div ref={mountRef} className="h-full w-full" aria-label="3D 搭建图纸" />
                    {loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-[#f8fbff]/80">
                            <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在加载 3D 图纸
                            </div>
                        </div>
                    ) : null}
                    {loadError && !loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-[#f8fbff]/88 p-6">
                            <div className="max-w-sm rounded-sm border border-border bg-card px-4 py-3 text-center shadow-sm">
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
                            onClick={() => sceneRef.current?.focusStep(activeStepIndex)}
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

                <aside className="min-h-0 border-t border-border bg-card lg:border-l lg:border-t-0">
                    <div className="flex h-full flex-col">
                        <div className="border-b border-border px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-[hsl(var(--brand-blue))]">
                                    步骤 {activeStepIndex + 1}/{content.steps3d.length}
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
                            {content.finishedImageUrl ? (
                                <div className="mb-3">
                                    <h4 className="mb-2 text-xs font-bold text-muted-foreground">成品参考</h4>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={content.finishedImageUrl}
                                        alt="搭好的样子"
                                        className="w-full rounded-sm border border-border object-cover"
                                    />
                                </div>
                            ) : null}
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
                        <div className="space-y-2 border-t border-border p-3">
                            <div className="grid grid-cols-[1fr_1fr] gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={activeStepIndex === 0}
                                    onClick={() => goStep(-1)}
                                >
                                    <ChevronLeft className="mr-1 h-4 w-4" />
                                    上一步
                                </Button>
                                {activeStepIndex < content.steps3d.length - 1 ? (
                                    <Button type="button" onClick={() => goStep(1)}>
                                        下一步
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button type="button" disabled={completing || completed} onClick={() => void handleComplete()}>
                                        {completing ? (
                                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="mr-1 h-4 w-4" />
                                        )}
                                        {completed ? "已完成" : "完成这课"}
                                    </Button>
                                )}
                            </div>
                            {content.worksProjectId ? (
                                <LessonWorkUpload
                                    projectId={content.worksProjectId}
                                    projectTitle={lesson.title}
                                />
                            ) : null}
                        </div>
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
