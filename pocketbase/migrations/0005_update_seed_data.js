migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let coordId
    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', 'cesar@singolarita.com.br')
      coordId = existing.id
    } catch (_) {
      const record = new Record(users)
      record.setEmail('cesar@singolarita.com.br')
      record.setPassword('12345678')
      record.setVerified(true)
      record.set('name', 'Cesar Castaldi')
      record.set('role', 'coordenador')
      app.save(record)
      coordId = record.id
    }

    const obrasCol = app.findCollectionByNameOrId('obras')
    try {
      const existing = app.findFirstRecordByData('obras', 'nome', 'Apartamento Itacema 74')
      existing.set(
        'secret_onedrive',
        'https://1drv.ms/x/c/c834a1650b951a02/IQC9IavsP06jSKLGUArxfC6ZAWYVNDNAtdT9wYRKKFrTgX4?e=sHXUAI',
      )
      existing.set('coordenador_id', coordId)
      existing.set('id_cliente', 'IARLEIBEZERRA')
      app.save(existing)
    } catch (_) {
      const rec = new Record(obrasCol)
      rec.set('nome', 'Apartamento Itacema 74')
      rec.set('id_cliente', 'IARLEIBEZERRA')
      rec.set('coordenador_id', coordId)
      rec.set(
        'secret_onedrive',
        'https://1drv.ms/x/c/c834a1650b951a02/IQC9IavsP06jSKLGUArxfC6ZAWYVNDNAtdT9wYRKKFrTgX4?e=sHXUAI',
      )
      app.save(rec)
    }
  },
  (app) => {
    // Can't revert to exact previous easily since it was modified inline
  },
)
