import type { Metadata } from 'next'
import type { ReactNode } from 'react'


export const metadata: Metadata = {
  title: '材料包商城',
  robots: { index: false, follow: false },
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return children
}
