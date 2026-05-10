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

export async function syncObra(obraId: string, pb: PocketBase) {
  try {
    const obra = await pb.collection('obras').getOne(obraId)
    const secret_onedrive = obra.get('secret_onedrive')

    if (!secret_onedrive) {
      throw new Error('URL do OneDrive não configurada para esta obra.')
    }

    console.log('Iniciando download do arquivo Excel via proxy...')

    // Chamar Edge Function proxy (contorna CORS)
    const proxyResponse = await fetch('/download-excel-onedrive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onedrive_url: secret_onedrive }),
    })

    if (!proxyResponse.ok) {
      const error = await proxyResponse.json()
      throw new Error(error.error || 'Erro ao baixar arquivo via proxy')
    }

    const proxyData = await proxyResponse.json()
    const base64 = proxyData.data.base64

    // Converter base64 para arrayBuffer
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const arrayBuffer = bytes.buffer

    // Processar com XLSX
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    if (data.length < 2) {
      throw new Error('Arquivo Excel vazio ou inválido.')
    }

    const headers = data[0]
    const colFase = headers.indexOf('Fase Obra')
    const colAtividades = headers.indexOf('Atividades')
    const colStatus = headers.indexOf('Status Execução')
    const colIniPrev = headers.indexOf('Ini Prev')
    const colFimPrev = headers.indexOf('Fim Prev')
    const colResp = headers.indexOf('Resp')

    if (colFase === -1 || colAtividades === -1 || colStatus === -1) {
      throw new Error('Colunas obrigatórias não encontradas no Excel.')
    }

    const fasesMap = new Map()

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const faseNome = row[colFase]?.toString().trim()
      const ativNome = row[colAtividades]?.toString().trim()

      if (!faseNome || !ativNome) continue

      if (!fasesMap.has(faseNome)) {
        fasesMap.set(faseNome, { nome: faseNome, atividades: [] })
      }

      fasesMap.get(faseNome).atividades.push({
        nome: ativNome,
        status: row[colStatus]?.toString().trim() || '',
        iniPrev: row[colIniPrev]?.toString().trim() || '',
        fimPrev: row[colFimPrev]?.toString().trim() || '',
        responsavel: row[colResp]?.toString().trim() || '',
      })
    }

    let totalCriadas = 0
    let totalAtualizadas = 0

    for (const [faseNome, faseData] of fasesMap.entries()) {
      let fase
      const existingFases = await pb.collection('fases').getList(1, 1, {
        filter: `nome = "${faseNome}" && obra = "${obraId}"`,
      })

      if (existingFases.items.length > 0) {
        fase = existingFases.items[0]
      } else {
        fase = await pb.collection('fases').create({
          nome: faseNome,
          obra: obraId,
        })
        totalCriadas++
      }

      for (const ativ of faseData.atividades) {
        const existingAtiv = await pb.collection('atividades').getList(1, 1, {
          filter: `nome = "${ativ.nome}" && fase = "${fase.id}"`,
        })

        if (existingAtiv.items.length > 0) {
          await pb.collection('atividades').update(existingAtiv.items[0].id, {
            status: ativ.status,
            iniPrev: ativ.iniPrev,
            fimPrev: ativ.fimPrev,
            responsavel: ativ.responsavel,
          })
          totalAtualizadas++
        } else {
          await pb.collection('atividades').create({
            nome: ativ.nome,
            fase: fase.id,
            status: ativ.status,
            iniPrev: ativ.iniPrev,
            fimPrev: ativ.fimPrev,
            responsavel: ativ.responsavel,
          })
          totalCriadas++
        }
      }
    }

    console.log(`Sincronização concluída: ${totalCriadas} criadas, ${totalAtualizadas} atualizadas`)

    return {
      sucesso: true,
      mensagem: `Sincronização concluída! ${totalCriadas} criadas, ${totalAtualizadas} atualizadas.`,
    }
  } catch (error) {
    console.error('Erro na sincronização:', error)
    return {
      sucesso: false,
      mensagem: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    }
  }
}
