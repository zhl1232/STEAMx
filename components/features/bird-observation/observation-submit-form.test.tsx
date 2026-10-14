import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ObservationPhotoMetadata } from '@/lib/observation-photo-metadata'
import type { ObservationPhotoMetadataAutofillResult } from '@/lib/observations/photo-metadata-autofill'
import { ObservationSubmitForm } from './observation-submit-form'

type PhotoProps = {
  evidenceImages: string[]
  analyses: Array<{ imageUrl: string; status: string }>
  onEvidenceChange: (urls: string[]) => void
  onPhotoMetadata: (items: Array<ObservationPhotoMetadata & { imageUrl: string }>) => Promise<void>
  onUploadingChange: (busy: boolean) => void
}
const mocks = vi.hoisted(() => ({
  photo: null as PhotoProps | null,
  autofill: vi.fn(),
  toast: vi.fn(),
  promptLogin: vi.fn(),
  fetch: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock('@/lib/context/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/lib/context/login-prompt-context', () => ({ useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }) }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => ({ userStats: null }) }))
vi.mock('@/lib/observations/photo-metadata-autofill', () => ({ resolveObservationPhotoMetadataAutofill: (...args: unknown[]) => mocks.autofill(...args) }))
vi.mock('@/lib/reverse-geocode', () => ({ convertGpsToAmap: vi.fn(), reverseGeocode: vi.fn(), searchPlacesNear: vi.fn().mockResolvedValue({ places: [], configured: true }) }))
vi.mock('@/components/features/bird-observation/observation-submit-success-dialog', () => ({ ObservationSubmitSuccessDialog: () => null }))
vi.mock('@/components/features/bird-observation/observation-submit-photo-section', () => ({
  ObservationSubmitPhotoSection: (props: PhotoProps) => {
    mocks.photo = props
    return <button type="button" onClick={() => props.onEvidenceChange(['https://example.com/a.jpg'])}>选择测试照片</button>
  },
}))
vi.mock('@/components/features/bird-observation/observation-location-picker', () => ({
  ObservationLocationPicker: (props: {
    locationName: string
    onPlaceSelect: (place: { id: string; name: string; latitude: number; longitude: number }) => void
    onLocationInput: (value: string) => void
  }) => <div>
    <input aria-label="观察地点" value={props.locationName} onChange={(e) => props.onLocationInput(e.target.value)} />
    <button type="button" onClick={() => props.onPlaceSelect({ id: 'park', name: '手动选的公园', latitude: 31.2, longitude: 121.5 })}>选择公园</button>
  </div>,
}))

function renderForm() {
  return render(<ObservationSubmitForm speciesOptions={[]} />)
}
function addPhoto() {
  fireEvent.click(screen.getByRole('button', { name: '选择测试照片' }))
}
const metadata = [{ imageUrl: 'https://example.com/a.jpg', observedAt: '2026-07-22T09:30', latitude: 31, longitude: 121 }]
const exifResult = { observedAt: '2026-07-22T09:30', latitude: '31.000000', longitude: '121.000000', locationName: '照片里的旧地点' }

describe('ObservationSubmitForm workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.autofill.mockResolvedValue(exifResult)
    mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/observations/media-analysis') {
        const { imageUrls } = JSON.parse(String(init?.body)) as { imageUrls: string[] }
        return new Response(JSON.stringify({ analyses: imageUrls.map((imageUrl) => ({ imageUrl, status: 'passed_no_identification', moderationPass: true, speciesCandidates: [] })) }))
      }
      if (url === '/api/observations') return new Response(JSON.stringify({ observation: { id: 1 } }))
      return new Response(JSON.stringify({ species: [] }))
    })
    vi.stubGlobal('fetch', mocks.fetch)
    Element.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('explains photo limits and withholds ineffective location controls until a photo is chosen', () => {
    renderForm()
    expect(screen.getAllByText('已选 0 张')).toHaveLength(2)
    expect(screen.queryByText('0/5')).not.toBeInTheDocument()
    expect(screen.queryByText('发布准备 1/3')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('观察日期')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('观察地点')).not.toBeInTheDocument()
    expect(screen.getByText(/先选择照片，再填写对应/)).toBeInTheDocument()
  })

  it('retains completed identification results when restoring a local draft', async () => {
    const imageUrl = 'https://example.com/a.jpg'
    localStorage.setItem('steam:nature-observation-draft', JSON.stringify({
      version: 2,
      evidenceImages: [imageUrl],
      photoDrafts: {},
      mediaAnalyses: [{ imageUrl, status: 'passed_no_identification', moderationPass: true, speciesCandidates: [] }],
    }))
    renderForm()
    await waitFor(() => expect(mocks.photo!.analyses).toEqual([expect.objectContaining({ imageUrl, status: 'passed_no_identification' })]))
    expect(screen.queryByText('识别建议生成中')).not.toBeInTheDocument()
  })

  it('shows unmatched model candidates as 「其他」 suggestions instead of a failure', async () => {
    const imageUrl = 'https://example.com/snail.jpg'
    localStorage.setItem('steam:nature-observation-draft', JSON.stringify({
      version: 2,
      evidenceImages: [imageUrl],
      photoDrafts: {},
      mediaAnalyses: [{
        imageUrl,
        status: 'passed_no_identification',
        moderationPass: true,
        speciesCandidates: [],
        unmatchedSuggestions: [{ commonName: '同型巴蜗牛', scientificName: 'Bradybaena similaris', confidence: 0.72, reason: null }],
      }],
    }))
    renderForm()
    const panel = await screen.findByTestId('unmatched-suggestions')
    expect(panel).toHaveTextContent('其他·同型巴蜗牛')
    expect(panel).toHaveTextContent('（Bradybaena similaris）')
    expect(screen.queryByText(/没有匹配到可靠的物种候选/)).not.toBeInTheDocument()
    const button = within(panel).getByRole('button', { name: /同型巴蜗牛/ })
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the daily quota message and still allows publishing when identify quota is used up', async () => {
    mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/observations/media-analysis') {
        const { imageUrls } = JSON.parse(String(init?.body)) as { imageUrls: string[] }
        return new Response(JSON.stringify({
          analyses: imageUrls.map((imageUrl) => ({ imageUrl, status: 'quota_exceeded', moderationPass: null, speciesCandidates: [], unmatchedSuggestions: [] })),
          quota: { isMember: false, limit: 5, used: 5, remaining: 0, exceeded: true },
        }))
      }
      if (url === '/api/observations') return new Response(JSON.stringify({ observation: { id: 1 } }))
      return new Response(JSON.stringify({ species: [] }))
    })
    renderForm()
    addPhoto()
    const notice = await screen.findByTestId('identify-quota-exceeded')
    expect(notice).toHaveTextContent('今天的识别次数用完了，可以手动选物种或按待鉴定发布')
    expect(within(notice).getByRole('link', { name: '开通会员' })).toHaveAttribute('href', '/membership')
    const analysisCalls = mocks.fetch.mock.calls.filter(([url]) => url === '/api/observations/media-analysis').length
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(mocks.fetch.mock.calls.filter(([url]) => url === '/api/observations/media-analysis').length).toBe(analysisCalls)
  })

  it('preserves manually edited time and location when slow EXIF lookup completes', async () => {
    let finish: (value: ObservationPhotoMetadataAutofillResult) => void = () => {}
    mocks.autofill.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderForm()
    addPhoto()
    let pending: Promise<void> | undefined
    act(() => { pending = mocks.photo!.onPhotoMetadata(metadata) })
    fireEvent.change(screen.getByLabelText('观察日期'), { target: { value: '2026-10-03' } })
    fireEvent.change(screen.getByLabelText('观察时间'), { target: { value: '11:45' } })
    fireEvent.click(screen.getByRole('button', { name: '选择公园' }))
    await act(async () => { finish(exifResult); await pending })

    expect(screen.getByLabelText('观察日期')).toHaveValue('2026-10-03')
    expect(screen.getByLabelText('观察时间')).toHaveValue('11:45')
    expect(screen.getByLabelText('观察地点')).toHaveValue('手动选的公园')
    fireEvent.click(screen.getAllByRole('button', { name: '发布 1 条观察' })[0])
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('/api/observations', expect.anything()))
    const body = JSON.parse(mocks.fetch.mock.calls.find(([url]) => url === '/api/observations')![1].body)
    expect(body.items[0]).toMatchObject({ observed_at_source: 'manual', location_source: 'place_search', location_name: '手动选的公园', latitude: 31.2, longitude: 121.5, initial_species_id: null })
  })

  it('fills untouched EXIF fields while preserving a manually selected location', async () => {
    let finish: (value: ObservationPhotoMetadataAutofillResult) => void = () => {}
    mocks.autofill.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderForm()
    addPhoto()
    let pending: Promise<void> | undefined
    act(() => { pending = mocks.photo!.onPhotoMetadata(metadata) })
    fireEvent.click(screen.getByRole('button', { name: '选择公园' }))
    await act(async () => { finish(exifResult); await pending })
    expect(screen.getByLabelText('观察日期')).toHaveValue('2026-07-22')
    expect(screen.getByLabelText('观察地点')).toHaveValue('手动选的公园')
  })

  it('does not recreate a removed photo after its metadata lookup finishes', async () => {
    let finish: (value: ObservationPhotoMetadataAutofillResult) => void = () => {}
    mocks.autofill.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    renderForm()
    addPhoto()
    let pending: Promise<void> | undefined
    act(() => { pending = mocks.photo!.onPhotoMetadata(metadata) })
    act(() => { mocks.photo!.onEvidenceChange([]) })
    await act(async () => { finish(exifResult); await pending })
    addPhoto()
    expect(screen.getByLabelText('观察地点')).toHaveValue('')
    expect(screen.queryByText('来自照片拍摄信息')).not.toBeInTheDocument()
  })

  it('blocks publishing while additional photos are uploading', async () => {
    const { container } = renderForm()
    addPhoto()
    fireEvent.click(screen.getByRole('button', { name: '选择公园' }))
    expect(screen.getAllByRole('button', { name: '发布 1 条观察' })[0]).toBeEnabled()
    act(() => { mocks.photo!.onUploadingChange(true) })
    expect(screen.getAllByRole('button', { name: '发布 1 条观察' })[0]).toBeDisabled()
    fireEvent.submit(container.querySelector('form')!)
    expect(mocks.fetch.mock.calls.some(([url]) => url === '/api/observations')).toBe(false)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '照片正在上传，请稍候' }))
    act(() => { mocks.photo!.onUploadingChange(false) })
    expect(screen.getAllByRole('button', { name: '发布 1 条观察' })[0]).toBeEnabled()
  })

  it('does not replace a cleared observation time with midnight', () => {
    const { container } = renderForm()
    addPhoto()
    fireEvent.click(screen.getByRole('button', { name: '选择公园' }))
    fireEvent.change(screen.getByLabelText('观察时间'), { target: { value: '' } })
    expect(screen.getByLabelText('观察时间')).toHaveValue('')
    fireEvent.submit(container.querySelector('form')!)
    expect(mocks.fetch.mock.calls.some(([url]) => url === '/api/observations')).toBe(false)
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '请补全这张照片的观察日期和时间' }))
  })
})
