migrate(
  (app) => {
    const fases = app.findCollectionByNameOrId('fases')

    const atividades = new Collection({
      name: 'atividades',
      type: 'base',
      listRule: "@request.auth.id != '' && fase_id.obra_id.coordenador_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && fase_id.obra_id.coordenador_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.auth.role = 'coordenador'",
      updateRule: "@request.auth.id != '' && fase_id.obra_id.coordenador_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && fase_id.obra_id.coordenador_id = @request.auth.id",
      fields: [
        {
          name: 'fase_id',
          type: 'relation',
          required: true,
          collectionId: fases.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome_atividade', type: 'text', required: true },
        {
          name: 'status_execucao',
          type: 'select',
          required: true,
          values: ['Executado', 'Não Executado'],
          maxSelect: 1,
        },
        { name: 'data_inicio_previsto', type: 'date' },
        { name: 'data_fim_previsto', type: 'date' },
        { name: 'responsavel', type: 'text' },
        { name: 'observacao', type: 'text' },
        { name: 'foto_url', type: 'url' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_atividades_fase ON atividades (fase_id)'],
    })
    app.save(atividades)
  },
  (app) => {
    const atividades = app.findCollectionByNameOrId('atividades')
    app.delete(atividades)
  },
)
