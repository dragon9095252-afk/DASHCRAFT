import type { Aggregation } from '@/domain/dataset.types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAggregationLabel, requiresNumericColumn } from '@/services/aggregation.service'
import { AGGREGATION_OPTIONS } from './editor-options'

export function AggregationSelect({
  value,
  numericColumnCount,
  onChange,
}: {
  value: Aggregation
  numericColumnCount: number
  onChange: (aggregation: Aggregation) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Aggregation)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {AGGREGATION_OPTIONS.map((aggregation) => {
          const disabled =
            requiresNumericColumn(aggregation) && numericColumnCount === 0
          return (
            <SelectItem key={aggregation} value={aggregation} disabled={disabled}>
              {getAggregationLabel(aggregation)}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
