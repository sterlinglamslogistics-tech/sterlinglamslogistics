import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "@/lib/constants"

const variants: Record<string, string> = {
  [ORDER_STATUS.UNASSIGNED]: "bg-warning/15 text-warning border-warning/20",
  [ORDER_STATUS.STARTED]: "bg-primary/15 text-primary border-primary/20",
  [ORDER_STATUS.PICKED_UP]: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  [ORDER_STATUS.IN_TRANSIT]: "bg-chart-2/15 text-chart-2 border-chart-2/20",
  [ORDER_STATUS.DELIVERED]: "bg-success/15 text-success border-success/20",
  [ORDER_STATUS.FAILED]: "bg-destructive/15 text-destructive border-destructive/20",
  [ORDER_STATUS.CANCELLED]: "bg-destructive/15 text-destructive border-destructive/20",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
    </Badge>
  )
}
