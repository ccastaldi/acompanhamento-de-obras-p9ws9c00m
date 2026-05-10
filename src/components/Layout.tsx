import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { isAuthenticated, logout, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-muted shadow-sm transition-all">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-2xl font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            Singolarita
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
              <User className="h-4 w-4" />
              <span className="font-medium truncate max-w-[200px]">{user?.email}</span>
            </div>
            <Button
              variant="ghost"
              onClick={logout}
              className="text-foreground hover:bg-muted/50 gap-2 font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-muted py-6 bg-card text-center">
        <p className="text-sm text-muted-foreground font-medium">
          © 2024 Singolarita - Acompanhamento de Obras
        </p>
      </footer>
    </div>
  )
}
