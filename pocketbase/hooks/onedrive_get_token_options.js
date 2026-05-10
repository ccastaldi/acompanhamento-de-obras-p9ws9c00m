routerAdd('OPTIONS', '/backend/v1/onedrive_get_token', (e) => {
  try {
    e.response.header().set('Access-Control-Allow-Origin', '*')
    e.response.header().set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    e.response.header().set('Access-Control-Allow-Headers', 'authorization, apikey, content-type')
    return e.noContent(204)
  } catch (globalErr) {
    return e.noContent(204)
  }
})
