routerAdd('POST', '/api/sincronizar-tabobra', async (e) => {
  const body = e.requestInfo().body || {}
  const obra_id = body.obra_id

  if (!obra_id) {
    return e.badRequestError('Campo obrigatório obra_id.')
  }

  try {
    const obra = $app.findRecordById('obras', obra_id)
    const secret_onedrive = obra.get('secret_onedrive')

    if (!secret_onedrive) {
      return e.badRequestError('URL do OneDrive não configurada.')
    }

    const response = await fetch(secret_onedrive)
    if (!response.ok) {
      return e.json(response.status, {
        sucesso: false,
        erro: `OneDrive retornou ${response.status}`,
      })
    }

    const arrayBuffer = await response.arrayBuffer()
    return e.json(200, {
      sucesso: true,
      data: {
        message: 'Arquivo baixado com sucesso',
        tamanho: arrayBuffer.byteLength,
      },
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      erro: 'Erro ao sincronizar: ' + err.message,
    })
  }
})
