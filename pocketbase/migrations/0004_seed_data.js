migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    let coordId
    try {
      const existing = app.findAuthRecordByEmail('_pb_users_auth_', 'ccastaldi@gmail.com')
      coordId = existing.id
    } catch (_) {
      const record = new Record(users)
      record.setEmail('ccastaldi@gmail.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Coordenador')
      record.set('role', 'coordenador')
      app.save(record)
      coordId = record.id
    }

    const obrasCol = app.findCollectionByNameOrId('obras')
    const fasesCol = app.findCollectionByNameOrId('fases')
    const ativCol = app.findCollectionByNameOrId('atividades')

    try {
      app.findFirstRecordByData('obras', 'nome', 'Apartamento Itacema 74')
      return // Already seeded
    } catch (_) {}

    const obrasData = [
      { nome: 'Apartamento Itacema 74', id_cliente: 'C001' },
      { nome: 'Casa Vila Mariana', id_cliente: 'C002' },
      { nome: 'Cobertura Pinheiros', id_cliente: 'C003' },
    ]

    const fasesData = [
      {
        obraIdx: 0,
        fases: [
          'Demolição e Retiradas',
          'Infraestrutura Elétrica/Hidráulica',
          'Forro e Gesso',
          'Revestimentos',
          'Acabamento Fino',
        ],
      },
      {
        obraIdx: 1,
        fases: [
          'Fundação',
          'Alvenaria Estrutural',
          'Cobertura',
          'Esquadrias',
          'Instalações',
          'Pintura',
        ],
      },
      {
        obraIdx: 2,
        fases: ['Reforço Estrutural', 'Impermeabilização', 'Instalações', 'Acabamento'],
      },
    ]

    const obrasIds = []

    for (const o of obrasData) {
      const rec = new Record(obrasCol)
      rec.set('nome', o.nome)
      rec.set('id_cliente', o.id_cliente)
      rec.set('coordenador_id', coordId)
      app.save(rec)
      obrasIds.push(rec.id)
    }

    for (const f of fasesData) {
      const obraId = obrasIds[f.obraIdx]
      for (const nomeFase of f.fases) {
        const recFase = new Record(fasesCol)
        recFase.set('obra_id', obraId)
        recFase.set('nome_fase', nomeFase)
        app.save(recFase)

        const acts = [
          { nome: 'Preparar material', status: 'Executado' },
          { nome: 'Executar serviço', status: 'Não Executado' },
        ]

        for (const a of acts) {
          const recAct = new Record(ativCol)
          recAct.set('fase_id', recFase.id)
          recAct.set('nome_atividade', a.nome)
          recAct.set('status_execucao', a.status)
          app.save(recAct)
        }
      }
    }
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM obras WHERE nome IN ('Apartamento Itacema 74', 'Casa Vila Mariana', 'Cobertura Pinheiros')",
        )
        .execute()
    } catch (_) {}
  },
)
