routerAdd('POST', '/backend/v1/ler-tabobra-onedrive', async (e) => {
  const body = e.requestInfo().body || {}
  const obra_id = body.obra_id

  $app.logger().info('LOG 1: Requisição recebida', 'info', { obra_id })

  if (!obra_id) {
    $app.logger().error('LOG 2: obra_id ausente', 'error', {})
    return e.badRequestError('Campo obrigatório obra_id.')
  }

  let obra
  try {
    obra = $app.findRecordById('obras', obra_id)
    $app.logger().info('LOG 3: Obra encontrada', 'info', {
      obra_id,
      secret_onedrive: obra.get('secret_onedrive') ? 'preenchido' : 'vazio',
    })
  } catch (err) {
    $app.logger().error('LOG 4: Obra não encontrada', 'error', { obra_id, erro: err.message })
    return e.notFoundError('Obra não encontrada.')
  }

  const secret_onedrive = obra.get('secret_onedrive')
  if (!secret_onedrive || secret_onedrive.trim() === '') {
    $app.logger().error('LOG 5: secret_onedrive vazio', 'error', {})
    return e.badRequestError('URL do OneDrive não configurada para esta obra.')
  }

  $app.logger().info('LOG 6: Iniciando fetch do OneDrive', 'info', {
    url: secret_onedrive.substring(0, 50) + '...',
  })

  let response
  try {
    response = await fetch(secret_onedrive)
    $app.logger().info('LOG 7: Fetch retornou', 'info', {
      status: response.status,
      ok: response.ok,
    })
  } catch (err) {
    $app.logger().error('LOG 8: Erro no fetch', 'error', { erro: err.message })
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao baixar arquivo do OneDrive: ' + err.message,
    })
  }

  if (!response.ok) {
    $app.logger().error('LOG 9: Resposta não OK', 'error', {
      status: response.status,
      statusText: response.statusText,
    })
    return e.json(response.status, {
      sucesso: false,
      erro: `OneDrive retornou ${response.status}: ${response.statusText}`,
    })
  }

  let arrayBuffer
  try {
    arrayBuffer = await response.arrayBuffer()
    $app.logger().info('LOG 10: ArrayBuffer obtido', 'info', {
      tamanho: arrayBuffer.byteLength,
    })
  } catch (err) {
    $app.logger().error('LOG 11: Erro ao ler resposta', 'error', { erro: err.message })
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao processar arquivo: ' + err.message,
    })
  }

  $app.logger().info('LOG 12: Arquivo baixado com sucesso', 'info', {})
  return e.json(200, {
    sucesso: true,
    data: { message: 'Arquivo baixado com sucesso', tamanho: arrayBuffer.byteLength },
  })
})
