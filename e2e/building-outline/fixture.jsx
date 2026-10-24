import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Building3DWorkspace } from '@/components/features/courses/building-3d-workspace'
import '@/app/globals.css'
const models = ['3-hu-die.mpd', '3-hua-lan.mpd']
const params = new URLSearchParams(location.search)
const mixed = params.has('mixed')
function App() {
  const [step, setStep] = useState(Number(params.get('step') ?? 0))
  const [model, setModel] = useState(0)
  const [mounted, setMounted] = useState(true)
  const lesson = React.useMemo(() => ({ id: model + 1, course_id: 7, title: '本步新增积木', lesson_type: 'building_3d', content: {
    building3d: {
      ldrawModelUrl: `/courses/ldraw/${models[model]}`, parts: [],
      ...(mixed ? { slideImageUrls: Array.from({ length: 10 }, (_, i) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#193457"/><text x="400" y="225" fill="white" font-size="48" text-anchor="middle">Slide ${i + 1}</text></svg>`)}`) } : {}),
      steps3d: Array.from({length: mixed ? 2 : 30}, (_, i) => ({ title: `第 ${i+1} 步`, description: '转动模型观察连接，描边只提示本步新增零件。', partIds: [] }))
    }, workSubmission: {enabled:false}
  }, steps: [], resources: [], starter_project_path: null, sort_order: 1, duration_minutes: 30, created_at: '', updated_at: '' }), [model])
  return <main><nav style={{padding:12, display:'flex', gap:16}}>
    <output data-testid="fixture-step">{step}</output>
    <button onClick={() => setStep(Math.max(0,step-1))}>上一步</button>
    <button onClick={() => setStep(step+1)}>下一步</button>
    <button onClick={() => setStep(29)}>空步骤</button>
    <button onClick={() => {setModel(1-model);setStep(0)}}>换模型</button>
    <button onClick={() => setMounted(!mounted)}>挂载切换</button>
  </nav>{mounted && <Building3DWorkspace key={model} courseId={7} lesson={lesson} activeStepIndex={step} onStepChange={setStep} />}</main>
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
