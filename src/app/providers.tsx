import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DashboardStoreProvider } from '@/state/dashboard-store'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <DashboardStoreProvider>
        {children}
        {/* Bottom-right keeps toasts clear of the header actions: sonner pauses the
            dismiss timer while hovered, so a toast over Simpan/Ekspor blocks them. */}
        <Toaster position="bottom-right" richColors closeButton />
      </DashboardStoreProvider>
    </TooltipProvider>
  )
}
