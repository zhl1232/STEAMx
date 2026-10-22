import React, { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Building3DWorkspace } from '@/components/features/courses/building-3d-workspace'
import { BuildingVoiceControls } from '@/components/features/courses/building-voice-controls'
import { claimTutorAudioSession } from '@/components/features/tutor/tutor-audio-session'
import '@/app/globals.css'
// All browser checks use a synthetic Web Audio stream; never request a physical mic.
let synthetic
let destination
let microphoneRequests=0
let activeSource
let silentInput
navigator.mediaDevices.getUserMedia = async () => {
  microphoneRequests++
  if (!synthetic) synthetic = new AudioContext()
  await synthetic.resume()
  silentInput?.stop(); silentInput?.disconnect()
  destination = synthetic.createMediaStreamDestination()
  destination.channelCount=1
  silentInput=synthetic.createConstantSource(); silentInput.offset.value=0; silentInput.connect(destination); silentInput.start()
  return destination.stream
}
window.voiceFixture = {
  get sampleRate(){return synthetic?.sampleRate},
  get microphoneRequests(){return microphoneRequests},
  get trackState(){return destination?.stream.getTracks()[0]?.readyState},
  stopInput(){try{activeSource?.stop()}catch{}},
  async play(name, overlap) {
    const buffer = await synthetic.decodeAudioData(await (await fetch(`/synthetic/${name}.wav`)).arrayBuffer())
    const source = synthetic.createBufferSource()
    source.buffer = buffer
    activeSource=source
    source.connect(destination)
    const end = new Promise((resolve) => { source.onended = resolve })
    source.start()
    if (overlap) {
      const other = await synthetic.decodeAudioData(await (await fetch(`/synthetic/${overlap}.wav`)).arrayBuffer())
      const second = synthetic.createBufferSource(); second.buffer = other; second.connect(destination); second.start()
    }
    await end
    source.disconnect()
  },
  interrupt() { destination.stream.getTracks().forEach((t) => t.stop()) },
  preempt() { claimTutorAudioSession('tutor', () => {})() },
}
const lesson = { id: 1, course_id: 7, title: 'Vosk 与 3D 隔离验收', lesson_type: 'building_3d', content: {
  building3d: { ldrawModelUrl: '/courses/ldraw/3-hu-die.mpd', parts: [], steps3d: Array.from({length: 30}, (_, i) => ({title: `第 ${i+1} 步`,description: '',partIds: []})) }, workSubmission: {enabled:false}
}, steps: [], resources: [], starter_project_path: null, sort_order: 1, duration_minutes: 30, created_at: '', updated_at: '' }
function App() {
  const [step, setStep] = useState(1)
  const [epoch, setEpoch] = useState(0)
  const [mounted, setMounted] = useState(true)
  const navigate = (value) => { setStep(value); setEpoch((n) => n + 1) }
  useEffect(() => { window.voiceFixture.resetStep = () => { setStep(4); setEpoch((n) => n + 1) } }, [])
  return <main><nav>
    <button onClick={() => navigate(step + 1)}>手动下一页</button>
    <button onClick={() => setMounted(!mounted)}>挂载切换</button>
    <div data-building-lesson><audio data-testid="lesson-audio" src="/synthetic/normal-next.wav" controls /></div>
    <output data-testid="step">{step}</output>
  </nav>{mounted && <>
    <BuildingVoiceControls courseId={7} lessonId={1} navigationKey={String(epoch)} stepIndex={step} stepCount={30} onNavigate={navigate} tutorOpen={false} onCloseTutor={() => {}} />
    <Building3DWorkspace courseId={7} lesson={lesson} activeStepIndex={step} onStepChange={navigate} />
  </>}</main>
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
