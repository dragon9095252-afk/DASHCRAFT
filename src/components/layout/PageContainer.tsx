import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageContainer({
  children,
  wide = false,
  className,
}: {
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 sm:px-6 lg:px-10',
        wide ? 'max-w-[1440px]' : 'max-w-6xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
