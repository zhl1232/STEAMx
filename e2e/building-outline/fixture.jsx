import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Building3DWorkspace } from '@/components/features/courses/building-3d-workspace'
import '@/app/globals.css'
const models = ['3-hu-die.mpd', '3-hua-lan.mpd']
function App() {
  const [step, setStep] = useState(0)
  const [model, setModel] = useState(0)
  const [mounted, setMounted] = useState(true)
  const lesson = React.useMemo(() => ({ id: model + 1, course_id: 7, title: '本步新增积木', lesson_type: 'building_3d', content: {
    building3d: { ldrawModelUrl: `/courses/ldraw/${models[model]}`, parts: [], steps3d: Array.from({length: 30}, (_, i) => ({ title: `第 ${i+1} 步`, description: '转动模型观察连接，描边只提示本步新增零件。', partIds: [] })) }, workSubmission: {enabled:false}
  }, steps: [], resources: [], starter_project_path: null, sort_order: 1, duration_minutes: 30, created_at: '', updated_at: '' }), [model])
  return <main><nav style={{padding:12, display:'flex', gap:16}}>
    <button onClick={() => setStep(Math.max(0,step-1))}>上一步</button>
    <button onClick={() => setStep(step+1)}>下一步</button>
    <button onClick={() => setStep(29)}>空步骤</button>
    <button onClick={() => {setModel(1-model);setStep(0)}}>换模型</button>
    <button onClick={() => setMounted(!mounted)}>挂载切换</button>
  </nav>{mounted && <Building3DWorkspace key={model} courseId={7} lesson={lesson} activeStepIndex={step} onStepChange={setStep} />}</main>
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
