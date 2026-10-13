'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'

import { SettingsSubpageShell } from '@/app/settings/_components/settings-subpage-shell'
import { ProfileEditor, type ProfileEditorHandle } from '@/components/features/profile/profile-editor'

export default function ProfileSettingsClient() {
  const router = useRouter()
  const editorRef = useRef<ProfileEditorHandle>(null)
  // Do not use history.back(): opening「编辑资料」from the account menu while on `/`
  // (or other non-settings pages) would send the user to the homepage. Replace keeps
  //「我的」as the stable parent for this editor entry.
  const back = () => {
    router.replace('/profile')
  }
  return (
    <SettingsSubpageShell
      title="个人资料"
      fallbackHref="/profile"
      kicker="账号名片"
      description="更新头像、昵称与基础资料。"
      mainClassName="p-0 backdrop-filter-none sm:p-0"
      onBack={() => editorRef.current?.requestLeave(back)}
    >
      <ProfileEditor ref={editorRef} mode="page" onCancel={back} />
    </SettingsSubpageShell>
  )
}
