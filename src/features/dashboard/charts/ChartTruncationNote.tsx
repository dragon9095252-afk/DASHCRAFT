export function ChartTruncationNote({
  truncated,
  pointCount,
  totalGroups,
}: {
  truncated: boolean
  pointCount: number
  totalGroups: number
}) {
  if (!truncated) return null

  return (
    <p className="mt-1 text-center text-[11px] text-muted-foreground">
      Menampilkan {pointCount} dari {totalGroups} kelompok.
    </p>
  )
}
