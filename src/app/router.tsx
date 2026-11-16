import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/features/home/pages/HomePage'
import { DataPreviewPage } from '@/features/import/pages/DataPreviewPage'
import { DashboardBuilderPage } from '@/features/dashboard/pages/DashboardBuilderPage'
import { DashboardsPage } from '@/features/dashboards/pages/DashboardsPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { NotFoundPage } from './NotFoundPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="data-preview/:datasetId" element={<DataPreviewPage />} />
          <Route path="builder/:dashboardId" element={<DashboardBuilderPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
