cronAdd('sincronizar_onedrive_excel_cron', '*/5 * * * *', () => {
  try {
    const res = $http.send({
      url: 'http://127.0.0.1:8090/backend/v1/sincronizar_onedrive_excel',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': 'cron_internal_call',
      },
      timeout: 120,
    })
    $app.logger().info('Sincronização Cron executada', 'status', res.statusCode, 'body', res.json)
  } catch (err) {
    $app.logger().error('Erro ao executar cron de sincronização', 'error', err.message)
  }
})

routerAdd('POST', '/backend/v1/sincronizar_onedrive_excel', (e) => {
  if (
    e.request.header.get('X-Cron-Secret') !== 'cron_internal_call' &&
    !e.hasSuperuserAuth() &&
    !e.auth.record
  ) {
    return e.json(403, { sucesso: false, erro: 'Acesso negado.' })
  }

  const CAMINHO_ARQUIVO = 'Singolarità/projetos/tabobra.xlsx'
  const tenantId = $secrets.get('ONEDRIVE_TENANT_ID') || ''
  const clientId = $secrets.get('ONEDRIVE_CLIENT_ID') || ''
  const clientSecret = $secrets.get('ONEDRIVE_CLIENT_SECRET') || ''

  let token = ''

  function getAccessToken() {
    try {
      // Tenta chamar o hook local existente para obter o token
      const res = $http.send({
        url: 'http://127.0.0.1:8090/backend/v1/onedrive/token',
        method: 'GET',
      })
      if (res.statusCode === 200 && res.json && res.json.access_token) {
        return res.json.access_token
      }
    } catch (ex) {}

    // Fallback para client_credentials
    if (tenantId && clientId && clientSecret) {
      const formParams = new URLSearchParams()
      formParams.append('client_id', clientId)
      formParams.append('client_secret', clientSecret)
      formParams.append('scope', 'https://graph.microsoft.com/.default')
      formParams.append('grant_type', 'client_credentials')

      const res = $http.send({
        url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString(),
      })
      if (res.statusCode === 200 && res.json && res.json.access_token) {
        return res.json.access_token
      }
    }
    throw new Error('Não foi possível obter o token de acesso.')
  }

  function refreshAccessToken() {
    try {
      const res = $http.send({
        url: 'http://127.0.0.1:8090/backend/v1/onedrive/refresh_token',
        method: 'POST',
      })
      if (res.statusCode === 200 && res.json && res.json.access_token) {
        return res.json.access_token
      }
    } catch (ex) {}
    return getAccessToken()
  }

  function fetchGraph(url, options = {}, retries = 3) {
    let delay = 2000
    for (let i = 0; i < retries; i++) {
      options.headers = options.headers || {}
      options.headers['Authorization'] = 'Bearer ' + token

      try {
        const res = $http.send({ url, ...options, timeout: 60 })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return res
        }
        if (res.statusCode === 401 || res.statusCode === 403) {
          // Limpa cache de token implícito recarregando um novo
          token = refreshAccessToken()
          continue
        }

        $os.sleep(delay)
        delay *= 2
      } catch (err) {
        $os.sleep(delay)
        delay *= 2
      }
    }
    throw new Error(`Falha de rede ao acessar Graph API: ${url}`)
  }

  function parseExcelDate(val) {
    if (val === undefined || val === null || val === '') return ''
    try {
      if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000))
        return date.toISOString().replace('T', ' ').substring(0, 19) + 'Z'
      }
      const d = new Date(val)
      if (!isNaN(d)) {
        return d.toISOString().replace('T', ' ').substring(0, 19) + 'Z'
      }
    } catch (ex) {}
    return String(val)
  }

  try {
    token = getAccessToken()

    const metadataUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${CAMINHO_ARQUIVO}`
    const metaRes = fetchGraph(metadataUrl, { method: 'GET' })
    const metadata = metaRes.json

    if (!metadata || !metadata.lastModifiedDateTime) {
      throw new Error('Arquivo não encontrado no OneDrive ou metadados inválidos.')
    }

    let obrasList = []
    try {
      obrasList = $app.findRecordsByFilter('obras', '', '-created', 1, 0)
    } catch (e) {}

    if (obrasList.length === 0) {
      const admin =
        $app.findFirstRecordByFilter('users', "role='coordenador'") ||
        $app.findFirstRecordByFilter('users', '')
      if (!admin) {
        throw new Error('Nenhum usuário coordenador encontrado para vincular a obra.')
      }
      const obrasCol = $app.findCollectionByNameOrId('obras')
      const defaultObra = new Record(obrasCol)
      defaultObra.set('nome', 'Obra Principal (Auto-gerada)')
      defaultObra.set('coordenador_id', admin.id)
      $app.save(defaultObra)
      obrasList = [defaultObra]
    }
    const obra = obrasList[0]
    const storedSyncAt = obra.getString('sync_at')

    const lastModified = metadata.lastModifiedDateTime

    if (storedSyncAt && new Date(lastModified) <= new Date(storedSyncAt)) {
      return e.json(200, {
        sucesso: true,
        mensagem: 'Arquivo não modificado',
        sincronizadas: 0,
        atualizadas: 0,
      })
    }

    const worksheetsUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${metadata.id}/workbook/worksheets`
    const worksheetsRes = fetchGraph(worksheetsUrl, { method: 'GET' })
    const worksheets = worksheetsRes.json
    if (!worksheets || !worksheets.value || worksheets.value.length === 0) {
      throw new Error('Nenhuma planilha encontrada no arquivo.')
    }
    const sheetId = worksheets.value[0].id

    const rangeUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${metadata.id}/workbook/worksheets/${sheetId}/usedRange`
    const rangeRes = fetchGraph(rangeUrl, { method: 'GET' })
    const range = rangeRes.json

    if (!range || !range.values) {
      throw new Error('Nenhum dado encontrado na planilha.')
    }

    const rawRows = range.values
    if (rawRows.length < 2) {
      return e.json(200, {
        sucesso: true,
        mensagem: 'Planilha vazia ou sem dados além do cabeçalho',
        sincronizadas: 0,
        atualizadas: 0,
      })
    }

    const headers = rawRows[0]
    const rows = []
    for (let i = 1; i < rawRows.length; i++) {
      const rowData = rawRows[i]
      const rowObj = {}
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
          rowObj[headers[j]] = rowData[j]
        }
      }
      rows.push(rowObj)
    }

    let sincronizadas = 0
    let atualizadas = 0

    const fasesCol = $app.findCollectionByNameOrId('fases')
    const atividadesCol = $app.findCollectionByNameOrId('atividades')

    for (const row of rows) {
      try {
        const nomeFase = row['Fase']
        const nomeAtiv = row['Atividade']
        if (!nomeFase || !nomeAtiv) continue

        let status = row['Status'] || 'Não Executado'
        if (status !== 'Executado' && status !== 'Não Executado') {
          status = 'Não Executado'
        }

        let faseRecord
        try {
          faseRecord = $app.findFirstRecordByFilter(
            'fases',
            `obra_id='${obra.id}' && nome_fase='${String(nomeFase).replace(/'/g, "''")}'`,
          )
        } catch (err) {
          faseRecord = new Record(fasesCol)
          faseRecord.set('obra_id', obra.id)
          faseRecord.set('nome_fase', String(nomeFase))
          $app.save(faseRecord)
        }

        let ativRecord
        let isNew = false
        try {
          ativRecord = $app.findFirstRecordByFilter(
            'atividades',
            `fase_id='${faseRecord.id}' && nome_atividade='${String(nomeAtiv).replace(/'/g, "''")}'`,
          )
        } catch (err) {
          ativRecord = new Record(atividadesCol)
          ativRecord.set('fase_id', faseRecord.id)
          ativRecord.set('nome_atividade', String(nomeAtiv))
          isNew = true
        }

        ativRecord.set('status_execucao', status)

        const dtInicio = row['Data Início']
        if (dtInicio) ativRecord.set('data_inicio_previsto', parseExcelDate(dtInicio))

        const dtFim = row['Data Fim']
        if (dtFim) ativRecord.set('data_fim_previsto', parseExcelDate(dtFim))

        if (row['Responsável']) ativRecord.set('responsavel', String(row['Responsável']))

        $app.save(ativRecord)

        if (isNew) sincronizadas++
        else atualizadas++
      } catch (rowErr) {
        $app
          .logger()
          .error(
            'Erro ao processar linha do Excel',
            'linha',
            JSON.stringify(row),
            'erro',
            rowErr.message,
          )
      }
    }

    obra.set('sync_at', lastModified)
    $app.save(obra)

    return e.json(200, {
      sucesso: true,
      sincronizadas,
      atualizadas,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    $app.logger().error('Erro no sincronizar_onedrive_excel', 'erro', error.message)
    return e.json(500, { sucesso: false, erro: 'Falha na sincronização: ' + error.message })
  }
})
