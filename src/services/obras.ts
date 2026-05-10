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

export async function getDashboardData(obraId: string): Promise<DashboardData> {
  try {
    const fasesResult = await pb.collection('fases').getList(1, 100, {
      filter: `obra_id = '${obraId}'`,
    })
    const atividades = await pb.collection('atividades').getFullList({
      filter: `fase_id.obra_id = '${obraId}'`,
    })

    const statusCounts: Record<string, number> = {}
    atividades.forEach((ativ: any) => {
      const status = ativ.status_execucao || 'Sem status'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    return {
      totalFases: fasesResult.totalItems,
      totalAtividades: atividades.length,
      statusCounts,
    }
  } catch (error) {
    console.error('Erro ao obter dashboard data:', error)
    throw new Error('Falha ao carregar dados do dashboard')
  }
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
    const obra = await pb.collection('obras').getOne(obraId)
    if (!obra.secret_onedrive) {
      throw new Error('URL do OneDrive não configurada para esta obra.')
    }

    console.log('Iniciando download do arquivo Excel do OneDrive via proxy...')

    let proxyResponse
    try {
      proxyResponse = await fetch(`${pb.baseUrl}/backend/v1/download_excel_onedrive`, {
        method: 'POST',
        body: JSON.stringify({ onedrive_url: obra.secret_onedrive }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
      })
    } catch (fetchErr: any) {
      throw new Error(fetchErr.message || 'Erro de rede ao baixar o arquivo.')
    }

    if (!proxyResponse.ok) {
      let erroMsg = 'Erro ao baixar arquivo.'
      try {
        const errJson = await proxyResponse.json()
        erroMsg = errJson.erro || errJson.message || erroMsg
      } catch {
        /* intentionally ignored */
      }
      throw new Error(erroMsg)
    }

    const arrayBuffer = await proxyResponse.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]

    if (data.length < 1) {
      throw new Error('Arquivo Excel vazio ou inválido.')
    }

    const headers = data[0] as string[]
    const colFase = headers.findIndex((h) => typeof h === 'string' && h.trim() === 'Fase Obra')
    const colAtividades = headers.findIndex(
      (h) => typeof h === 'string' && h.trim() === 'Atividades',
    )
    const colStatus = headers.findIndex(
      (h) => typeof h === 'string' && h.trim() === 'Status Execução',
    )
    const colIniPrev = headers.findIndex((h) => typeof h === 'string' && h.trim() === 'Ini Prev')
    const colFimPrev = headers.findIndex((h) => typeof h === 'string' && h.trim() === 'Fim Prev')
    const colResp = headers.findIndex((h) => typeof h === 'string' && h.trim() === 'Resp')

    const missingCols = []
    if (colFase === -1) missingCols.push('Fase Obra')
    if (colAtividades === -1) missingCols.push('Atividades')
    if (colStatus === -1) missingCols.push('Status Execução')

    if (missingCols.length > 0) {
      throw new Error('Colunas obrigatórias não encontradas no Excel.')
    }

    const parseExcelDate = (val: any) => {
      if (!val) return ''
      let dateStr = ''
      if (val instanceof Date) {
        if (!isNaN(val.getTime())) dateStr = val.toISOString().split('T')[0]
      } else if (typeof val === 'string') {
        const parts = val.split('/')
        if (parts.length === 3) {
          dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        } else {
          const d = new Date(val)
          if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0]
        }
      }
      return dateStr ? `${dateStr} 12:00:00.000Z` : ''
    }

    const fasesMap = new Map<
      string,
      {
        nome_fase: string
        atividades: {
          nome_atividade: string
          status_execucao: string
          data_inicio_previsto: string
          data_fim_previsto: string
          responsavel: string
        }[]
      }
    >()

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!Array.isArray(row)) continue

      const faseNome = row[colFase]?.toString().trim()
      const ativNome = row[colAtividades]?.toString().trim()

      if (!faseNome || !ativNome) continue

      if (!fasesMap.has(faseNome)) {
        fasesMap.set(faseNome, { nome_fase: faseNome, atividades: [] })
      }

      const statusExecucao = row[colStatus]?.toString().trim() || 'Não Executado'
      const statusFinal = statusExecucao === 'Executado' ? 'Executado' : 'Não Executado'

      fasesMap.get(faseNome)!.atividades.push({
        nome_atividade: ativNome,
        status_execucao: statusFinal,
        data_inicio_previsto: parseExcelDate(colIniPrev !== -1 ? row[colIniPrev] : ''),
        data_fim_previsto: parseExcelDate(colFimPrev !== -1 ? row[colFimPrev] : ''),
        responsavel: colResp !== -1 ? row[colResp]?.toString().trim() || '' : '',
      })
    }

    let totalCriadas = 0
    let totalAtualizadas = 0

    for (const [faseNome, faseData] of fasesMap.entries()) {
      let faseId: string
      const existingFases = await pb.collection('fases').getList(1, 1, {
        filter: `nome_fase = '${faseNome.replace(/'/g, "\\'")}' && obra_id = '${obraId}'`,
      })

      if (existingFases.items.length > 0) {
        faseId = existingFases.items[0].id
      } else {
        const newFase = await pb.collection('fases').create({
          nome_fase: faseNome,
          obra_id: obraId,
        })
        faseId = newFase.id
      }

      const existingAtivs = await pb.collection('atividades').getFullList({
        filter: `fase_id = '${faseId}'`,
      })
      const existingAtivMap = new Map(existingAtivs.map((a) => [a.nome_atividade, a]))

      for (const ativ of faseData.atividades) {
        const payload: any = {
          status_execucao: ativ.status_execucao,
        }
        if (ativ.data_inicio_previsto) payload.data_inicio_previsto = ativ.data_inicio_previsto
        if (ativ.data_fim_previsto) payload.data_fim_previsto = ativ.data_fim_previsto
        if (ativ.responsavel) payload.responsavel = ativ.responsavel

        if (existingAtivMap.has(ativ.nome_atividade)) {
          const existing = existingAtivMap.get(ativ.nome_atividade)!
          await pb.collection('atividades').update(existing.id, payload)
          totalAtualizadas++
        } else {
          await pb.collection('atividades').create({
            nome_atividade: ativ.nome_atividade,
            fase_id: faseId,
            ...payload,
          })
          totalCriadas++
        }
      }
    }

    return {
      sucesso: true,
      mensagem: `Sincronização concluída! ${totalCriadas} criadas, ${totalAtualizadas} atualizadas.`,
    }
  } catch (error: any) {
    throw new Error(error.message || 'Erro desconhecido')
  }
}
