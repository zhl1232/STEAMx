import { buttonVariants } from '@/components/ui/button'

/** 自然观察模块统一操作按钮样式（pill + h-10） */
export function natureActionButtonClass(
  role: 'primary' | 'secondary' | 'destructive',
) {
  switch (role) {
    case 'primary':
      return buttonVariants({ tone: 'nature', shape: 'pill', size: 'default' })
    case 'secondary':
      return buttonVariants({ variant: 'outline', shape: 'pill', size: 'default' })
    case 'destructive':
      return buttonVariants({ variant: 'destructive', shape: 'pill', size: 'default' })
  }
}
