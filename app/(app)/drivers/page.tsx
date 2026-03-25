"use client"

import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Star,
  Eye,
  Power,
  Edit,
  Key,
  Trash2,
  MoreHorizontal,
  Phone,
  MapPin,
  Mail,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { fetchDrivers, updateDriver, deleteDriver } from "@/lib/firestore"
import { toast } from "@/hooks/use-toast"
import type { Driver } from "@/lib/data"

const DRIVER_STATUSES = [
  { value: "available", label: "Available" },
  { value: "on-delivery", label: "On Delivery" },
  { value: "offline", label: "Offline" },
] as const

const driverFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  area: z.string().optional(),
  vehicle: z.string().min(1, "Vehicle is required"),
  status: z.enum(["available", "on-delivery", "offline"]),
  note: z.string().optional(),
  password: z.string().optional(),
})

type DriverFormData = z.infer<typeof driverFormSchema>

function DriverStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    available: "bg-success/15 text-success border-success/20",
    "on-delivery": "bg-warning/15 text-warning border-warning/20",
    offline: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/20",
  }

  const labels: Record<string, string> = {
    available: "Available",
    "on-delivery": "On Delivery",
    offline: "Offline",
  }

  return (
    <Badge variant="outline" className={variants[status] ?? ""}>
      {labels[status] ?? status}
    </Badge>
  )
}

export default function DriversPage() {
  const [allDrivers, setAllDrivers] = useState<Driver[]>([])
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const editForm = useForm<DriverFormData>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      area: "",
      vehicle: "",
      status: "available",
      note: "",
    },
  })

  const resetForm = useForm({
    defaultValues: { password: "" },
  })

  // Load drivers on mount
  useEffect(() => {
    loadDrivers()
  }, [])

  async function loadDrivers() {
    try {
      const data = await fetchDrivers()
      setAllDrivers(data)
    } catch (error) {
      console.error("Failed to load drivers:", error)
      setAllDrivers([])
    }
  }

  function openProfile(driver: Driver) {
    setSelectedDriver(driver)
    setProfileOpen(true)
  }

  function openEdit(driver: Driver) {
    setSelectedDriver(driver)
    editForm.reset({
      name: driver.name,
      phone: driver.phone,
      email: driver.email || "",
      area: driver.area || "",
      vehicle: driver.vehicle,
      status: driver.status,
      note: driver.note || "",
    })
    setEditOpen(true)
  }

  function openDeleteDialog(driver: Driver) {
    setSelectedDriver(driver)
    setDeleteOpen(true)
  }

  function openResetPassword(driver: Driver) {
    setSelectedDriver(driver)
    resetForm.reset({ password: "" })
    setResetPasswordOpen(true)
  }

  async function handleEndShift(driver: Driver) {
    setIsLoading(true)
    try {
      await updateDriver(driver.id, { status: "offline" })
      const updated = allDrivers.map((d) =>
        d.id === driver.id ? { ...d, status: "offline" as const } : d
      )
      setAllDrivers(updated)
      toast({
        title: "Shift ended",
        description: `${driver.name}'s status set to offline.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end shift. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleEditSubmit(data: DriverFormData) {
    if (!selectedDriver) return
    setIsLoading(true)
    try {
      await updateDriver(selectedDriver.id, data)
      const updated = allDrivers.map((d) =>
        d.id === selectedDriver.id ? { ...d, ...data } : d
      )
      setAllDrivers(updated)
      setEditOpen(false)
      toast({
        title: "Driver updated",
        description: `${data.name}'s details have been updated.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update driver. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleResetPassword(data: { password: string }) {
    if (!selectedDriver) return
    setIsLoading(true)
    try {
      await updateDriver(selectedDriver.id, { password: data.password })
      const updated = allDrivers.map((d) =>
        d.id === selectedDriver.id ? { ...d, password: data.password } : d
      )
      setAllDrivers(updated)
      setResetPasswordOpen(false)
      toast({
        title: "Password reset",
        description: `${selectedDriver.name}'s password has been reset.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!selectedDriver) return
    setIsLoading(true)
    try {
      await deleteDriver(selectedDriver.id)
      const updated = allDrivers.filter((d) => d.id !== selectedDriver.id)
      setAllDrivers(updated)
      setDeleteOpen(false)
      toast({
        title: "Driver deleted",
        description: `${selectedDriver.name} has been permanently deleted.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete driver. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Drivers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage delivery drivers
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Driver Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="hidden md:table-cell">Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="pr-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allDrivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {driver.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <span className="font-medium text-foreground">{driver.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{driver.phone}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {driver.vehicle}
                </TableCell>
                <TableCell>
                  <DriverStatusBadge status={driver.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="size-3.5 fill-warning text-warning" />
                    <span className="text-sm font-medium text-foreground">{driver.rating}</span>
                  </div>
                </TableCell>
                <TableCell className="pr-8">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openProfile(driver)}>
                        <Eye className="mr-2 h-4 w-4" /> View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEndShift(driver)} disabled={isLoading}>
                        <Power className="mr-2 h-4 w-4" /> End shift
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(driver)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openResetPassword(driver)}>
                        <Key className="mr-2 h-4 w-4" /> Reset password
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => openDeleteDialog(driver)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDriver?.name ?? "Driver profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex">
            <div className="w-1/3 border-r p-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarFallback>
                    {selectedDriver
                      ? selectedDriver.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                      : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h2 className="text-lg font-semibold">
                    {selectedDriver?.name}
                  </h2>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="size-4 fill-warning text-warning" />
                    <span>{selectedDriver?.rating}</span>
                  </div>
                  <Badge className="mt-2">
                    {selectedDriver?.status}
                  </Badge>
                </div>
                <div className="space-y-2 self-start">
                  {selectedDriver?.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="size-4" />
                      {selectedDriver.phone}
                    </div>
                  )}
                  {selectedDriver?.area && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="size-4" />
                      {selectedDriver.area}
                    </div>
                  )}
                  {selectedDriver?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="size-4" />
                      {selectedDriver.email}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="w-2/3 p-6">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setProfileOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <Tabs defaultValue="bio">
                <TabsList>
                  <TabsTrigger value="bio">Bio</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                </TabsList>
                <TabsContent value="bio">
                  <div className="space-y-6">
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Personal Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium">Full name</p>
                          <p>{selectedDriver?.name}</p>
                        </div>
                        <div>
                          <p className="font-medium">Phone</p>
                          <p>{selectedDriver?.phone}</p>
                        </div>
                        {selectedDriver?.email && (
                          <div>
                            <p className="font-medium">Email</p>
                            <p>{selectedDriver.email}</p>
                          </div>
                        )}
                        {selectedDriver?.area && (
                          <div>
                            <p className="font-medium">Area</p>
                            <p>{selectedDriver.area}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Vehicle details</h3>
                      <div className="text-sm">
                        <p>{selectedDriver?.vehicle}</p>
                      </div>
                    </div>
                    {selectedDriver?.note && (
                      <div className="rounded-lg border p-4">
                        <h3 className="mb-2 font-semibold">Driver note</h3>
                        <p className="text-sm">{selectedDriver.note}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="reviews">
                  <p className="text-sm text-muted-foreground">No reviews yet.</p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+234 801 234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area</FormLabel>
                    <FormControl>
                      <Input placeholder="Lagos, Nigeria" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="vehicle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <FormControl>
                      <Input placeholder="Toyota Hilux - LG 234 AK" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DRIVER_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any special notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={resetForm.handleSubmit(handleResetPassword)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password"
                {...resetForm.register("password", { required: "Password is required" })}
              />
              {resetForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedDriver?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
