// @deps base64-js@1.5.1
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

      const arrayBuffer = await response.arrayBuffer()
      const base64js = require('base64-js')
      const base64 = base64js.fromByteArray(new Uint8Array(arrayBuffer))

      return e.json(200, {
        sucesso: true,
        data: {
          base64: base64,
        },
      })
    } catch (error) {
      $app.logger().error('Erro proxy OneDrive:', 'err', String(error))
      return e.internalServerError('Erro de rede ao baixar o arquivo. Tente novamente.')
    }
  },
  $apis.requireAuth(),
)
