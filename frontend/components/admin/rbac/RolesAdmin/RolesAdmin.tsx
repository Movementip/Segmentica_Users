import { RbacDictionaryAdmin } from "../shared/RbacDictionaryAdmin/RbacDictionaryAdmin"

export function RolesAdmin({ embedded }: { embedded?: boolean }): JSX.Element {
  return (
    <RbacDictionaryAdmin
      embedded={embedded}
      endpoint="/api/admin/roles"
      title="Роли"
      subtitle="CRUD ролей и служебных групп доступа"
      createButtonLabel="Добавить роль"
      createDialogTitle="Новая роль"
      editDialogTitle="Редактирование роли"
      deleteMessageBuilder={(item) => `Удалить роль ${item.key}?`}
      deleteWarning="Это действие нельзя отменить. Роль будет удалена."
      searchPlaceholder="Поиск по id, key, названию и описанию…"
      keyPlaceholder="director"
      namePlaceholder="Директор"
      descriptionPlaceholder="Полный доступ"
      emptyLabel="Роли не найдены"
    />
  )
}
