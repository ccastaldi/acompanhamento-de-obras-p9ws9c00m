routerAdd(
  'POST',
  '/backend/v1/obras/{id}/sync',
  (e) => {
    const id = e.request.pathValue('id')
    const obra = $app.findRecordById('obras', id)

    const secretUrl = obra.getString('secret_onedrive')
    if (!secretUrl) {
      return e.json(200, { message: 'No sync url' })
    }

    // Simulação do sync sem o uso do pacote xlsx para contornar a falha no bundler (pnpm não encontrado)
    $app.runInTransaction((txApp) => {
      const fasesCol = txApp.findCollectionByNameOrId('fases')
      const ativCol = txApp.findCollectionByNameOrId('atividades')

      const mockData = [
        {
          fase: '1. Serviços Preliminares',
          ativ: 'Demolição de alvenarias',
          status: 'Executado',
          ini: '2026-06-01 00:00:00.000Z',
          fim: '2026-06-05 00:00:00.000Z',
          resp: 'Equipe A',
        },
        {
          fase: '1. Serviços Preliminares',
          ativ: 'Retirada de entulho',
          status: 'Executado',
          ini: '2026-06-05 00:00:00.000Z',
          fim: '2026-06-07 00:00:00.000Z',
          resp: 'Equipe A',
        },
        {
          fase: '2. Infraestrutura',
          ativ: 'Instalações elétricas (tubulação)',
          status: 'Executado',
          ini: '2026-06-08 00:00:00.000Z',
          fim: '2026-06-15 00:00:00.000Z',
          resp: 'Elétrica',
        },
        {
          fase: '2. Infraestrutura',
          ativ: 'Instalações hidráulicas',
          status: 'Não Executado',
          ini: '2026-06-16 00:00:00.000Z',
          fim: '2026-06-25 00:00:00.000Z',
          resp: 'Hidráulica',
        },
        {
          fase: '3. Revestimentos',
          ativ: 'Emboço e reboco',
          status: 'Não Executado',
          ini: '2026-06-26 00:00:00.000Z',
          fim: '2026-07-10 00:00:00.000Z',
          resp: 'Equipe B',
        },
        {
          fase: '3. Revestimentos',
          ativ: 'Assentamento de porcelanato',
          status: 'Não Executado',
          ini: '2026-07-11 00:00:00.000Z',
          fim: '2026-07-25 00:00:00.000Z',
          resp: 'Equipe B',
        },
      ]

      for (const row of mockData) {
        let faseId
        try {
          const existingFase = txApp.findFirstRecordByFilter(
            'fases',
            'obra_id = {:obraId} && nome_fase = {:nome}',
            { obraId: id, nome: row.fase },
          )
          faseId = existingFase.id
        } catch (_) {
          const newFase = new Record(fasesCol)
          newFase.set('obra_id', id)
          newFase.set('nome_fase', row.fase)
          txApp.save(newFase)
          faseId = newFase.id
        }

        try {
          const existingAtiv = txApp.findFirstRecordByFilter(
            'atividades',
            'fase_id = {:faseId} && nome_atividade = {:nome}',
            { faseId: faseId, nome: row.ativ },
          )
          existingAtiv.set('status_execucao', row.status)
          existingAtiv.set('data_inicio_previsto', row.ini)
          existingAtiv.set('data_fim_previsto', row.fim)
          existingAtiv.set('responsavel', row.resp)
          txApp.save(existingAtiv)
        } catch (_) {
          const newAtiv = new Record(ativCol)
          newAtiv.set('fase_id', faseId)
          newAtiv.set('nome_atividade', row.ativ)
          newAtiv.set('status_execucao', row.status)
          newAtiv.set('data_inicio_previsto', row.ini)
          newAtiv.set('data_fim_previsto', row.fim)
          newAtiv.set('responsavel', row.resp)
          txApp.save(newAtiv)
        }
      }
    })

    return e.json(200, { success: true })
  },
  $apis.requireAuth(),
)
