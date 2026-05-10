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

export const syncObra = async (obraId: string) => {
  const obra = await pb.collection<Obra>('obras').getOne(obraId)

  if (!obra.secret_onedrive) {
    throw new Error('URL do OneDrive não configurada para esta obra.')
  }

  try {
    const response = await fetch(obra.secret_onedrive)
    if (!response.ok) throw new Error('Erro ao baixar arquivo do OneDrive.')

    const arrayBuffer = await response.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets['orc_obra']
    const data = XLSX.utils.sheet_to_json(worksheet)

    // Processar dados e sincronizar com banco
    for (const row of data) {
      const nomeFase = row['Fase Obra']
      const nomeAtividade = row['Atividades']
      const statusExecucao = row['Status Execução'] || 'Não Executado'
      const dataInicioPrevisto = row['Ini Prev']
        ? new Date(row['Ini Prev']).toISOString().split('T')[0]
        : ''
      const dataFimPrevisto = row['Fim Prev']
        ? new Date(row['Fim Prev']).toISOString().split('T')[0]
        : ''
      const responsavel = row['Resp'] || ''

      // Criar ou atualizar fase
      let fase = await pb
        .collection<Fase>('fases')
        .getFirstListItem(`obra_id="${obraId}" && nome_fase="${nomeFase}"`, { $autoCancel: false })
        .catch(() => null)

      if (!fase) {
        fase = await pb.collection<Fase>('fases').create({
          obra_id: obraId,
          nome_fase: nomeFase,
        })
      }

      // Criar ou atualizar atividade
      let atividade = await pb
        .collection<Atividade>('atividades')
        .getFirstListItem(`fase_id="${fase.id}" && nome_atividade="${nomeAtividade}"`, {
          $autoCancel: false,
        })
        .catch(() => null)

      if (!atividade) {
        await pb.collection<Atividade>('atividades').create({
          fase_id: fase.id,
          nome_atividade: nomeAtividade,
          status_execucao: statusExecucao,
          data_inicio_previsto: dataInicioPrevisto,
          data_fim_previsto: dataFimPrevisto,
          responsavel: responsavel,
        })
      } else {
        await pb.collection<Atividade>('atividades').update(atividade.id, {
          status_execucao: statusExecucao,
          data_inicio_previsto: dataInicioPrevisto,
          data_fim_previsto: dataFimPrevisto,
          responsavel: responsavel,
        })
      }
    }

    return { sucesso: true, mensagem: 'TabObra sincronizada com sucesso!' }
  } catch (err: any) {
    throw new Error(err.message || 'Erro ao sincronizar TabObra. Tente novamente.')
  }
}
