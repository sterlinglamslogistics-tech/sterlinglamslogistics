import { AuthProvider } from '@/components/auth-provider'
import { RootShell } from '@/components/root-shell'
import { Toaster } from '@/components/ui/toaster'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RootShell>{children}</RootShell>
      <Toaster />
    </AuthProvider>
  )
}
