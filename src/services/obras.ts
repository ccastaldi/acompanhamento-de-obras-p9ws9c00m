import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'

export interface DashboardData {
  totalFases: number
  totalAtividades: number
  statusCounts: Record<string, number>
}

export interface SyncResult {
  sucesso: boolean
  mensagem: string
}

type Record = { [key: string]: any; id: string }

interface DashboardObra {
  id: string
  nome: string
  progress: number
  secret_onedrive?: string
}

export async function getDashboardData(): Promise<DashboardObra[]> {
  const obrasRecords: Record[] = await pb.collection('obras').getFullList()
  const atividadesRecords: Record[] = await pb.collection('atividades').getFullList()

  const atividadesByObraId = new Map<string, Record[]>()
  for (const atividade of atividadesRecords) {
    const obraId = atividade.obra
    if (obraId && typeof obraId === 'string') {
      if (!atividadesByObraId.has(obraId)) {
        atividadesByObraId.set(obraId, [])
      }
      atividadesByObraId.get(obraId)!.push(atividade)
    }
  }

  const dashboardObras: DashboardObra[] = []
  for (const obra of obrasRecords) {
    const nome: string = obra.nome_obra ?? obra.nome ?? 'Sem nome'
    const atividades = atividadesByObraId.get(obra.id) ?? []
    const totalAtividades = atividades.length
    const atividadesConcluidas = atividades.filter(
      (atividade) => atividade.status_execucao === 'Executado',
    ).length
    const progress =
      totalAtividades > 0
        ? Math.round((atividadesConcluidas / totalAtividades) * 100 * 100) / 100
        : 0

    const dashboardObra: DashboardObra = {
      id: obra.id,
      nome,
      progress,
    }

    if (obra.secret_onedrive) {
      dashboardObra.secret_onedrive = obra.secret_onedrive
    }

    dashboardObras.push(dashboardObra)
  }

  return dashboardObras
}

export async function getObraDetailsData(obraId: string) {
  try {
    const obra = await pb.collection('obras').getOne(obraId)
    const fases = await pb.collection('fases').getFullList({
      filter: `obra_id = '${obraId}'`,
      sort: '+nome_fase',
    })
    const atividades = await pb.collection('atividades').getFullList({
      filter: `fase_id.obra_id = '${obraId}'`,
      sort: '+nome_atividade',
    })

    const fasesWithAtividades = fases.map((fase) => {
      const ativs = atividades.filter((a) => a.fase_id === fase.id)
      const concluidas = ativs.filter((a) => a.status_execucao === 'Executado').length
      return {
        ...fase,
        atividades: ativs,
        progress: ativs.length > 0 ? Math.round((concluidas / ativs.length) * 100) : 0,
      }
    })

    const totalAtivs = atividades.length
    const totalConcluidas = atividades.filter((a) => a.status_execucao === 'Executado').length
    const obraProgress = totalAtivs > 0 ? Math.round((totalConcluidas / totalAtivs) * 100) : 0

    return {
      obra: {
        ...obra,
        progress: obraProgress,
      },
      fases: fasesWithAtividades,
    }
  } catch (error) {
    console.error('Erro ao obter detalhes da obra:', error)
    throw new Error('Falha ao carregar detalhes da obra')
  }
}

export async function updateAtividade(atividadeId: string, updates: any) {
  try {
    return await pb.collection('atividades').update(atividadeId, updates)
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error)
    throw new Error('Falha ao atualizar atividade')
  }
}

export async function syncObra(obraId: string): Promise<SyncResult> {
  try {
    console.log(`[syncObra] Iniciando sincronização para obra ${obraId}`)

    // Chamar Edge Function de sincronização (agendada a cada 5 min)
    const response = await fetch('/sincronizar-onedrive-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obra_id: obraId }),
    })

    if (!response.ok) {
      throw new Error(`Falha na sincronização: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.sucesso) {
      return {
        sucesso: true,
        mensagem: `Sincronização concluída! ${data.sincronizadas} criadas, ${data.atualizadas} atualizadas.`,
      }
    } else {
      throw new Error(data.erro || 'Erro desconhecido na sincronização')
    }
  } catch (error) {
    console.error('[syncObra] Erro:', error)
    return {
      sucesso: false,
      mensagem: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    }
  }
}
