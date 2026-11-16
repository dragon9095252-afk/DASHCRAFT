import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ColumnType, Dataset } from '@/domain/dataset.types'
import type { Dashboard, DashboardWidget } from '@/domain/dashboard.types'
import { EMPTY_FILTER_STATE, type ActiveFilterState } from '@/domain/filter.types'
import { refreshLabelWarnings, withColumnType } from '@/services/data-profiler.service'
import {
  createDashboardFromDataset,
  duplicateDashboardWidget,
  moveDashboardWidget,
  reindexWidgets,
} from './dashboard-widgets'

interface DashboardStoreValue {
  datasets: Dataset[]
  dashboards: Dashboard[]
  getDataset: (id: string) => Dataset | undefined
  getDashboard: (id: string) => Dashboard | undefined
  addDataset: (dataset: Dataset) => void
  updateColumnType: (datasetId: string, columnId: string, type: ColumnType) => Dataset | null
  updateColumnDisplayName: (
    datasetId: string,
    columnId: string,
    displayName: string,
  ) => Dataset | null
  createDashboard: (dataset: Dataset) => Dashboard
  updateWidget: (dashboardId: string, widget: DashboardWidget) => void
  addWidget: (dashboardId: string, widget: DashboardWidget) => void
  removeWidget: (dashboardId: string, widgetId: string) => void
  duplicateWidget: (dashboardId: string, widgetId: string) => DashboardWidget | null
  moveWidget: (dashboardId: string, widgetId: string, direction: 'up' | 'down') => void
  deleteDashboard: (dashboardId: string) => void
  getFilterState: (dashboardId: string) => ActiveFilterState
  setFilterState: (dashboardId: string, state: ActiveFilterState) => void
  resetFilterState: (dashboardId: string) => void
  loadWorkspace: (
    dataset: Dataset,
    dashboard: Dashboard,
    filterState: ActiveFilterState,
  ) => void
  markDashboardSaved: (
    dashboardId: string,
    updatedAt: string,
    savedRevision: number,
  ) => void
  getDashboardRevision: (dashboardId: string) => number
  isDashboardDirty: (dashboardId: string) => boolean
  isDashboardPersisted: (dashboardId: string) => boolean
  resetSession: () => void
  applyDashboardRename: (dashboardId: string, name: string) => void
}

function withoutKey(record: Record<string, true>, key: string): Record<string, true> {
  if (!record[key]) return record
  const next = { ...record }
  delete next[key]
  return next
}

const DashboardStoreContext = createContext<DashboardStoreValue | null>(null)

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [filterStates, setFilterStates] = useState<Record<string, ActiveFilterState>>({})
  const [persistedIds, setPersistedIds] = useState<Record<string, true>>({})
  const [dirtyIds, setDirtyIds] = useState<Record<string, true>>({})
  const revisionsRef = useRef<Record<string, number>>({})

  function bumpRevision(dashboardId: string) {
    revisionsRef.current[dashboardId] = (revisionsRef.current[dashboardId] ?? 0) + 1
  }

  const getDataset = useCallback(
    (id: string) => datasets.find((dataset) => dataset.id === id),
    [datasets],
  )

  const getDashboard = useCallback(
    (id: string) => dashboards.find((dashboard) => dashboard.id === id),
    [dashboards],
  )

  const addDataset = useCallback((dataset: Dataset) => {
    setDatasets((previous) => {
      const existing = previous.findIndex((item) => item.id === dataset.id)
      if (existing === -1) return [...previous, dataset]
      const next = [...previous]
      next[existing] = dataset
      return next
    })
  }, [])

  const updateColumnType = useCallback(
    (datasetId: string, columnId: string, type: ColumnType): Dataset | null => {
      const current = datasets.find((dataset) => dataset.id === datasetId)
      if (!current) return null

      const columns = current.columns.map((column) =>
        column.id === columnId ? withColumnType(column, current.rows, type) : column,
      )
      const updated: Dataset = {
        ...current,
        updatedAt: new Date().toISOString(),
        columns,
        warnings: refreshLabelWarnings(current.warnings, columns, current.rows),
      }
      setDatasets((previous) =>
        previous.map((dataset) => (dataset.id === datasetId ? updated : dataset)),
      )
      return updated
    },
    [datasets],
  )

  const updateColumnDisplayName = useCallback(
    (datasetId: string, columnId: string, displayName: string): Dataset | null => {
      const current = datasets.find((dataset) => dataset.id === datasetId)
      if (!current) return null
      const trimmed = displayName.trim()
      if (!trimmed) return current

      const columns = current.columns.map((column) =>
        column.id === columnId ? { ...column, displayName: trimmed } : column,
      )
      const updated: Dataset = {
        ...current,
        updatedAt: new Date().toISOString(),
        columns,
        warnings: refreshLabelWarnings(current.warnings, columns, current.rows),
      }
      setDatasets((previous) =>
        previous.map((dataset) => (dataset.id === datasetId ? updated : dataset)),
      )
      return updated
    },
    [datasets],
  )

  const createDashboard = useCallback((dataset: Dataset): Dashboard => {
    const dashboard = createDashboardFromDataset(dataset)
    setDashboards((previous) => [dashboard, ...previous])
    setFilterStates((previous) => ({ ...previous, [dashboard.id]: EMPTY_FILTER_STATE }))
    setDirtyIds((previous) => ({ ...previous, [dashboard.id]: true }))
    revisionsRef.current[dashboard.id] = 0
    return dashboard
  }, [])

  const updateWidget = useCallback((dashboardId: string, widget: DashboardWidget) => {
    bumpRevision(dashboardId)
    setDashboards((previous) =>
      previous.map((dashboard) => {
        if (dashboard.id !== dashboardId) return dashboard
        return {
          ...dashboard,
          updatedAt: new Date().toISOString(),
          widgets: dashboard.widgets.map((item) => (item.id === widget.id ? widget : item)),
        }
      }),
    )
    setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
  }, [])

  const addWidget = useCallback((dashboardId: string, widget: DashboardWidget) => {
    bumpRevision(dashboardId)
    setDashboards((previous) =>
      previous.map((dashboard) => {
        if (dashboard.id !== dashboardId) return dashboard
        const widgets = reindexWidgets([...dashboard.widgets, widget])
        return { ...dashboard, updatedAt: new Date().toISOString(), widgets }
      }),
    )
    setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
  }, [])

  const removeWidget = useCallback((dashboardId: string, widgetId: string) => {
    bumpRevision(dashboardId)
    setDashboards((previous) =>
      previous.map((dashboard) => {
        if (dashboard.id !== dashboardId) return dashboard
        return {
          ...dashboard,
          updatedAt: new Date().toISOString(),
          widgets: reindexWidgets(dashboard.widgets.filter((item) => item.id !== widgetId)),
        }
      }),
    )
    setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
  }, [])

  const duplicateWidget = useCallback(
    (dashboardId: string, widgetId: string): DashboardWidget | null => {
      const dashboard = dashboards.find((item) => item.id === dashboardId)
      if (!dashboard) return null

      const result = duplicateDashboardWidget(dashboard.widgets, widgetId)
      if (!result) return null

      bumpRevision(dashboardId)
      setDashboards((previous) =>
        previous.map((item) => {
          if (item.id !== dashboardId) return item
          return {
            ...item,
            updatedAt: new Date().toISOString(),
            widgets: result.widgets,
          }
        }),
      )
      setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
      return result.duplicated
    },
    [dashboards],
  )

  const moveWidget = useCallback(
    (dashboardId: string, widgetId: string, direction: 'up' | 'down') => {
      const dashboard = dashboards.find((item) => item.id === dashboardId)
      if (!dashboard) return

      const widgets = moveDashboardWidget(dashboard.widgets, widgetId, direction)
      if (widgets === dashboard.widgets) return

      bumpRevision(dashboardId)
      setDashboards((previous) =>
        previous.map((item) =>
          item.id === dashboardId
            ? { ...item, updatedAt: new Date().toISOString(), widgets }
            : item,
        ),
      )
      setDirtyIds((previous) => ({ ...previous, [dashboardId]: true }))
    },
    [dashboards],
  )

  const deleteDashboard = useCallback((dashboardId: string) => {
    setDashboards((previous) => previous.filter((dashboard) => dashboard.id !== dashboardId))
    setFilterStates((previous) => {
      const next = { ...previous }
      delete next[dashboardId]
      return next
    })
    setPersistedIds((previous) => withoutKey(previous, dashboardId))
    setDirtyIds((previous) => withoutKey(previous, dashboardId))
    delete revisionsRef.current[dashboardId]
  }, [])

  const getFilterState = useCallback(
    (dashboardId: string) => filterStates[dashboardId] ?? EMPTY_FILTER_STATE,
    [filterStates],
  )

  const setFilterState = useCallback((dashboardId: string, state: ActiveFilterState) => {
    setFilterStates((previous) => ({ ...previous, [dashboardId]: state }))
  }, [])

  const resetFilterState = useCallback((dashboardId: string) => {
    setFilterStates((previous) => ({ ...previous, [dashboardId]: EMPTY_FILTER_STATE }))
  }, [])

  const loadWorkspace = useCallback(
    (dataset: Dataset, dashboard: Dashboard, filterState: ActiveFilterState) => {
      addDataset(dataset)
      setDashboards((previous) => {
        const index = previous.findIndex((item) => item.id === dashboard.id)
        if (index === -1) return [dashboard, ...previous]
        const next = [...previous]
        next[index] = dashboard
        return next
      })
      setFilterStates((previous) => ({ ...previous, [dashboard.id]: filterState }))
      setPersistedIds((previous) => ({ ...previous, [dashboard.id]: true }))
      setDirtyIds((previous) => withoutKey(previous, dashboard.id))
      revisionsRef.current[dashboard.id] = 0
    },
    [addDataset],
  )

  const markDashboardSaved = useCallback(
    (dashboardId: string, updatedAt: string, savedRevision: number) => {
      setPersistedIds((previous) => ({ ...previous, [dashboardId]: true }))
      const currentRevision = revisionsRef.current[dashboardId] ?? 0
      if (currentRevision !== savedRevision) return

      setDashboards((previous) =>
        previous.map((dashboard) =>
          dashboard.id === dashboardId ? { ...dashboard, updatedAt } : dashboard,
        ),
      )
      setDirtyIds((previous) => withoutKey(previous, dashboardId))
    },
    [],
  )

  const getDashboardRevision = useCallback(
    (dashboardId: string) => revisionsRef.current[dashboardId] ?? 0,
    [],
  )

  const isDashboardDirty = useCallback(
    (dashboardId: string) => dirtyIds[dashboardId] === true,
    [dirtyIds],
  )

  const isDashboardPersisted = useCallback(
    (dashboardId: string) => persistedIds[dashboardId] === true,
    [persistedIds],
  )

  const resetSession = useCallback(() => {
    setDatasets([])
    setDashboards([])
    setFilterStates({})
    setPersistedIds({})
    setDirtyIds({})
    revisionsRef.current = {}
  }, [])

  const applyDashboardRename = useCallback((dashboardId: string, name: string) => {
    setDashboards((previous) =>
      previous.map((dashboard) =>
        dashboard.id === dashboardId ? { ...dashboard, name } : dashboard,
      ),
    )
  }, [])

  const value = useMemo<DashboardStoreValue>(
    () => ({
      datasets,
      dashboards,
      getDataset,
      getDashboard,
      addDataset,
      updateColumnType,
      updateColumnDisplayName,
      createDashboard,
      updateWidget,
      addWidget,
      removeWidget,
      duplicateWidget,
      moveWidget,
      deleteDashboard,
      getFilterState,
      setFilterState,
      resetFilterState,
      loadWorkspace,
      markDashboardSaved,
      getDashboardRevision,
      isDashboardDirty,
      isDashboardPersisted,
      resetSession,
      applyDashboardRename,
    }),
    [
      datasets,
      dashboards,
      getDataset,
      getDashboard,
      addDataset,
      updateColumnType,
      updateColumnDisplayName,
      createDashboard,
      updateWidget,
      addWidget,
      removeWidget,
      duplicateWidget,
      moveWidget,
      deleteDashboard,
      getFilterState,
      setFilterState,
      resetFilterState,
      loadWorkspace,
      markDashboardSaved,
      getDashboardRevision,
      isDashboardDirty,
      isDashboardPersisted,
      resetSession,
      applyDashboardRename,
    ],
  )

  return (
    <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>
  )
}

export function useDashboardStore(): DashboardStoreValue {
  const context = useContext(DashboardStoreContext)
  if (!context) {
    throw new Error('useDashboardStore harus dipakai di dalam DashboardStoreProvider.')
  }
  return context
}
