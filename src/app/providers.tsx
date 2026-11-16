import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardStoreProvider } from '@/state/dashboard-store'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <DashboardStoreProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </DashboardStoreProvider>
    </TooltipProvider>
  )
}
