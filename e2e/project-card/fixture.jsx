import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ProjectCard } from '@/components/features/project-card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import '@/app/globals.css'

const variants = [
  { name: 'default', variant: 'default' },
  { name: 'mobile-compact', variant: 'default', mobileCompact: true },
  { name: 'featured', variant: 'featured' },
  ...['adaptive', 'vertical', 'dense'].map(compactLayout => ({ name: compactLayout, variant: 'compact', compactLayout })),
  { name: 'explore', variant: 'explore' },
]
const project = {
  id: 42, title: '会跑的小车：观察轮子怎样运动，再试试不同材料和坡度的变化',
  author: '测试作者', author_id: '', image: '', likes: 3, category: '工程', description: '这是一张用于本地交互验收的项目卡片。',
}

function App() {
  const [result, setResult] = useState('')
  return <main style={{ padding: 16 }}>
    <output data-testid="result" style={{ display: 'block', minHeight: 24 }}>{result}</output>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
      {variants.map(({ name, ...props }) => <section key={name} data-testid={name} style={{ position: 'relative' }}
        onClick={event => {
          const link = event.target.closest('a')
          if (link && !event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            setResult(`${name}:${link.getAttribute('href')}`)
          }
        }}
        onContextMenu={event => {
          const link = event.target.closest('a')
          if (link) setResult(`context:${name}:${link.textContent}`)
        }}
      >
        <ProjectCard project={project} {...props} searchQuery="小车" href="/project/42/records" scroll={false} />
        {/* Exercise an independent sibling control above the stretched card link. */}
        <div className="absolute right-2 top-2 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button aria-label={`${name}菜单`}>菜单</button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setResult(`menu:${name}`)}>测试操作</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>)}
    </div>
  </main>
}
createRoot(document.getElementById('root')).render(<App />)
