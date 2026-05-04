import { AuthProvider } from '@/components/auth-provider'
import { RootShell } from '@/components/root-shell'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { OrderAlertProvider } from '@/components/order-alert-provider'
import { ErrorBoundary } from '@/components/error-boundary'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <AuthProvider>
        <OrderAlertProvider>
          <ErrorBoundary>
            <RootShell>{children}</RootShell>
          </ErrorBoundary>
        </OrderAlertProvider>
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  )
}
