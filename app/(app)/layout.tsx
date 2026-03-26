import { AuthProvider } from '@/components/auth-provider'
import { RootShell } from '@/components/root-shell'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { OrderAlertProvider } from '@/components/order-alert-provider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <OrderAlertProvider>
          <RootShell>{children}</RootShell>
        </OrderAlertProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
