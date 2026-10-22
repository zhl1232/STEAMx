import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectDemoVideo } from './project-demo-video'

const chapters = [{ seconds: 49, label: '刮漆' }, { seconds: 80, label: '底座' }]
afterEach(() => vi.restoreAllMocks())
function setup(readyState = 1) {
  render(<ProjectDemoVideo src="/fixture.mp4" title="自制电动机" videoLabel="制作视频" chapters={chapters} />)
  const video = screen.getByLabelText('自制电动机 制作视频') as HTMLVideoElement
  Object.defineProperty(video, 'readyState', { configurable: true, value: readyState })
  Object.defineProperty(video, 'duration', { configurable: true, value: 137 })
  return video
}

describe('video chapter controls', () => {
  it('seeks repeatedly without starting or pausing playback and never completes a project', () => {
    const video = setup()
    const play = vi.spyOn(video, 'play')
    const pause = vi.spyOn(video, 'pause')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fireEvent.click(screen.getByRole('button', { name: '00:49 刮漆' }))
    expect(video.currentTime).toBe(49)
    video.currentTime = 60
    fireEvent.click(screen.getByRole('button', { name: '00:49 刮漆' }))
    expect(video.currentTime).toBe(49)
    fireEvent.ended(video)
    expect(play).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('queues only the latest chapter before metadata and preserves a later manual seek', () => {
    const video = setup(0)
    Object.defineProperty(video, 'networkState', { value: 2 })
    const load = vi.spyOn(video, 'load')
    fireEvent.click(screen.getByRole('button', { name: '00:49 刮漆' }))
    fireEvent.click(screen.getByRole('button', { name: '01:20 底座' }))
    expect(video.currentTime).toBe(0)
    expect(screen.getByRole('status')).toHaveTextContent('随后定位到 01:20')
    expect(load).not.toHaveBeenCalled()
    Object.defineProperty(video, 'readyState', { value: 1 })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(80)
    video.currentTime = 90
    fireEvent.canPlay(video)
    expect(video.currentTime).toBe(90)
  })

  it('retains the requested chapter through a media error and retry', () => {
    const video = setup(0)
    const load = vi.spyOn(video, 'load').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: '00:49 刮漆' }))
    fireEvent.error(video)
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(load).toHaveBeenCalled()
    Object.defineProperty(video, 'readyState', { value: 1 })
    fireEvent.loadedMetadata(video)
    expect(video.currentTime).toBe(49)
  })

  it('retries a browser-rejected seek at canplay', () => {
    const video = setup()
    const currentTime = vi.spyOn(video, 'currentTime', 'set').mockImplementationOnce(() => { throw new DOMException('Not ready') })
    fireEvent.click(screen.getByRole('button', { name: '00:49 刮漆' }))
    expect(screen.getByRole('status')).toHaveTextContent('正在加载')
    fireEvent.canPlay(video)
    expect(currentTime).toHaveBeenLastCalledWith(49)
    expect(screen.getByRole('status')).toHaveTextContent('已定位到 00:49')
  })

  it('keeps the existing player for projects without chapters', () => {
    render(<ProjectDemoVideo src="/fixture.mp4" title="逃出手心" fill />)
    expect(screen.getByLabelText('逃出手心 演示视频')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
