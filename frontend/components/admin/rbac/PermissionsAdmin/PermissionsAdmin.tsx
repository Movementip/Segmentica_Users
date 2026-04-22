import { RbacDictionaryAdmin } from "../shared/RbacDictionaryAdmin/RbacDictionaryAdmin"

export function PermissionsAdmin({ embedded }: { embedded?: boolean }): JSX.Element {
  return (
    <RbacDictionaryAdmin
      embedded={embedded}
      endpoint="/api/admin/permissions"
      title="Права"
      subtitle="CRUD прав доступа и служебных разрешений"
      createButtonLabel="Добавить право"
      createDialogTitle="Новое право"
      editDialogTitle="Редактирование права"
      deleteMessageBuilder={(item) => `Удалить право ${item.key}?`}
      deleteWarning="Это действие нельзя отменить. Право будет удалено."
      searchPlaceholder="Поиск по id, key, названию и описанию…"
      keyPlaceholder="orders.view"
      namePlaceholder="Просмотр заявок"
      descriptionPlaceholder="Доступ на просмотр раздела"
      emptyLabel="Права не найдены"
    />
  )
}
