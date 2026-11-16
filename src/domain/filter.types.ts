export interface DashboardFilterConfig {
  id: string
  fieldId: string
  kind: 'category' | 'dateRange'
  label: string
}

export interface ActiveFilterState {
  categoryValues: Record<string, string[]>
  dateRanges: Record<string, { start?: string; end?: string }>
}

export const EMPTY_FILTER_STATE: ActiveFilterState = {
  categoryValues: {},
  dateRanges: {},
}
