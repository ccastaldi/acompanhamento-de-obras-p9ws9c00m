migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('obras')
    if (!col.fields.getByName('sync_at')) {
      col.fields.add(new DateField({ name: 'sync_at' }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('obras')
    if (col.fields.getByName('sync_at')) {
      col.fields.removeByName('sync_at')
      app.save(col)
    }
  },
)
