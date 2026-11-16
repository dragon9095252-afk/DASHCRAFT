import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/features/home/pages/HomePage'
import { NotFoundPage } from './NotFoundPage'

const DataPreviewPage = lazy(() =>
  import('@/features/import/pages/DataPreviewPage').then((module) => ({
    default: module.DataPreviewPage,
  })),
)
const DashboardBuilderPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardBuilderPage').then((module) => ({
    default: module.DashboardBuilderPage,
  })),
)
const DashboardsPage = lazy(() =>
  import('@/features/dashboards/pages/DashboardsPage').then((module) => ({
    default: module.DashboardsPage,
  })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

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