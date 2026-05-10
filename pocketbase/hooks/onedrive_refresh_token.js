routerAdd(
  'POST',
  '/backend/v1/onedrive-refresh-token',
  (e) => {
    try {
      e.response.header().set('Access-Control-Allow-Origin', '*')

      const clientId = $secrets.get('ONEDRIVE_CLIENT_ID')
      const clientSecret = $secrets.get('ONEDRIVE_CLIENT_SECRET')
      const tenantId = $secrets.get('ONEDRIVE_TENANT_ID')

      if (!clientId || !clientSecret || !tenantId) {
        return e.json(500, { error: 'Credenciais do OneDrive não configuradas no servidor.' })
      }

      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

      globalThis.__onedrive_token_cache = { token: null, expiresAt: 0 }

      const maxRetries = 3
      const delays = [2000, 4000, 8000]

      const sleep = (ms) => {
        const start = Date.now()
        while (Date.now() - start < ms) {}
      }

      let attempt = 0

      while (attempt <= maxRetries) {
        try {
          const bodyParams = `client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent('https://graph.microsoft.com/.default')}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`

          const res = $http.send({
            url: tokenUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams,
            timeout: 15,
          })

          if (res.statusCode === 200) {
            const data = res.json
            const expiresInSec = data.expires_in || 3600
            globalThis.__onedrive_token_cache = {
              token: data.access_token,
              expiresAt: Date.now() + expiresInSec * 1000,
            }
            return e.json(200, {
              token: data.access_token,
              expiresIn: expiresInSec,
            })
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            globalThis.__onedrive_token_cache = { token: null, expiresAt: 0 }
            throw new Error(`Auth Error: HTTP ${res.statusCode}`)
          } else {
            throw new Error(`HTTP ${res.statusCode} - ${JSON.stringify(res.json || {})}`)
          }
        } catch (error) {
          $app
            .logger()
            .error('Erro ao renovar token do OneDrive', 'err', String(error), 'attempt', attempt)

          if (attempt < maxRetries) {
            sleep(delays[attempt])
            attempt++
          } else {
            break
          }
        }
      }

      return e.json(500, {
        error: 'Erro de rede, tentando novamente falhou. Erro ao renovar token do OneDrive.',
      })
    } catch (globalErr) {
      $app.logger().error('Erro inesperado no token do OneDrive', 'err', String(globalErr))
      return e.json(500, { error: 'Erro interno no servidor ao processar a requisição.' })
    }
  },
  $apis.requireAuth(),
)
