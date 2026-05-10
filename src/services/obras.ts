import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface Atividade extends RecordModel {
  fase_id: string
  nome_atividade: string
  status_execucao: 'Executado' | 'Não Executado'
  data_inicio_previsto?: string
  data_fim_previsto?: string
  responsavel?: string
  observacao?: string
  foto_url?: string
}

export interface Fase extends RecordModel {
  obra_id: string
  nome_fase: string
}

export interface Obra extends RecordModel {
  nome: string
  id_cliente: string
  coordenador_id: string
  secret_onedrive: string
}

export const getDashboardData = async () => {
  const obras = await pb.collection<Obra>('obras').getFullList({ sort: '-created' })
  const fases = await pb.collection<Fase>('fases').getFullList()
  const atividades = await pb.collection<Atividade>('atividades').getFullList()

  return obras.map((obra) => {
    const obraFasesIds = fases.filter((f) => f.obra_id === obra.id).map((f) => f.id)
    const obraAtividades = atividades.filter((a) => obraFasesIds.includes(a.fase_id))

    const total = obraAtividades.length
    const executado = obraAtividades.filter((a) => a.status_execucao === 'Executado').length
    const progress = total > 0 ? Math.round((executado / total) * 100) : 0

    return {
      ...obra,
      progress,
    }
  })
}

export const getObraDetailsData = async (obraId: string) => {
  const obra = await pb.collection<Obra>('obras').getOne(obraId)
  const fases = await pb
    .collection<Fase>('fases')
    .getFullList({ filter: `obra_id="${obraId}"`, sort: 'created' })
  const atividades = await pb
    .collection<Atividade>('atividades')
    .getFullList({ filter: `fase_id.obra_id="${obraId}"`, sort: 'created' })

  const totalObra = atividades.length
  const executadoObra = atividades.filter((a) => a.status_execucao === 'Executado').length
  const progressObra = totalObra > 0 ? Math.round((executadoObra / totalObra) * 100) : 0

  const fasesEnriched = fases.map((fase) => {
    const faseAtividades = atividades.filter((a) => a.fase_id === fase.id)
    const total = faseAtividades.length
    const executado = faseAtividades.filter((a) => a.status_execucao === 'Executado').length
    const progress = total > 0 ? Math.round((executado / total) * 100) : 0

    return {
      ...fase,
      progress,
      atividades: faseAtividades,
    }
  })

  return {
    obra: { ...obra, progress: progressObra },
    fases: fasesEnriched,
  }
}

export const updateAtividade = (id: string, updates: Partial<Atividade>) =>
  pb.collection<Atividade>('atividades').update(id, updates)

export const syncObra = (id: string) => pb.send(`/backend/v1/obras/${id}/sync`, { method: 'POST' })
