routerAdd(
  'POST',
  '/backend/v1/download_excel_onedrive',
  async (e) => {
    e.response.header().set('Access-Control-Allow-Origin', '*')

    const body = e.requestInfo().body || {}
    const onedriveUrl = body.onedrive_url

    if (!onedriveUrl || typeof onedriveUrl !== 'string') {
      return e.badRequestError("O campo 'onedrive_url' é obrigatório.")
    }

    try {
      const response = await fetch(onedriveUrl, { idleTimeout: 60 })

      if (!response.ok) {
        return e.json(response.status, {
          sucesso: false,
          erro: `Falha ao baixar o arquivo do OneDrive. Status: ${response.status}`,
        })
      }

      e.response
        .header()
        .set('Content-Type', response.headers.get('content-type') || 'application/octet-stream')
      await $response.stream(e, response.body)
      return
    } catch (error) {
      $app.logger().error('Erro proxy OneDrive:', 'err', String(error))
      return e.internalServerError('Erro de rede ao baixar o arquivo. Tente novamente.')
    }
  },
  $apis.requireAuth(),
)
