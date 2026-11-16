import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type {
  ChartWidgetConfig,
  DashboardWidget,
  KpiWidgetConfig,
} from '@/domain/dashboard.types'
import { EMPTY_FILTER_STATE, type ActiveFilterState } from '@/domain/filter.types'
import {
  loadDashboardWorkspace,
  saveWorkspace,
  updateStoredFilterState,
} from '@/db/persistence.service'
import { storageErrorMessage, toStorageError } from '@/db/storage-errors'
import { applyFilters, countActiveFilters } from '@/services/filter.service'
import { useDashboardStore } from '@/state/dashboard-store'
import {
  createDefaultChartWidget,
  createDefaultKpiWidget,
} from '@/state/dashboard-widgets'

type HydrationStatus = 'loading' | 'ready' | 'missing' | 'missing-dataset'

export function useDashboardWorkspace() {
  const { dashboardId } = useParams<{ dashboardId: string }>()
  const store = useDashboardStore()
  const {
    getDashboard,
    getDataset,
    getFilterState,
    loadWorkspace,
    markDashboardSaved,
    getDashboardRevision,
    isDashboardDirty,
    isDashboardPersisted,
    addWidget,
    updateWidget: updateStoredWidget,
    removeWidget,
    duplicateWidget: duplicateStoredWidget,
    moveWidget: moveStoredWidget,
    setFilterState,
    resetFilterState,
  } = store

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DashboardWidget | null>(null)
  const [saving, setSaving] = useState(false)
  const filterSaveFailedRef = useRef(false)

  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>(() => {
    if (!dashboardId) return 'missing'
    const existing = getDashboard(dashboardId)
    return existing && getDataset(existing.datasetId) ? 'ready' : 'loading'
  })

  const [statusDashboardId, setStatusDashboardId] = useState(dashboardId)

  if (statusDashboardId !== dashboardId) {
    setStatusDashboardId(dashboardId)
    setHydrationStatus(dashboardId ? 'loading' : 'missing')
  }

  const dashboard = dashboardId ? getDashboard(dashboardId) : undefined
  const dataset = dashboard ? getDataset(dashboard.datasetId) : undefined
  const filterState = dashboard ? getFilterState(dashboard.id) : EMPTY_FILTER_STATE
  const isDirty = dashboard ? isDashboardDirty(dashboard.id) : false
  const isPersisted = dashboard ? isDashboardPersisted(dashboard.id) : false

  useEffect(() => {
    if (!dashboardId) {
      setHydrationStatus('missing')
      return
    }
    if (dashboard && dataset) {
      setHydrationStatus('ready')
      return
    }

    let active = true
    loadDashboardWorkspace(dashboardId)
      .then((result) => {
        if (!active) return
        if (result.status === 'ready') {
          loadWorkspace(result.dataset, result.dashboard, result.filterState)
          setHydrationStatus('ready')
        } else if (result.status === 'missing-dataset') {
          setHydrationStatus('missing-dataset')
        } else {
          setHydrationStatus('missing')
        }
      })
      .catch(() => {
        if (active) setHydrationStatus('missing')
      })

    return () => {
      active = false
    }
  }, [dashboardId, dashboard, dataset, loadWorkspace])

  useEffect(() => {
    if (!dashboard || !isPersisted) return

    const dashboardIdForFilter = dashboard.id
    const timer = setTimeout(() => {
      updateStoredFilterState(dashboardIdForFilter, filterState).catch((cause) => {
        if (filterSaveFailedRef.current) return
        filterSaveFailedRef.current = true
        toast.warning('Filter tidak tersimpan', {
          description: storageErrorMessage(toStorageError(cause)),
        })
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [dashboard, filterState, isPersisted])

  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const filteredRows = useMemo(() => {
    if (!dashboard || !dataset) return []
    return applyFilters(dataset.rows, dashboard.filters, filterState)
  }, [dashboard, dataset, filterState])

  const kpiWidgets = useMemo(
    () =>
      [...(dashboard?.widgets ?? [])]
        .sort((a, b) => a.order - b.order)
        .filter((widget): widget is KpiWidgetConfig => widget.kind === 'kpi'),
    [dashboard],
  )

  const chartWidgets = useMemo(
    () =>
      [...(dashboard?.widgets ?? [])]
        .sort((a, b) => a.order - b.order)
        .filter((widget): widget is ChartWidgetConfig => widget.kind === 'chart'),
    [dashboard],
  )

  const editingWidget = dashboard?.widgets.find((widget) => widget.id === editingWidgetId)

  const saveDashboard = useCallback(async (): Promise<boolean> => {
    if (!dashboard || !dataset) return false

    setSaving(true)
    try {
      const savedRevision = getDashboardRevision(dashboard.id)
      const saved = await saveWorkspace({ dataset, dashboard, filterState })
      markDashboardSaved(saved.id, saved.updatedAt, savedRevision)
      toast.success('Dashboard tersimpan')
      return true
    } catch (cause) {
      toast.error('Dashboard gagal disimpan', {
        description: storageErrorMessage(toStorageError(cause)),
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [dashboard, dataset, filterState, markDashboardSaved, getDashboardRevision])

  function openEditor(widgetId: string) {
    setSelectedWidgetId(widgetId)
    setEditingWidgetId(widgetId)
  }

  function closeEditor() {
    setEditingWidgetId(null)
  }

  function addKpi() {
    if (!dashboard || !dataset) return
    const widget = createDefaultKpiWidget(dataset.columns, dashboard.widgets.length)
    addWidget(dashboard.id, widget)
    openEditor(widget.id)
    toast.success('KPI ditambahkan')
  }

  function addChart() {
    if (!dashboard || !dataset) return
    const widget = createDefaultChartWidget(dataset.columns, dashboard.widgets.length)
    addWidget(dashboard.id, widget)
    openEditor(widget.id)
    toast.success('Grafik ditambahkan')
  }

  function duplicateWidget(widgetId: string) {
    if (!dashboard) return
    const duplicated = duplicateStoredWidget(dashboard.id, widgetId)
    if (!duplicated) return
    setSelectedWidgetId(duplicated.id)
    toast.success('Visual diduplikasi')
  }

  function updateWidget(widget: DashboardWidget) {
    if (!dashboard) return
    updateStoredWidget(dashboard.id, widget)
  }

  function moveWidget(widgetId: string, direction: 'up' | 'down') {
    if (!dashboard) return
    moveStoredWidget(dashboard.id, widgetId, direction)
  }

  function updateFilters(state: ActiveFilterState) {
    if (!dashboard) return
    setFilterState(dashboard.id, state)
  }

  function resetFilters() {
    if (!dashboard) return
    resetFilterState(dashboard.id)
    toast.success('Filter direset')
  }

  function confirmDelete() {
    if (!dashboard || !pendingDelete) return
    removeWidget(dashboard.id, pendingDelete.id)
    if (editingWidgetId === pendingDelete.id) setEditingWidgetId(null)
    if (selectedWidgetId === pendingDelete.id) setSelectedWidgetId(null)
    setPendingDelete(null)
    toast.success('Visual dihapus')
  }

  return {
    dashboard,
    dataset,
    filterState,
    filteredRows,
    kpiWidgets,
    chartWidgets,
    editingWidget,
    selectedWidgetId,
    pendingDelete,
    hydrationStatus,
    isDirty,
    isPersisted,
    saving,
    activeFilterCount: countActiveFilters(filterState),
    saveDashboard,
    openEditor,
    closeEditor,
    addKpi,
    addChart,
    duplicateWidget,
    updateWidget,
    moveWidget,
    updateFilters,
    resetFilters,
    requestDelete: setPendingDelete,
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  }
}
