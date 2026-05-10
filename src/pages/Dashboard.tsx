import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDashboardData, syncObra } from '@/services/obras'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'

export default function Dashboard() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setError(false)
      const res = await getDashboardData()
      setData(res)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('obras', loadData)
  useRealtime('fases', loadData)
  useRealtime('atividades', loadData)

  const handleCardClick = async (project: any) => {
    if (syncingId) return
    setSyncingId(project.id)
    try {
      if (project.secret_onedrive) {
        await syncObra(project.id)
      }
    } catch (err: any) {
      const msg = err.response?.message || 'Erro ao sincronizar TabObra. Tente novamente.'
      toast.error(msg)
    } finally {
      setSyncingId(null)
      navigate(`/obra/${project.id}`)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Erro ao carregar dados</h2>
        <p className="text-muted-foreground mb-4">Não foi possível carregar as obras.</p>
        <Button onClick={loadData}>Tentar novamente</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Visão geral do andamento das obras ativas
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-muted shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Nenhuma obra atribuída</h2>
          <p className="text-muted-foreground mt-2">Você não possui obras ativas no momento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((project, index) => (
            <Card
              key={project.id}
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-muted animate-slide-up bg-card relative"
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
              onClick={() => handleCardClick(project)}
            >
              {syncingId === project.id && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium text-primary">Sincronizando...</span>
                  </div>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold leading-tight">{project.nome}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-muted-foreground">Progresso global</span>
                    <span className="font-bold text-foreground text-base">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
