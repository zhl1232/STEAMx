'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Code2,
  Compass,
  Copy,
  Eye,
  FileCode,
  FolderOpen,
  Layers,
  Loader2,
  Maximize2,
  Package,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  parsePackedLdrawModelText,
  splitMainModelSteps,
  splitPackedMpd,
} from '@/lib/utils/ldraw-mpd'
import { createLdrawEdgeRenderer } from '@/lib/utils/ldraw-edges'
import type { LdrawReviewStatus } from '@/lib/courses/ldraw-review'
import type { LdrawModelInfo } from '@/lib/courses/ldraw-packer'

const COLOR_CONFIG_URL = '/courses/ldraw/LDConfig.ldr'

type ViewPreset = 'iso' | 'top' | 'front' | 'side'
type ReviewFilter = 'all' | LdrawReviewStatus

// Accept older API responses during development reloads.
function normalizeReviewStatus(status: unknown, confirmedAt?: string | null): LdrawReviewStatus {
  if (status === 'confirmed' || status === 'changed' || status === 'untracked' || status === 'unconfirmed') return status
  return status === 'pending' && confirmedAt ? 'changed' : 'unconfirmed'
}

export function LdrawPreviewWorkspace() {
  const { toast } = useToast()

  // 模型列表与筛选
  const [models, setModels] = useState<LdrawModelInfo[]>([])
  const [reviewRecordCount, setReviewRecordCount] = useState(0)
  const [servedFrozenConfirmed, setServedFrozenConfirmed] = useState(false)
  const [loadingModels, setLoadingModels] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | '3+' | '4+' | '5+' | 'unpacked' | 'packed'>('all')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [requestedBatch, setRequestedBatch] = useState<string[] | null>(null)

  // 当前加载的模型信息
  const [activeTab, setActiveTab] = useState<'library' | 'custom'>('library')
  const [currentFileName, setCurrentFileName] = useState<string>('3-tui-la-men.ldr')
  const [currentModelName, setCurrentModelName] = useState<string>('3-tui-la-men')
  const [customLdrText, setCustomLdrText] = useState<string>('')

  // 打包后的完整 MPD 数据
  const [fullMpdText, setFullMpdText] = useState<string>('')
  const [modelStepCount, setModelStepCount] = useState<number>(1)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [partStats, setPartStats] = useState<{ partCount: number; missingParts: string[] }>({
    partCount: 0,
    missingParts: [],
  })
  const [modelRevision, setModelRevision] = useState<string | null>(null)
  const [renderedVersion, setRenderedVersion] = useState<string | null>(null)
  const [productionProtected, setProductionProtected] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<LdrawReviewStatus>('unconfirmed')
  const [canConfirm, setCanConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // 画布与显示设置
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [showAxes, setShowAxes] = useState(false)
  const [bgColor, setBgColor] = useState<'light' | 'dark' | 'gray'>('gray')
  const [threeReady, setThreeReady] = useState(false)

  // Three.js 引用
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const threeStateRef = useRef<{
    renderer: import('three').WebGLRenderer
    scene: import('three').Scene
    camera: import('three').PerspectiveCamera
    controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls
    gridHelper: import('three').GridHelper
    axesHelper: import('three').AxesHelper
    currentModelGroup: import('three').Group | null
    loader: import('three/examples/jsm/loaders/LDrawLoader.js').LDrawLoader
    materialsLoaded: boolean
    THREE: typeof import('three')
  } | null>(null)
  const loadRequestIdRef = useRef(0)
  const loadAbortRef = useRef<AbortController | null>(null)

  const updateModelUrl = (fileName: string) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('model', fileName)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  // 1. 初始化加载模型列表
  useEffect(() => {
    let cancelled = false
    async function fetchList() {
      const params = new URLSearchParams(window.location.search)
      const batch = params.get('models')
        ?.split(',')
        .map((name) => name.trim())
        .filter(Boolean)
      if (batch?.length) setRequestedBatch([...new Set(batch)])

      try {
        const res = await fetch('/api/ldraw-preview')
        if (!res.ok) throw new Error('获取模型列表失败')
        const data = await res.json()
        if (!cancelled) {
          setModels((data.models ?? []).map((item: LdrawModelInfo) => ({ ...item, reviewStatus: normalizeReviewStatus(item.reviewStatus, item.confirmedAt) })))
          setReviewRecordCount(data.reviewRecordCount ?? 0)
          setLoadingModels(false)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadingModels(false)
          toast({
            title: '模型列表加载失败',
            description: (err as Error).message,
            variant: 'destructive',
          })
        }
      }
    }
    void fetchList()
    return () => {
      cancelled = true
    }
  }, [toast])

  // 2. 初始化 Three.js 场景
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    let cancelled = false

    async function initThree() {
      try {
        const [THREE, { LDrawLoader, LDrawConditionalLineMaterial }, { OrbitControls }] =
          await Promise.all([
            import('three'),
            Promise.all([
              import('three/examples/jsm/loaders/LDrawLoader.js'),
              import('three/examples/jsm/materials/LDrawConditionalLineMaterial.js'),
            ]).then(([ldraw, ldrawLine]) => ({
              LDrawLoader: ldraw.LDrawLoader,
              LDrawConditionalLineMaterial: ldrawLine.LDrawConditionalLineMaterial,
            })),
            import('three/examples/jsm/controls/OrbitControls.js'),
          ])

        if (cancelled || !container) return

        const width = container.clientWidth
        const height = container.clientHeight

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(bgColor === 'light' ? 0xf8f9fa : bgColor === 'dark' ? 0x0f172a : 0xe2e8f0)

        const camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000)
        camera.position.set(300, 240, 320)

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1

        container.innerHTML = ''
        container.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.target.set(0, 0, 0)
        controls.maxDistance = 2500
        controls.minDistance = 20

        // 灯光设置
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
        scene.add(ambientLight)

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2)
        mainLight.position.set(300, 500, 400)
        scene.add(mainLight)

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.45)
        fillLight.position.set(-300, -200, -200)
        scene.add(fillLight)

        // 辅助线
        const gridHelper = new THREE.GridHelper(600, 30, 0x94a3b8, 0xcbd5e1)
        gridHelper.position.y = -0.5
        gridHelper.visible = showGrid
        scene.add(gridHelper)

        const axesHelper = new THREE.AxesHelper(150)
        axesHelper.visible = showAxes
        scene.add(axesHelper)

        // 初始化 LDraw 加载器
        const loader = new LDrawLoader()
        loader.smoothNormals = false
        loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)
        loader.addDefaultMaterials()

        // 预载入色彩定义
        try {
          await loader.preloadMaterials(COLOR_CONFIG_URL)
          if (!loader.getMaterial('71')) {
            console.warn('LDraw colour table is incomplete (missing code 71)', COLOR_CONFIG_URL)
          }
        } catch {
          // 若加载不到则使用默认材质
        }

        if (cancelled) {
          controls.dispose()
          renderer.dispose()
          return
        }

        threeStateRef.current = {
          renderer,
          scene,
          camera,
          controls,
          gridHelper,
          axesHelper,
          currentModelGroup: null,
          loader,
          materialsLoaded: true,
          THREE,
        }
        // The model request and Three.js initialization run independently. Keep
        // the render effect from missing a model that arrived first.
        setThreeReady(true)

        let animationFrameId: number
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // 监听窗口缩放
        const handleResize = () => {
          if (!container) return
          const w = container.clientWidth
          const h = container.clientHeight
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        }
        window.addEventListener('resize', handleResize)

        return () => {
          cancelAnimationFrame(animationFrameId)
          window.removeEventListener('resize', handleResize)
          controls.dispose()
          renderer.dispose()
        }
      } catch (err) {
        setRenderError(`Three.js 初始化失败: ${(err as Error).message}`)
      }
    }

    let cleanupScene: (() => void) | undefined
    void initThree().then((cleanup) => {
      if (cancelled) cleanup?.()
      else cleanupScene = cleanup
    })

    return () => {
      cancelled = true
      cleanupScene?.()
      threeStateRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 背景色切换
  useEffect(() => {
    if (!threeStateRef.current) return
    const { scene, THREE } = threeStateRef.current
    const col = bgColor === 'light' ? 0xf8f9fa : bgColor === 'dark' ? 0x0f172a : 0xe2e8f0
    scene.background = new THREE.Color(col)
  }, [bgColor])

  // 网格与坐标轴切换
  useEffect(() => {
    if (!threeStateRef.current) return
    threeStateRef.current.gridHelper.visible = showGrid
    threeStateRef.current.axesHelper.visible = showAxes
  }, [showGrid, showAxes])

  // 3. 加载选中的模型
  const loadModelByName = async (fileName: string, showToast = false) => {
    const requestId = ++loadRequestIdRef.current
    loadAbortRef.current?.abort()
    const abortController = new AbortController()
    loadAbortRef.current = abortController
    setRendering(true)
    setRenderError(null)
    setReviewStatus('unconfirmed')
    setProductionProtected(false)
    setServedFrozenConfirmed(false)
    setRenderedVersion(null)
    setModelRevision(null)
    setConfirmError(null)
    setCanConfirm(false)
    setCurrentFileName(fileName)
    updateModelUrl(fileName)

    try {
      const res = await fetch(
        `/api/ldraw-preview?model=${encodeURIComponent(fileName)}&_t=${Date.now()}`,
        { cache: 'no-store', signal: abortController.signal },
      )
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `请求失败 HTTP ${res.status}`)
      }
      const data = await res.json()
      if (requestId !== loadRequestIdRef.current) return
      setCurrentModelName(data.modelName)
      setFullMpdText(data.mpdText)
      setModelStepCount(data.stepCount || 1)
      setCurrentStep(data.stepCount || 1)
      setPartStats({
        partCount: data.partCount,
        missingParts: data.missingParts || [],
      })
      setModelRevision(typeof data.revision === 'string' ? data.revision : null)
      setProductionProtected(data.productionProtected === true)
      setReviewStatus(normalizeReviewStatus(data.reviewStatus, data.confirmedAt))
      setServedFrozenConfirmed(data.servedFrozenConfirmed === true)
      setCanConfirm(data.canConfirm === true)
      setModels((items) => items.map((item) => item.name === fileName ? {
        ...item,
        productionProtected: data.productionProtected === true,
        reviewStatus: normalizeReviewStatus(data.reviewStatus, data.confirmedAt),
        legacyReviewStatus: data.legacyReviewStatus,
        confirmedAt: data.confirmedAt ?? null,
      } : item))
      if (showToast) {
        toast({ title: data.servedFrozenConfirmed ? `已载入 ${fileName} 已确认发布版本` : `已重新读取 ${fileName} 最新内容` })
      }
    } catch (err) {
      if (requestId !== loadRequestIdRef.current || abortController.signal.aborted) return
      setRenderError((err as Error).message)
    } finally {
      if (requestId === loadRequestIdRef.current) setRendering(false)
    }
  }

  // 初始加载默认模型
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const firstBatchModel = params.get('models')?.split(',').map((name) => name.trim()).find(Boolean)
    void loadModelByName(params.get('model')?.trim() || firstBatchModel || '3-tui-la-men.ldr')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 4. 自定义代码即时打包提交
  const handleCustomSubmit = async () => {
    if (!customLdrText.trim()) {
      toast({ title: '请输入 LDR 文本', variant: 'destructive' })
      return
    }
    const requestId = ++loadRequestIdRef.current
    loadAbortRef.current?.abort()
    const abortController = new AbortController()
    loadAbortRef.current = abortController
    setRendering(true)
    setRenderError(null)
    setReviewStatus('unconfirmed')
    setProductionProtected(false)
    setServedFrozenConfirmed(false)
    setRenderedVersion(null)
    setModelRevision(null)
    setCanConfirm(false)
    setConfirmError(null)
    setCurrentFileName('custom.ldr')
    setCurrentModelName('custom')

    try {
      const res = await fetch('/api/ldraw-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ldrText: customLdrText, modelName: 'custom' }),
        signal: abortController.signal,
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || '打包失败')
      }
      const data = await res.json()
      if (requestId !== loadRequestIdRef.current) return
      setFullMpdText(data.mpdText)
      setModelStepCount(data.stepCount || 1)
      setCurrentStep(data.stepCount || 1)
      setPartStats({
        partCount: data.partCount,
        missingParts: data.missingParts || [],
      })
      setModelRevision(typeof data.revision === 'string' ? data.revision : null)
      setReviewStatus('unconfirmed')
      setProductionProtected(false)
      setServedFrozenConfirmed(false)
      toast({ title: 'LDR 解析打包成功' })
    } catch (err) {
      if (requestId !== loadRequestIdRef.current || abortController.signal.aborted) return
      setRenderError((err as Error).message)
    } finally {
      if (requestId === loadRequestIdRef.current) setRendering(false)
    }
  }

  // 文件拖拽/上传处理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        setCustomLdrText(text)
        setActiveTab('custom')
        toast({ title: `已载入文件: ${file.name}` })
      }
    }
    reader.readAsText(file)
  }

  // 5. 根据当前 MPD 和当前步骤（Step）更新三维渲染
  useEffect(() => {
    if (!fullMpdText || !threeStateRef.current) return

    let cancelled = false
    const state = threeStateRef.current
    const { scene, camera, controls, loader, THREE } = state
    const edgeRenderer = createLdrawEdgeRenderer((code) => loader.getMaterial(code))
    let preparedModel: import('three').Group | null = null

    async function renderStep() {
      setRendering(true)
      try {
        // 提取步骤模型文本
        const { mainName, mainText, embedded } = splitPackedMpd(fullMpdText)
        const { preamble, steps } = splitMainModelSteps(mainText)

        // 截取到当前步骤
        const activeSteps = steps.slice(0, currentStep)
        const currentStepMainText = [preamble, activeSteps.join('\n0 STEP\n')].filter(Boolean).join('\n')

        // 组装临时步骤 MPD
        const stepMpdBlocks = [`0 FILE ${mainName}\n${currentStepMainText.trimEnd()}\n`]
        for (const [name, text] of embedded) {
          stepMpdBlocks.push(`0 FILE ${name}\n${text.trimEnd()}\n`)
        }
        const stepMpdText = stepMpdBlocks.join('\n')

        const modelGroup = await parsePackedLdrawModelText(
          loader,
          stepMpdText,
          COLOR_CONFIG_URL,
          { allowSmallPackedMpd: true, preloadMaterials: false },
        )

        if (cancelled) return

        edgeRenderer.prepare(modelGroup)
        preparedModel = modelGroup

        // 移除旧模型
        if (threeStateRef.current?.currentModelGroup) {
          scene.remove(threeStateRef.current.currentModelGroup)
        }

        // LDraw 坐标系转换（反转 X/Y 轴适配常规三维场景，并居中）
        modelGroup.rotation.x = Math.PI
        modelGroup.updateMatrixWorld(true)

        // 计算包围盒对齐中心
        const box = new THREE.Box3().setFromObject(modelGroup)
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())

          // 将模型底面贴地，中心居中
          modelGroup.position.x = -center.x
          modelGroup.position.y = -box.min.y
          modelGroup.position.z = -center.z

          // 适当调整相机视角距离
          const maxDim = Math.max(size.x, size.y, size.z)
          const fov = camera.fov * (Math.PI / 180)
          let cameraDist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8
          cameraDist = Math.max(cameraDist, 180)

          // 保持观察中心在模型中心高度
          controls.target.set(0, size.y * 0.4, 0)
          // Fit the camera to the complete model. Previously the distance was
          // calculated but never applied, leaving large models at the initial
          // close-up camera position (and sometimes beyond maxDistance).
          const viewDirection = new THREE.Vector3(1, 0.8, 1).normalize()
          camera.position.copy(controls.target).addScaledVector(viewDirection, cameraDist)
          camera.far = Math.max(5000, cameraDist * 4)
          camera.updateProjectionMatrix()
          controls.maxDistance = Math.max(2500, cameraDist * 2)
          camera.lookAt(controls.target)
          controls.update()
        }

        scene.add(modelGroup)
        threeStateRef.current!.currentModelGroup = modelGroup
        setRenderError(null)
        if (currentFileName && modelRevision) setRenderedVersion(`${currentFileName}:${modelRevision}`)
      } catch (err) {
        if (!cancelled) {
          setRenderError(`模型渲染异常: ${(err as Error).message}`)
          setRenderedVersion(null)
          setCanConfirm(false)
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    }

    void renderStep()

    return () => {
      cancelled = true
      if (preparedModel) {
        scene.remove(preparedModel)
        if (state.currentModelGroup === preparedModel) state.currentModelGroup = null
      }
      edgeRenderer.dispose()
    }
  }, [fullMpdText, currentStep, threeReady, currentFileName, modelRevision])

  // 视角预置切换
  const setViewPreset = (preset: ViewPreset) => {
    if (!threeStateRef.current) return
    const { camera, controls } = threeStateRef.current
    const target = controls.target
    const dist = camera.position.distanceTo(target) || 350

    if (preset === 'iso') {
      camera.position.set(target.x + dist * 0.7, target.y + dist * 0.6, target.z + dist * 0.7)
    } else if (preset === 'top') {
      camera.position.set(target.x, target.y + dist, target.z + 0.001)
    } else if (preset === 'front') {
      camera.position.set(target.x, target.y + dist * 0.2, target.z + dist)
    } else if (preset === 'side') {
      camera.position.set(target.x + dist, target.y + dist * 0.2, target.z)
    }
    camera.lookAt(target)
    controls.update()
  }

  // 过滤模型列表
  const filteredModels = useMemo(() => {
    return models.filter((item) => {
      // 类别筛选
      if (categoryFilter === '3+' && item.category !== '3+') return false
      if (categoryFilter === '4+' && item.category !== '4+') return false
      if (categoryFilter === '5+' && item.category !== '5+') return false
      if (categoryFilter === 'unpacked' && item.hasMpd) return false
      if (categoryFilter === 'packed' && !item.hasMpd) return false
      if (reviewFilter !== 'all' && item.reviewStatus !== reviewFilter) return false

      // 关键词搜索
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        return (
          item.name.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [models, categoryFilter, reviewFilter, searchQuery])

  const batchModels = useMemo(() => {
    if (!requestedBatch) return filteredModels
    const byName = new Map(filteredModels.map((item) => [item.name, item]))
    return requestedBatch.flatMap((name) => {
      const model = byName.get(name)
      return model ? [model] : []
    })
  }, [filteredModels, requestedBatch])

  const clearBatch = () => {
    setRequestedBatch(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('models')
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  const navigateBatchModel = (direction: -1 | 1) => {
    const currentIndex = batchModels.findIndex((item) => item.name === currentFileName)
    if (currentIndex < 0) return
    const next = batchModels[currentIndex + direction]
    if (next) void loadModelByName(next.name)
  }

  // 复制当前打包好的 MPD 内容
  const handleCopyMpd = async () => {
    if (!fullMpdText) return
    try {
      await navigator.clipboard.writeText(fullMpdText)
      toast({ title: '已复制当前 MPD 文本到剪贴板' })
    } catch {
      toast({ title: '复制失败', variant: 'destructive' })
    }
  }

  const handleConfirm = async () => {
    const identity = renderedVersion
    const revision = modelRevision
    const fileName = currentFileName
    const requestId = loadRequestIdRef.current
    if (!identity || !revision || identity !== `${fileName}:${revision}` || !canConfirm || confirming) return
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await fetch('/api/ldraw-preview', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: fileName, revision }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) throw new Error('请先在本站登录管理员账号，再点确认')
      if (res.status === 403 && data.code === 'LDRAW_CONFIRM_ADMIN_REQUIRED') throw new Error('当前账号不是管理员，只有管理员可以确认模型')
      if (!res.ok) throw new Error(data.error || '确认失败')
      setModels((items) => items.map((item) => item.name === fileName ? { ...item, reviewStatus: 'confirmed', legacyReviewStatus: 'confirmed', confirmedAt: data.confirmedAt ?? new Date().toISOString() } : item))
      setReviewRecordCount(data.reviewRecordCount)
      if (loadRequestIdRef.current !== requestId) return
      setReviewStatus('confirmed')
      setCanConfirm(false)
    } catch (error) {
      if (loadRequestIdRef.current === requestId) setConfirmError((error as Error).message)
    } finally {
      setConfirming(false)
    }
  }

  const changedCount = models.filter((item) => item.reviewStatus === 'changed').length
  const unconfirmedCount = models.filter((item) => item.reviewStatus === 'unconfirmed').length
  const untrackedCount = models.filter((item) => item.reviewStatus === 'untracked').length
  const protectedCount = models.filter((item) => item.reviewStatus === 'confirmed' && item.productionProtected).length
  const confirmedCount = models.filter((item) => item.reviewStatus === 'confirmed').length
  const confirmedTotal = Math.max(confirmedCount, reviewRecordCount - changedCount)

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      {/* 顶部主导航栏 */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
            3D
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight md:text-base">LDraw 3D 预览工作台</h1>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                {currentFileName}
              </span>
              {models.find((m) => m.name === currentFileName)?.hasMpd ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> 已生成 MPD
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" /> 草稿待审核
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              实时装配与 3D 预览 · 共收录 {models.length} 个模型 (已上线 {models.filter((m) => m.hasMpd).length} 个)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadModelByName(currentFileName, true)}
            disabled={rendering || !currentFileName}
            className="text-xs font-medium text-foreground hover:text-primary"
            title="重新从磁盘读取源文件并刷新 3D 渲染"
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', rendering && 'animate-spin')} /> 重新载入文件
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyMpd}
            disabled={!fullMpdText}
            className="text-xs"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" /> 复制 MPD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewPreset('iso')}
            className="text-xs"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 视角重置
          </Button>
        </div>
      </header>

      {/* 主体工作区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧控制面板 */}
        <div className="flex w-80 flex-col border-r bg-muted/20 lg:w-96">
          {/* Tab 切换 */}
          <div className="flex border-b bg-background">
            <button
              onClick={() => setActiveTab('library')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors',
                activeTab === 'library'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FolderOpen className="h-4 w-4" /> 模型库 ({models.length})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors',
                activeTab === 'custom'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Code2 className="h-4 w-4" /> 自定义代码 / 上传
            </button>
          </div>

          {activeTab === 'library' ? (
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              {/* 搜索与快捷过滤 */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索模型拼音或中文..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {requestedBatch ? (
                <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium text-primary">
                      当前批次 · {batchModels.length} / {requestedBatch.length} 个模型
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearBatch}
                      className="h-6 px-1.5 text-[11px] text-muted-foreground"
                    >
                      显示全部
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBatchModel(-1)}
                      disabled={rendering || batchModels.findIndex((item) => item.name === currentFileName) <= 0}
                      className="h-7 flex-1 px-2 text-[11px]"
                    >
                      <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一个模型
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBatchModel(1)}
                      disabled={
                        rendering ||
                        batchModels.findIndex((item) => item.name === currentFileName) < 0 ||
                        batchModels.findIndex((item) => item.name === currentFileName) >= batchModels.length - 1
                      }
                      className="h-7 flex-1 px-2 text-[11px]"
                    >
                      下一个模型 <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1 pb-2">
                {(['all', '3+', '4+', '5+', 'unpacked', 'packed'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                      categoryFilter === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {cat === 'all' && '全部'}
                    {cat === '3+' && '3+ 阶段'}
                    {cat === '4+' && '4+ 阶段'}
                    {cat === '5+' && '5+ 阶段'}
                    {cat === 'unpacked' && '未打包 (197)'}
                    {cat === 'packed' && '已上线 (43)'}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex flex-wrap gap-1 border-b pb-2">
                {(['all', 'confirmed', 'changed', 'unconfirmed', 'untracked'] as const).map((filter) => (
                  <button key={filter} onClick={() => setReviewFilter(filter)} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', reviewFilter === filter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent')}>
                    {filter === 'all' ? `审核状态 (${models.length})` : filter === 'confirmed' ? `已确认 ${confirmedTotal}` : filter === 'changed' ? `有改动待复核 ${changedCount}` : filter === 'unconfirmed' ? `待确认 ${unconfirmedCount}` : `未跟踪 ${untrackedCount}`}
                  </button>
                ))}
              </div>

              <p className="mb-2 text-[11px] text-muted-foreground">确认记录总数 {reviewRecordCount}，其中已确认（线上版本）{protectedCount + Math.max(0, confirmedTotal - confirmedCount)}</p>

              {/* 模型列表 */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {loadingModels ? (
                  <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载模型列表...
                  </div>
                ) : batchModels.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {requestedBatch ? '当前批次中的模型尚未出现在列表中' : '未找到匹配的模型'}
                  </div>
                ) : (
                  batchModels.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => loadModelByName(item.name)}
                      className={cn(
                        'flex w-full flex-col rounded-lg border p-2 text-left transition-colors',
                        currentFileName === item.name
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-border/60 hover:bg-accent/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-semibold truncate">
                          {item.name}
                        </span>
                        <span className={cn('shrink-0 rounded px-1 text-[10px]', item.reviewStatus === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : item.reviewStatus === 'changed' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                          {item.reviewStatus === 'confirmed' ? (item.productionProtected ? '已确认（线上版本）' : '已确认') : item.reviewStatus === 'changed' ? '有改动·待复核' : item.reviewStatus === 'unconfirmed' ? '待确认' : '未跟踪'}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {item.title}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden p-3">
              {/* 文件上传区 */}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center transition-colors hover:bg-muted/50">
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <span className="mt-1 text-xs font-medium">选择或拖拽 .ldr 文件导入</span>
                <input
                  type="file"
                  accept=".ldr,.mpd,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* 源码输入框 */}
              <div className="mt-3 flex flex-1 flex-col">
                <label className="text-xs font-medium text-muted-foreground mb-1">
                  或直接粘贴 LDR 源码文本：
                </label>
                <Textarea
                  placeholder="0 示例模型&#10;1 14 0 0 0 1 0 0 0 1 0 0 0 1 3011.dat&#10;0 STEP"
                  value={customLdrText}
                  onChange={(e) => setCustomLdrText(e.target.value)}
                  className="flex-1 font-mono text-xs leading-relaxed resize-none"
                />
                <Button
                  className="mt-2 text-xs"
                  onClick={handleCustomSubmit}
                  disabled={rendering || !customLdrText.trim()}
                >
                  {rendering ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      解析打包中...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      立即 3D 渲染
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* 步骤控制器与统计面板 */}
          <div className="border-t bg-background p-3">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                搭建步骤
              </span>
              <span className="font-mono text-muted-foreground">
                第 {currentStep} / {modelStepCount} 步
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentStep <= 1 || rendering}
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={1}
                max={modelStepCount}
                value={currentStep}
                onChange={(e) => setCurrentStep(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentStep >= modelStepCount || rendering}
                onClick={() => setCurrentStep((prev) => Math.min(modelStepCount, prev + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t pt-2">
              <span>内联零件: {partStats.partCount} 个</span>
              {partStats.missingParts.length > 0 ? (
                <span className="text-amber-500 font-medium">
                  缺失 {partStats.missingParts.length} 件
                </span>
              ) : (
                <span className="text-emerald-500">依赖完整</span>
              )}
            </div>
            {activeTab === 'library' && canConfirm && renderedVersion === `${currentFileName}:${modelRevision}` ? (
              <div className="mt-3 border-t pt-3">
                <Button className="w-full text-xs" onClick={handleConfirm} disabled={confirming || rendering}>
                  {confirming ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />确认中...</> : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />确认当前修复</>}
                </Button>
                <p className="mt-1.5 text-[10px] text-muted-foreground">仅记录本地验收状态，不会发布模型。</p>
                {confirmError ? <p className="mt-1 text-[11px] text-destructive">{confirmError}</p> : null}
              </div>
            ) : reviewStatus === 'confirmed' ? <p className="mt-3 border-t pt-3 text-center text-[11px] text-emerald-600">{productionProtected ? '已确认（线上版本）' : servedFrozenConfirmed ? '当前展示已确认的发布版本' : '当前版本已确认'}</p> : null}
          </div>
        </div>

        {/* 右侧 3D 画布区 */}
        <div className="relative flex-1 bg-slate-100 dark:bg-slate-900">
          {/* Three.js 容器 */}
          <div ref={canvasContainerRef} className="h-full w-full" />

          {/* 加载浮层 */}
          {rendering ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-xs">
              <div className="flex items-center gap-2 rounded-lg bg-background/90 px-4 py-2 text-xs font-semibold shadow-md">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在载入 3D 模型...
              </div>
            </div>
          ) : null}

          {/* 错误提示框 */}
          {renderError ? (
            <div className="absolute top-4 left-4 right-4 max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive backdrop-blur-xs">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-4 w-4" /> 渲染出错
              </div>
              <p className="mt-1">{renderError}</p>
            </div>
          ) : null}

          {/* 悬浮视角与辅助工具栏 */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg border bg-background/90 p-1.5 shadow-md backdrop-blur-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewPreset('iso')}
              className="h-7 px-2 text-xs"
            >
              等轴测
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewPreset('top')}
              className="h-7 px-2 text-xs"
            >
              顶视
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewPreset('front')}
              className="h-7 px-2 text-xs"
            >
              正视
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewPreset('side')}
              className="h-7 px-2 text-xs"
            >
              侧视
            </Button>
            <div className="h-4 w-[1px] bg-border mx-0.5" />
            <Button
              variant={showGrid ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowGrid((v) => !v)}
              className="h-7 px-2 text-xs"
            >
              网格
            </Button>
            <Button
              variant={showAxes ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowAxes((v) => !v)}
              className="h-7 px-2 text-xs"
            >
              坐标轴
            </Button>
          </div>

          {/* 底部交互提示 */}
          <div className="absolute bottom-4 left-4 rounded-md bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-xs shadow-xs">
            左键旋转 · 右键平移 · 滚轮缩放
          </div>
        </div>
      </div>
    </div>
  )
}
