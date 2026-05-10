// @deps xlsx@0.18.5
routerAdd(
  'POST',
  '/backend/v1/obras/{id}/sync',
  (e) => {
    const { read, utils } = require('xlsx')

    const id = e.request.pathValue('id')
    const obra = $app.findRecordById('obras', id)

    const secretUrl = obra.getString('secret_onedrive')
    if (!secretUrl) {
      return e.json(200, { message: 'No sync url' })
    }

    let downloadUrl = secretUrl
    if (downloadUrl.includes('1drv.ms')) {
      downloadUrl = downloadUrl.split('?')[0] + '?download=1'
    }

    const res = $http.send({
      url: downloadUrl,
      method: 'GET',
      timeout: 30,
    })

    if (res.statusCode !== 200) {
      throw new BadRequestError('Timeout ao baixar arquivo. Tente novamente.')
    }

    function parseDate(str) {
      if (!str) return null
      str = String(str).trim()
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str + ' 00:00:00.000Z'
      const parts = str.split('/')
      if (parts.length === 3) {
        let y = parts[2].split(' ')[0]
        if (y.length === 2) y = '20' + y
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')} 00:00:00.000Z`
      }
      return null
    }

    try {
      const workbook = read(res.body, { type: 'array' })
      const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'orc_obra')
      if (!sheetName) {
        throw new BadRequestError("Arquivo Excel inválido ou aba 'orc_obra' não encontrada.")
      }

      const worksheet = workbook.Sheets[sheetName]
      const data = utils.sheet_to_json(worksheet, { defval: '', raw: false })

      $app.runInTransaction((txApp) => {
        const fasesCol = txApp.findCollectionByNameOrId('fases')
        const ativCol = txApp.findCollectionByNameOrId('atividades')

        for (const row of data) {
          const faseNome = row['Fase Obra']
          const ativNome = row['Atividades']
          if (!faseNome || !ativNome) continue

          let faseId
          try {
            const existingFase = txApp.findFirstRecordByFilter(
              'fases',
              'obra_id = {:obraId} && nome_fase = {:nome}',
              { obraId: id, nome: faseNome },
            )
            faseId = existingFase.id
          } catch (_) {
            const newFase = new Record(fasesCol)
            newFase.set('obra_id', id)
            newFase.set('nome_fase', faseNome)
            txApp.save(newFase)
            faseId = newFase.id
          }

          const statusRaw = row['Status Execução']
          const status =
            statusRaw === 'Executado' || statusRaw === 'Não Executado' ? statusRaw : 'Não Executado'

          const ini = parseDate(row['Ini Prev'])
          const fim = parseDate(row['Fim Prev'])

          try {
            const existingAtiv = txApp.findFirstRecordByFilter(
              'atividades',
              'fase_id = {:faseId} && nome_atividade = {:nome}',
              { faseId: faseId, nome: ativNome },
            )
            existingAtiv.set('status_execucao', status)
            if (ini) existingAtiv.set('data_inicio_previsto', ini)
            if (fim) existingAtiv.set('data_fim_previsto', fim)
            if (row['Resp']) existingAtiv.set('responsavel', String(row['Resp']))
            txApp.save(existingAtiv)
          } catch (_) {
            const newAtiv = new Record(ativCol)
            newAtiv.set('fase_id', faseId)
            newAtiv.set('nome_atividade', ativNome)
            newAtiv.set('status_execucao', status)
            if (ini) newAtiv.set('data_inicio_previsto', ini)
            if (fim) newAtiv.set('data_fim_previsto', fim)
            if (row['Resp']) newAtiv.set('responsavel', String(row['Resp']))
            txApp.save(newAtiv)
          }
        }
      })

      return e.json(200, { success: true })
    } catch (err) {
      if (err.statusCode) throw err
      throw new BadRequestError('Erro ao sincronizar TabObra. Tente novamente.')
    }
  },
  $apis.requireAuth(),
)
