import { buttonVariants } from '@/components/ui/button'

/** 自然观察模块统一操作按钮样式（默认 10px 圆角） */
export function natureActionButtonClass(
  role: 'primary' | 'secondary' | 'destructive',
) {
  switch (role) {
    case 'primary':
      return buttonVariants({ tone: 'brand', size: 'default' })
    case 'secondary':
      return buttonVariants({ variant: 'outline', size: 'default' })
    case 'destructive':
      return buttonVariants({ variant: 'destructive', size: 'default' })
  }
}
