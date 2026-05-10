migrate(
  (app) => {
    const obras = new Collection({
      name: 'obras',
      type: 'base',
      listRule: "@request.auth.id != '' && coordenador_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && coordenador_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.auth.role = 'coordenador'",
      updateRule: "@request.auth.id != '' && coordenador_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && coordenador_id = @request.auth.id",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'id_cliente', type: 'text' },
        {
          name: 'coordenador_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'secret_onedrive', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_obras_coordenador ON obras (coordenador_id)'],
    })
    app.save(obras)

    const fases = new Collection({
      name: 'fases',
      type: 'base',
      listRule: "@request.auth.id != '' && obra_id.coordenador_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && obra_id.coordenador_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.auth.role = 'coordenador'",
      updateRule: "@request.auth.id != '' && obra_id.coordenador_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && obra_id.coordenador_id = @request.auth.id",
      fields: [
        {
          name: 'obra_id',
          type: 'relation',
          required: true,
          collectionId: obras.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome_fase', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_fases_obra ON fases (obra_id)'],
    })
    app.save(fases)
  },
  (app) => {
    const fases = app.findCollectionByNameOrId('fases')
    app.delete(fases)
    const obras = app.findCollectionByNameOrId('obras')
    app.delete(obras)
  },
)
