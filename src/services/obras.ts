import PocketBase from 'pocketbase'
import * as XLSX from 'xlsx'

type RecordId = string

export interface Obra {
  id: RecordId
  nome: string
}

export interface Fase {
  id: RecordId
  nome: string
  obra: RecordId
}

export interface Atividade {
  id: RecordId
  nome: string
  fase: RecordId
  status: string
  iniPrev: string
  fimPrev: string
  responsavel: string
}

export interface DashboardData {
  totalFases: number
  totalAtividades: number
  statusCounts: Record<string, number>
}

export interface SyncResult {
  sucesso: boolean
  mensagem: string
}

export async function getDashboardData(obraId: string, pb: PocketBase): Promise<DashboardData> {
  try {
    const fasesResult = await pb.collection('fases').getList(1, 100, {
      filter: `obra = '${obraId}'`,
      sort: '-updated',
    })
    const atividades = (await pb.collection('atividades').getFullList({
      filter: `fase.obra = '${obraId}'`,
      sort: '-updated',
    })) as Atividade[]

    const statusCounts: Record<string, number> = {}
    atividades.forEach((ativ) => {
      const status = ativ.status || 'Sem status'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    console.log(
      `Dashboard data para obra ${obraId}: ${fasesResult.totalItems} fases, ${atividades.length} atividades`,
    )

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

export async function getObraDetailsData(
  obraId: string,
  pb: PocketBase,
): Promise<{ fases: Fase[]; atividades: Atividade[] }> {
  try {
    const fases = (await pb.collection('fases').getFullList({
      filter: `obra = '${obraId}'`,
      sort: '+nome',
    })) as Fase[]

    const atividades = (await pb.collection('atividades').getFullList({
      filter: `fase.obra = '${obraId}'`,
      sort: '+nome',
      expand: 'fase',
    })) as Atividade[]

    console.log(
      `Detalhes da obra ${obraId}: ${fases.length} fases, ${atividades.length} atividades`,
    )

    return { fases, atividades }
  } catch (error) {
    console.error('Erro ao obter detalhes da obra:', error)
    throw new Error('Falha ao carregar detalhes da obra')
  }
}

export async function updateAtividade(
  atividadeId: string,
  updates: Partial<Omit<Atividade, 'id' | 'fase' | 'nome'>>,
  pb: PocketBase,
): Promise<Atividade> {
  try {
    const updated = (await pb.collection('atividades').update(atividadeId, updates)) as Atividade
    console.log(`Atividade ${atividadeId} atualizada:`, updates)
    return updated
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error)
    throw new Error('Falha ao atualizar atividade')
  }
}

export async function syncObra(
  excelUrl: string,
  obraId: string,
  pb: PocketBase,
): Promise<SyncResult> {
  try {
    console.log(`Iniciando sincronização da obra ${obraId} do Excel: ${excelUrl}`)

    const response = await fetch(excelUrl)
    if (!response.ok) {
      throw new Error(`Falha ao baixar Excel: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()

    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][]

    if (data.length < 1) {
      throw new Error('Arquivo Excel vazio')
    }

    const headers = data[0] as string[]
    const colFase = headers.findIndex((h) => h?.trim() === 'Fase Obra')
    const colAtividades = headers.findIndex((h) => h?.trim() === 'Atividades')
    const colStatus = headers.findIndex((h) => h?.trim() === 'Status Execução')
    const colIniPrev = headers.findIndex((h) => h?.trim() === 'Ini Prev')
    const colFimPrev = headers.findIndex((h) => h?.trim() === 'Fim Prev')
    const colResp = headers.findIndex((h) => h?.trim() === 'Resp')

    const missingCols = []
    if (colFase === -1) missingCols.push('Fase Obra')
    if (colAtividades === -1) missingCols.push('Atividades')
    if (colStatus === -1) missingCols.push('Status Execução')
    if (colIniPrev === -1) missingCols.push('Ini Prev')
    if (colFimPrev === -1) missingCols.push('Fim Prev')
    if (colResp === -1) missingCols.push('Resp')

    if (missingCols.length > 0) {
      throw new Error(`Colunas não encontradas: ${missingCols.join(', ')}`)
    }

    const fasesMap = new Map<
      string,
      {
        nome: string
        atividades: {
          nome: string
          status: string
          iniPrev: string
          fimPrev: string
          resp: string
        }[]
      }
    >()

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as string[]
      const faseNome = row[colFase]?.toString().trim()
      const ativNome = row[colAtividades]?.toString().trim()

      if (!faseNome || !ativNome) continue

      if (!fasesMap.has(faseNome)) {
        fasesMap.set(faseNome, { nome: faseNome, atividades: [] })
      }
      fasesMap.get(faseNome)!.atividades.push({
        nome: ativNome,
        status: row[colStatus]?.toString().trim() || '',
        iniPrev: row[colIniPrev]?.toString().trim() || '',
        fimPrev: row[colFimPrev]?.toString().trim() || '',
        resp: row[colResp]?.toString().trim() || '',
      })
    }

    let totalCriadas = 0
    let totalAtualizadas = 0
    let totalDeletadas = 0

    for (const [faseNome, faseData] of fasesMap.entries()) {
      console.log(`Sincronizando fase: ${faseNome} (${faseData.atividades.length} atividades)`)

      // Buscar ou criar fase
      let fase: Fase
      const existingFases = await pb.collection('fases').getList(1, 1, {
        filter: `nome = '${faseNome}' && obra = '${obraId}'`,
      })
      if (existingFases.items.length > 0) {
        fase = existingFases.items[0] as Fase
        console.log(`  - Fase existente: ${fase.id}`)
      } else {
        const newFase = await pb.collection('fases').create({
          nome: faseNome,
          obra: obraId,
        })
        fase = { id: newFase.id, nome: faseNome, obra: obraId }
        totalCriadas++
        console.log(`  - Fase criada: ${fase.id}`)
      }

      // Buscar atividades existentes da fase
      const existingAtivs = (await pb.collection('atividades').getFullList({
        filter: `fase = '${fase.id}'`,
      })) as Atividade[]

      const existingAtivMap = new Map(existingAtivs.map((a) => [a.nome, a]))
      const newAtivNomes = new Set(faseData.atividades.map((a) => a.nome))

      // Upsert atividades
      for (const ativ of faseData.atividades) {
        if (existingAtivMap.has(ativ.nome)) {
          const existing = existingAtivMap.get(ativ.nome)!
          await pb.collection('atividades').update(existing.id, {
            status: ativ.status,
            iniPrev: ativ.iniPrev,
            fimPrev: ativ.fimPrev,
            responsavel: ativ.resp,
          })
          totalAtualizadas++
          console.log(`    - Atualizada: ${ativ.nome}`)
        } else {
          await pb.collection('atividades').create({
            nome: ativ.nome,
            fase: fase.id,
            status: ativ.status,
            iniPrev: ativ.iniPrev,
            fimPrev: ativ.fimPrev,
            responsavel: ativ.resp,
          })
          totalCriadas++
          console.log(`    - Criada: ${ativ.nome}`)
        }
      }

      // Deletar atividades obsoletas
      for (const existing of existingAtivs) {
        if (!newAtivNomes.has(existing.nome)) {
          await pb.collection('atividades').delete(existing.id)
          totalDeletadas++
          console.log(`    - Deletada: ${existing.nome}`)
        }
      }
    }

    console.log(
      `Sincronização concluída: ${totalCriadas} criadas, ${totalAtualizadas} atualizadas, ${totalDeletadas} deletadas`,
    )

    return {
      sucesso: true,
      mensagem: `Sincronização concluída! ${totalCriadas} criadas, ${totalAtualizadas} atualizadas, ${totalDeletadas} deletadas.`,
    }
  } catch (error) {
    console.error('Erro na sincronização:', error)
    return {
      sucesso: false,
      mensagem: `Erro na sincronização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    }
  }
}
