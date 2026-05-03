"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Driver } from "@/lib/data"

const UNASSIGNED_DRIVER = "unassigned" as const

interface BulkAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  availableDrivers: Driver[]
  bulkDriverId: string
  onDriverChange: (driverId: string) => void
  onAssign: () => void
  isSaving: boolean
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  selectedCount,
  availableDrivers,
  bulkDriverId,
  onDriverChange,
  onAssign,
  isSaving,
}: BulkAssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Assign Selected Orders</DialogTitle>
          <DialogDescription>
            Assign {selectedCount} selected orders to one driver.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">Driver</p>
          <Select value={bulkDriverId} onValueChange={onDriverChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select driver" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_DRIVER}>Select driver</SelectItem>
              {availableDrivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAssign} disabled={bulkDriverId === UNASSIGNED_DRIVER || isSaving}>
            Assign Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
