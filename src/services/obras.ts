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
    // 1. Download do arquivo via proxy
    const token = pb.authStore.token
    const proxyRes = await fetch(`${pb.baseUrl}/backend/v1/proxy-download`, {
      method: 'POST',
      body: JSON.stringify({ url: obra.secret_onedrive }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
    })

    if (!proxyRes.ok) {
      throw new Error('Erro ao baixar arquivo do OneDrive.')
    }

    const arrayBuffer = await proxyRes.arrayBuffer()

    // 2. Parsear Excel usando a biblioteca global XLSX
    // @ts-expect-error
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = 'orc_obra'
    if (!workbook.Sheets[sheetName]) {
      throw new Error("Arquivo Excel inválido ou aba 'orc_obra' não encontrada.")
    }

    // @ts-expect-error
    const data = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

    // 3. Enviar dados parseados para sincronização
    const res = await pb.send('/backend/v1/sincronizar-tabobra', {
      method: 'POST',
      body: JSON.stringify({
        obra_id: obraId,
        data: data,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return { sucesso: true, mensagem: res?.data?.message || 'TabObra sincronizada com sucesso!' }
  } catch (err: any) {
    const msg =
      err.message || err.response?.message || 'Erro ao sincronizar TabObra. Tente novamente.'
    throw new Error(msg)
  }
}
