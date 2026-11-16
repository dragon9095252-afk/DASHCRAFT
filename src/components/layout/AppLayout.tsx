import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { LineChart, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AppSidebar, AppSidebarContent } from './AppSidebar'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Buka menu navigasi">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Navigasi Dashcraft</SheetTitle>
              <AppSidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand text-white">
              <LineChart className="size-3.5" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-semibold">Dashcraft</span>
          </Link>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
