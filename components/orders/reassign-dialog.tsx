"use client"

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Order, Driver } from "@/lib/data"
import { getInitials } from "@/lib/order-utils"

interface ReassignDialogProps {
  reassignOrderId: string | null
  orderList: Order[]
  allDrivers: Driver[]
  isSaving: boolean
  onClose: () => void
  onAssignDriver: (orderId: string, driverId: string) => void
  onUnassignOrder: (orderId: string) => void
  getDriverActiveOrderCount: (driverId: string) => number
}

export function ReassignDialog({
  reassignOrderId,
  orderList,
  allDrivers,
  isSaving,
  onClose,
  onAssignDriver,
  onUnassignOrder,
  getDriverActiveOrderCount,
}: ReassignDialogProps) {
  const reassignOrder = reassignOrderId ? orderList.find((o) => o.id === reassignOrderId) : null

  return (
    <Dialog open={reassignOrderId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xs p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Assign Order</h2>
        </div>
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Drivers</span>
            <span># of Assigned Orders</span>
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto px-4">
          {allDrivers.map((driver) => {
            const count = getDriverActiveOrderCount(driver.id)
            const isCurrentDriver = reassignOrder?.assignedDriver === driver.id
            return (
              <button
                key={driver.id}
                type="button"
                disabled={isCurrentDriver || isSaving}
                onClick={() => { onAssignDriver(reassignOrderId!, driver.id); onClose() }}
                className={`flex w-full items-center justify-between rounded-md px-2 py-2.5 text-left transition hover:bg-secondary/60 ${
                  isCurrentDriver ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-9">
                    <AvatarFallback className="text-xs">{getInitials(driver.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{driver.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{driver.status.replace("-", " ")}</p>
                  </div>
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{count}</span>
              </button>
            )
          })}
        </div>
        {reassignOrderId && reassignOrder?.assignedDriver && (
          <div className="border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isSaving}
              onClick={() => onUnassignOrder(reassignOrderId!)}
            >
              Unassign
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
