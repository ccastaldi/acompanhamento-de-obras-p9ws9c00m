import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'

type Record = Record<string, any>

interface DashboardData {
  totalFases: number
  totalAtividades: number
  statusCounts: Record<string, number>
}

interface SyncResult {
  sucesso: boolean
  mensagem: string
}

interface DashboardObra {
  id: string
  nome: string
  progress: number
  secret_onedrive?: string
}

export async function getDashboardData(): Promise<DashboardObra[]> {
  try {
    const records = await pb.collection('obras').getFullList({ sort: '-created' })
    return records.map((obra: Record) => ({
      id: obra.id,
      nome: (obra as any).nome || '',
      progress: (obra as any).progress || 0,
      secret_onedrive: (obra as any).secret_onedrive,
    }))
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    throw error
  }
}

export async function getObraDetailsData(obraId: string): Promise<{
  obra: Record<string, any>
  fases: Array<Record<string, any>>
}> {
  try {
    const obra: Record<string, any> = await pb.collection('obras').getOne(obraId)

    const fases: Record<string, any>[] = await pb.collection('fases').getFullList({
      filter: `obra_id = "${obraId}"`,
    })

    const fasesWithAtividades: Array<Record<string, any>> = await Promise.all(
      fases.map(async (fase: Record<string, any>): Promise<Record<string, any>> => {
        const atividades: Record<string, any>[] = await pb.collection('atividades').getFullList({
          filter: `fase_id = "${fase.id}"`,
        })

        const executadas = atividades.filter(
          (ativ: Record<string, any>) => ativ.status_execucao === 'Executado',
        ).length
        const total = atividades.length
        const progress = total > 0 ? Math.round((executadas / total) * 100) : 0

        return {
          ...fase,
          atividades,
          progress,
        } as Record<string, any>
      }),
    )

    return {
      obra,
      fases: fasesWithAtividades,
    }
  } catch (error: unknown) {
    console.error('Erro ao obter detalhes da obra:', error)
    throw error
  }
}

export async function updateAtividade(
  atividadeId: string,
  updates: Partial<Record>,
): Promise<Record> {
  try {
    const updated = await pb.collection('atividades').update(atividadeId, updates)
    return updated
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error)
    throw error
  }
}

export async function syncObra(obraId: string): Promise<SyncResult> {
  try {
    const response = await fetch('/backend/v1/sincronizar_onedrive_excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ obraId }),
    })

    if (!response.ok) {
      throw new Error(`Erro na sincronização: ${response.status} ${response.statusText}`)
    }

    const data: SyncResult = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao sincronizar obra:', error)
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar.',
    }
  }
}
