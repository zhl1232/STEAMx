'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'

import { SettingsSubpageShell } from '@/app/settings/_components/settings-subpage-shell'
import { ProfileEditor, type ProfileEditorHandle } from '@/components/features/profile/profile-editor'

export default function ProfileSettingsClient() {
  const router = useRouter()
  const editorRef = useRef<ProfileEditorHandle>(null)
  const back = () => {
    if (window.history.length > 1) router.back()
    else router.push('/settings')
  }
  return (
    <SettingsSubpageShell
      title="个人资料"
      kicker="账号名片"
      description="更新头像、昵称与基础资料。"
      mainClassName="p-0 backdrop-filter-none sm:p-0"
      onBack={() => editorRef.current?.requestLeave(back)}
    >
      <ProfileEditor ref={editorRef} mode="page" onCancel={back} />
    </SettingsSubpageShell>
  )
}
