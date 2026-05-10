import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
  Camera,
  PenLine,
  RefreshCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { getObraDetailsData, updateAtividade, syncObra } from '@/services/obras'
import { useRealtime } from '@/hooks/use-realtime'
import { toast } from 'sonner'

const ActivityCard = ({ ativ, onUpdate }: any) => {
  const [obs, setObs] = useState(ativ.observacao || '')
  const [url, setUrl] = useState(ativ.foto_url || '')

  return (
    <div className="flex flex-col gap-3 p-4 bg-muted/20 hover:bg-muted/30 transition-colors rounded-lg border border-muted/60">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={ativ.status_execucao === 'Executado'}
          onCheckedChange={(checked) =>
            onUpdate(ativ.id, { status_execucao: checked ? 'Executado' : 'Não Executado' })
          }
          className="mt-1 h-5 w-5"
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-base font-semibold leading-tight ${ativ.status_execucao === 'Executado' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {ativ.nome_atividade}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-medium text-muted-foreground">
            {ativ.responsavel && <span>Resp: {ativ.responsavel}</span>}
            {ativ.data_inicio_previsto && (
              <span>Início: {ativ.data_inicio_previsto.split(' ')[0]}</span>
            )}
            {ativ.data_fim_previsto && <span>Fim: {ativ.data_fim_previsto.split(' ')[0]}</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8 mt-1">
        <div className="relative">
          <Camera className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Adicionar link de foto..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              if (url !== (ativ.foto_url || '')) onUpdate(ativ.id, { foto_url: url })
            }}
            className="h-9 pl-9 text-sm bg-background border-muted"
          />
        </div>
        <div className="relative">
          <PenLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Textarea
            placeholder="Adicionar observação..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => {
              if (obs !== (ativ.observacao || '')) onUpdate(ativ.id, { observacao: obs })
            }}
            className="min-h-[36px] py-2 pl-9 text-sm bg-background border-muted resize-none"
          />
        </div>
      </div>
    </div>
  )
}

export default function ObraDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState(false)
  const [data, setData] = useState<any>(null)

  const handleSync = async () => {
    if (!id) return
    setIsSyncing(true)
    try {
      const res = await syncObra(id)
      window.alert(res.mensagem)
      window.location.reload()
    } catch (err: any) {
      window.alert(`Erro: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

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

  const handleUpdateActivity = async (atividadeId: string, updates: any) => {
    setData((prev: any) => {
      if (!prev) return prev
      const newFases = prev.fases.map((f: any) => {
        const newAtiv = f.atividades.map((a: any) => {
          if (a.id === atividadeId) {
            return { ...a, ...updates }
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
      await updateAtividade(atividadeId, updates)
    } catch (err) {
      toast.error('Erro ao salvar alterações.')
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
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto pb-10">
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
        {!isLoading && obra?.secret_onedrive && (
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            className="shrink-0 font-semibold"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 sm:mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
        )}
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
                <span className="font-bold text-3xl text-primary leading-none">
                  {obra?.progress}%
                </span>
              </div>
              <Progress value={obra?.progress} className="h-4" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-2">
        <h3 className="text-xl font-bold text-foreground mb-6">Fases do Projeto</h3>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : fases?.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed border-muted">
            <p className="text-muted-foreground font-medium">Nenhuma fase encontrada</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full space-y-4">
            {fases?.map((phase: any, index: number) => {
              const total = phase.atividades?.length || 0
              const concluidas =
                phase.atividades?.filter((a: any) => a.status_execucao === 'Executado').length || 0
              return (
                <AccordionItem
                  key={phase.id}
                  value={phase.id}
                  className="border border-muted bg-card rounded-lg overflow-hidden shadow-sm animate-slide-up"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full pr-4 text-left">
                      <div className="flex items-center gap-3 shrink-0">
                        {phase.progress === 100 ? (
                          <CheckCircle2 className="h-8 w-8 text-primary shrink-0" />
                        ) : phase.progress > 0 ? (
                          <div className="relative shrink-0 flex items-center justify-center h-8 w-8">
                            <Circle className="h-8 w-8 text-muted absolute" />
                            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 100 100">
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
                          <Circle className="h-8 w-8 text-muted shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold truncate text-foreground">
                          {phase.nome_fase}
                        </h4>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                          {concluidas} de {total} atividades concluídas
                        </p>
                      </div>
                      <div className="w-full sm:w-48 shrink-0 mt-2 sm:mt-0">
                        <div className="flex justify-between text-xs mb-1 font-semibold text-muted-foreground">
                          <span>Progresso</span>
                          <span>{phase.progress}%</span>
                        </div>
                        <Progress value={phase.progress} className="h-2" />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-5 pt-3 border-t border-muted bg-muted/5">
                    {total === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6 font-medium">
                        Nenhuma atividade encontrada
                      </p>
                    ) : (
                      <div className="space-y-3 mt-2">
                        {phase.atividades.map((ativ: any) => (
                          <ActivityCard key={ativ.id} ativ={ativ} onUpdate={handleUpdateActivity} />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </div>
    </div>
  )
}
