migrate(
  (app) => {
    const fases = app.findCollectionByNameOrId('fases')
    fases.addIndex('idx_fases_nome', false, 'nome_fase', '')
    app.save(fases)

    const atividades = app.findCollectionByNameOrId('atividades')
    atividades.addIndex('idx_atividades_nome', false, 'nome_atividade', '')
    app.save(atividades)
  },
  (app) => {
    const fases = app.findCollectionByNameOrId('fases')
    fases.removeIndex('idx_fases_nome')
    app.save(fases)

    const atividades = app.findCollectionByNameOrId('atividades')
    atividades.removeIndex('idx_atividades_nome')
    app.save(atividades)
  },
)
