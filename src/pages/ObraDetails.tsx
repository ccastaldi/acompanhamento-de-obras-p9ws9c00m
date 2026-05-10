import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getObraDetailsData, updateAtividadeStatus } from '@/services/obras'
import { useRealtime } from '@/hooks/use-realtime'

export default function ObraDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<any>(null)

  const loadData = async () => {
    if (!id) return
    try {
      setError(false)
      const res = await getObraDetailsData(id)
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
  }, [id])

  useRealtime('obras', loadData)
  useRealtime('fases', loadData)
  useRealtime('atividades', loadData)

  const toggleAtividade = async (atividadeId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Executado' ? 'Não Executado' : 'Executado'
    setData((prev: any) => {
      if (!prev) return prev
      const newFases = prev.fases.map((f: any) => {
        const newAtiv = f.atividades.map((a: any) => {
          if (a.id === atividadeId) {
            return { ...a, status_execucao: newStatus }
          }
          return a
        })
        const total = newAtiv.length
        const exec = newAtiv.filter((a: any) => a.status_execucao === 'Executado').length
        return {
          ...f,
          atividades: newAtiv,
          progress: total > 0 ? Math.round((exec / total) * 100) : 0,
        }
      })

      const allAtivs = newFases.flatMap((f: any) => f.atividades)
      const totalObra = allAtivs.length
      const execObra = allAtivs.filter((a: any) => a.status_execucao === 'Executado').length

      return {
        ...prev,
        fases: newFases,
        obra: {
          ...prev.obra,
          progress: totalObra > 0 ? Math.round((execObra / totalObra) * 100) : 0,
        },
      }
    })

    try {
      await updateAtividadeStatus(atividadeId, newStatus)
    } catch (err) {
      loadData()
    }
  }

  if (error) {
    return (
      <div className="text-center py-20 animate-fade-in max-w-lg mx-auto">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground">Erro ao carregar obra</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Não foi possível carregar os detalhes desta obra.
        </p>
        <Button onClick={loadData} variant="default" className="font-semibold">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  if (!isLoading && !data?.obra) {
    return (
      <div className="text-center py-20 animate-fade-in max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-foreground">Obra não encontrada</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          A obra que você está procurando não existe ou você não tem acesso.
        </p>
        <Button onClick={() => navigate('/dashboard')} variant="default" className="font-semibold">
          Voltar para o Dashboard
        </Button>
      </div>
    )
  }

  const { obra, fases } = data || {}

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="shrink-0 hover:bg-muted border-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
            {isLoading ? <Skeleton className="h-8 w-48 sm:w-80" /> : obra?.nome}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base truncate">
            Detalhamento das fases da obra
          </p>
        </div>
      </div>

      <Card className="border-muted shadow-sm bg-card">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="text-lg">Progresso Geral</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-medium text-muted-foreground">Concluído</span>
                <span className="font-bold text-3xl text-foreground leading-none">
                  {obra?.progress}%
                </span>
              </div>
              <Progress value={obra?.progress} className="h-4" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-4">
        <h3 className="text-xl font-bold text-foreground mb-4">Fases do Projeto</h3>

        <div className="grid grid-cols-1 gap-4">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="border-muted shadow-sm">
                  <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))
            : fases?.map((phase: any, index: number) => (
                <Card
                  key={phase.id}
                  className="border-muted shadow-sm transition-shadow animate-slide-up bg-card group"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        {phase.progress === 100 ? (
                          <CheckCircle2 className="h-10 w-10 text-primary shrink-0 transition-transform group-hover:scale-110" />
                        ) : phase.progress > 0 ? (
                          <div className="relative shrink-0 flex items-center justify-center h-10 w-10">
                            <Circle className="h-10 w-10 text-muted absolute" />
                            <svg
                              className="h-10 w-10 -rotate-90 transition-transform group-hover:scale-110"
                              viewBox="0 0 100 100"
                            >
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="12"
                                className="text-primary"
                                strokeDasharray={`${phase.progress * 2.513} 251.3`}
                              />
                            </svg>
                          </div>
                        ) : (
                          <Circle className="h-10 w-10 text-muted shrink-0 transition-transform group-hover:scale-110" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-semibold text-foreground truncate">
                            {phase.nome_fase}
                          </h4>
                        </div>
                      </div>

                      <div className="flex-1 w-full sm:w-auto mt-2 sm:mt-0">
                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="text-muted-foreground font-medium">Progresso</span>
                          <span className="font-bold text-foreground">{phase.progress}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-2.5" />
                      </div>
                    </div>

                    {phase.atividades?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-muted/50 space-y-3">
                        {phase.atividades.map((ativ: any) => (
                          <div key={ativ.id} className="flex items-start gap-3">
                            <Checkbox
                              id={`ativ-${ativ.id}`}
                              checked={ativ.status_execucao === 'Executado'}
                              onCheckedChange={() => toggleAtividade(ativ.id, ativ.status_execucao)}
                              className="mt-1"
                            />
                            <label
                              htmlFor={`ativ-${ativ.id}`}
                              className={`text-sm leading-tight cursor-pointer select-none transition-colors ${ativ.status_execucao === 'Executado' ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}
                            >
                              {ativ.nome_atividade}
                              {ativ.responsavel && (
                                <span className="block text-xs text-muted-foreground mt-0.5 no-underline opacity-100">
                                  Resp: {ativ.responsavel}
                                </span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  )
}
