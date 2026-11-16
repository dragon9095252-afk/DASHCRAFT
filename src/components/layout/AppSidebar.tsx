import { NavLink } from 'react-router-dom'
import { Home, LayoutDashboard, LineChart, Settings, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Beranda', icon: Home, end: true },
  { to: '/dashboards', label: 'Dashboard Saya', icon: LayoutDashboard, end: false },
  { to: '/settings', label: 'Pengaturan', icon: Settings, end: false },
]

export function AppSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-white">
          <LineChart className="size-4.5" strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Dashcraft</p>
          <p className="text-[11px] text-muted-foreground">Spreadsheet to dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className="m-3 rounded-lg border bg-secondary/40 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <ShieldCheck className="size-3.5 text-brand" />
          Diproses di browser
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          File Anda tidak dikirim ke server mana pun.
        </p>
      </div>
    </div>
  )
}

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-sidebar-border bg-sidebar lg:block">
      <AppSidebarContent />
    </aside>
  )
}
