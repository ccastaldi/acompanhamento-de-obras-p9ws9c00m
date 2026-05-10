import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { mockProjects } from '@/data/mock'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ObraDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  const project = mockProjects.find((p) => p.id === id)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  if (!isLoading && !project) {
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
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {isLoading ? <Skeleton className="h-8 w-48 sm:w-80" /> : project?.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
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
                  {project?.progress}%
                </span>
              </div>
              <Progress value={project?.progress} className="h-4" />
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
            : project?.phases.map((phase, index) => (
                <Card
                  key={phase.id}
                  className="border-muted shadow-sm hover:shadow-md transition-shadow animate-slide-up bg-card group"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
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
                          {phase.name}
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
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  )
}
