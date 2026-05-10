routerAdd(
  'POST',
  '/backend/v1/sincronizar-tabobra',
  (e) => {
    const body = e.requestInfo().body || {}
    const obra_id = body.obra_id
    const data = body.data

    if (!obra_id) {
      return e.badRequestError('Campo obrigatório obra_id.')
    }

    if (!data || !Array.isArray(data)) {
      return e.badRequestError('Campo obrigatório data (array de atividades).')
    }

    try {
      $app.findRecordById('obras', obra_id)
    } catch (_) {
      return e.notFoundError('Obra não encontrada.')
    }

    let count = 0

    try {
      $app.runInTransaction((txApp) => {
        const fasesCol = txApp.findCollectionByNameOrId('fases')
        const ativCol = txApp.findCollectionByNameOrId('atividades')

        for (const row of data) {
          const nomeFase = row['Fase Obra']
          const nomeAtividade = row['Atividades']
          let statusExecucao = row['Status Execução']

          if (statusExecucao !== 'Executado') {
            statusExecucao = 'Não Executado'
          }

          const formatToDate = (val) => {
            if (!val) return ''
            if (typeof val === 'number') {
              const d = new Date(Math.round((val - 25569) * 86400 * 1000))
              return d.toISOString().split('T')[0] + ' 00:00:00.000Z'
            }
            if (typeof val === 'string') {
              if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10) + ' 00:00:00.000Z'
              try {
                const d = new Date(val)
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0] + ' 00:00:00.000Z'
              } catch (_) {}
            }
            return ''
          }

          const dataInicioPrevisto = formatToDate(row['Ini Prev'])
          const dataFimPrevisto = formatToDate(row['Fim Prev'])
          const responsavel = row['Resp'] || ''

          if (!nomeFase || !nomeAtividade) continue

          let faseId
          try {
            const existingFase = txApp.findFirstRecordByFilter(
              'fases',
              'obra_id = {:obraId} && nome_fase = {:nome}',
              { obraId: obra_id, nome: nomeFase },
            )
            faseId = existingFase.id
          } catch (_) {
            const newFase = new Record(fasesCol)
            newFase.set('obra_id', obra_id)
            newFase.set('nome_fase', nomeFase)
            txApp.save(newFase)
            faseId = newFase.id
          }

          try {
            const existingAtiv = txApp.findFirstRecordByFilter(
              'atividades',
              'fase_id = {:faseId} && nome_atividade = {:nome}',
              { faseId: faseId, nome: nomeAtividade },
            )
            existingAtiv.set('status_execucao', statusExecucao)
            if (dataInicioPrevisto) existingAtiv.set('data_inicio_previsto', dataInicioPrevisto)
            if (dataFimPrevisto) existingAtiv.set('data_fim_previsto', dataFimPrevisto)
            existingAtiv.set('responsavel', responsavel)
            txApp.save(existingAtiv)
          } catch (_) {
            const newAtiv = new Record(ativCol)
            newAtiv.set('fase_id', faseId)
            newAtiv.set('nome_atividade', nomeAtividade)
            newAtiv.set('status_execucao', statusExecucao)
            if (dataInicioPrevisto) newAtiv.set('data_inicio_previsto', dataInicioPrevisto)
            if (dataFimPrevisto) newAtiv.set('data_fim_previsto', dataFimPrevisto)
            newAtiv.set('responsavel', responsavel)
            txApp.save(newAtiv)
          }
          count++
        }
      })
    } catch (err) {
      $app.logger().error('Erro na transacao de sync', 'error', err.message)
      return e.badRequestError('Erro ao sincronizar TabObra. Tente novamente.')
    }

    return e.json(200, { data: { message: 'Sincronização concluída com sucesso', count } })
  },
  $apis.requireAuth(),
)
