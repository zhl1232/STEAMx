"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, ZoomIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useLoginPrompt } from "@/lib/context/login-prompt-context";
import type {
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

function normalizeBuildingContent(lesson: CourseLessonRow): Building3DLessonContent {
    const content = lesson.content?.building3d;
    const parts = Array.isArray(content?.parts) && content.parts.length > 0
        ? content.parts
        : DEFAULT_PARTS;
    const steps3d = Array.isArray(content?.steps3d) && content.steps3d.length > 0
        ? content.steps3d
        : DEFAULT_STEPS_3D;

    return {
        modelUrl: typeof content?.modelUrl === "string" ? content.modelUrl : undefined,
        ldrawModelUrl: typeof content?.ldrawModelUrl === "string" ? content.ldrawModelUrl : undefined,
        ldrawColorUrl: typeof content?.ldrawColorUrl === "string" ? content.ldrawColorUrl : undefined,
        attribution: typeof content?.attribution === "string" ? content.attribution : undefined,
        parts,
        steps3d,
    };
}

function partMap(parts: Building3DPart[]) {
    return new Map(parts.map((part) => [part.id, part]));
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
) {
    const root = new THREE.Group();
    const meshesByPartId = new Map<string, import("three").Mesh[]>();

    const makeMesh = (
        partId: string,
        geometry: import("three").BufferGeometry,
        position: [number, number, number],
        scale: [number, number, number],
    ) => {
        const part = parts.find((item) => item.id === partId);
        const material = new THREE.MeshStandardMaterial({
            color: part?.color ?? "#94a3b8",
            roughness: 0.48,
            metalness: 0.04,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.partId = partId;
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

    makeMesh("base", baseGeometry, [0, 0.45, 0], [4.8, 0.5, 2.4]);

    for (const x of [-1.7, 1.7]) {
        const axle = makeMesh("axle", axleGeometry, [x, 0.1, 0], [1, 1, 1]);
        axle.rotation.x = Math.PI / 2;
    }

    for (const x of [-1.7, 1.7]) {
        for (const z of [-1.45, 1.45]) {
            const wheel = makeMesh("wheel", cylinderGeometry, [x, 0.08, z], [1, 1, 1]);
            wheel.rotation.x = Math.PI / 2;
        }
    }

    makeMesh("cab", baseGeometry, [0.55, 1.05, 0], [1.6, 0.7, 1.55]);
    makeMesh("cab", baseGeometry, [-0.75, 1.05, 0], [0.9, 0.7, 1.55]);

    for (const x of [-1.7, -0.55, 0.55, 1.7]) {
        for (const z of [-0.72, 0.72]) {
            makeMesh("base", studGeometry, [x, 0.78, z], [1, 1, 1]);
        }
    }

    const visiblePartIds = new Set<string>();
    for (const step of steps) {
        for (const partId of step.partIds) visiblePartIds.add(partId);
    }
    for (const part of parts) {
        if (!visiblePartIds.has(part.id) && !meshesByPartId.has(part.id)) {
            makeMesh(part.id, baseGeometry, [0, -3, 0], [0.4, 0.4, 0.4]);
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
    const [completing, setCompleting] = useState(false);
    const [completed, setCompleted] = useState(initialCompleted);
    const activeStepIndexRef = useRef(activeStepIndex);
    const content = useMemo(() => normalizeBuildingContent(lesson), [lesson]);
    const partsById = useMemo(() => partMap(content.parts), [content.parts]);
    const activeStep = content.steps3d[Math.min(activeStepIndex, content.steps3d.length - 1)] ?? content.steps3d[0];

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
            const { THREE, OrbitControls, GLTFLoader, LDrawLoader, LDrawConditionalLineMaterial } = await loadThree();
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
                    // three 0.184 要求先指定条件线材质，否则解析配色会抛错。
                    ldrawLoader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
                    await ldrawLoader.preloadMaterials(content.ldrawColorUrl ?? DEFAULT_LDRAW_COLOR_URL);
                    const model = (await ldrawLoader.loadAsync(content.ldrawModelUrl)) as import("three").Group;
                    if (cancelled || !mountRef.current) return;
                    prepareLdrawModel(THREE, model, FLOOR_Y);
                    root = model;
                    revealPartsByStep = false;
                    ldrawNumSteps =
                        typeof model.userData.numBuildingSteps === "number"
                            ? model.userData.numBuildingSteps
                            : content.steps3d.length;
                    scene.add(root);
                } catch {
                    const demo = createDemoBrickScene(THREE, content.parts, content.steps3d);
                    root = demo.root;
                    revealPartsByStep = true;
                    scene.add(root);
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
                } catch {
                    const demo = createDemoBrickScene(THREE, content.parts, content.steps3d);
                    root = demo.root;
                    scene.add(root);
                }
            } else {
                const demo = createDemoBrickScene(THREE, content.parts, content.steps3d);
                root = demo.root;
                scene.add(root);
            }

            const defaultMaterials = new Map<import("three").Mesh, import("three").Material | import("three").Material[]>();
            root?.traverse((object) => {
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
                    const shown = !revealPartsByStep || !partId || visibleParts.has(partId);
                    mesh.visible = shown;
                    mesh.material = activeParts.has(partId) ? highlightMaterial : material;
                }
                applyCameraHint(THREE, camera, controls, step?.cameraHint);
            };

            const resize = () => {
                const width = mount.clientWidth || 640;
                const height = mount.clientHeight || 420;
                renderer.setSize(width, height, false);
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
            if (!cancelled) setLoading(false);
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

    return (
        <section className="flex min-h-0 flex-1 flex-col bg-[hsl(var(--background))]">
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-1">
                <div className="relative min-h-[320px] overflow-hidden bg-[#f8fbff]">
                    <div ref={mountRef} className="h-full w-full" aria-label="3D 搭建图纸" />
                    {loading ? (
                        <div className="absolute inset-0 grid place-items-center bg-[#f8fbff]/80">
                            <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                正在加载 3D 图纸
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
                        <div className="grid grid-cols-[1fr_1fr] gap-2 border-t border-border p-3">
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
