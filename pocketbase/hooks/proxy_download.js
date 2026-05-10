routerAdd(
  'POST',
  '/backend/v1/proxy-download',
  (e) => {
    const body = e.requestInfo().body || {}
    const url = body.url
    if (!url) {
      return e.badRequestError('URL obrigatória')
    }

    let res
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        timeout: 15,
      })
    } catch (err) {
      return e.badRequestError('Timeout ao baixar arquivo. Tente novamente.')
    }

    if (res.statusCode !== 200) {
      return e.badRequestError('Erro ao baixar arquivo (status ' + res.statusCode + ')')
    }

    return e.blob(200, 'application/octet-stream', res.body)
  },
  $apis.requireAuth(),
)
