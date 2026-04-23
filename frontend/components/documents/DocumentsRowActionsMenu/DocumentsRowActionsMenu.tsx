import {
  FiDownload,
  FiExternalLink,
  FiLink2,
  FiMoreHorizontal,
  FiTrash2,
} from "react-icons/fi";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AttachmentRegistryItem } from "@/types/pages/documents";

type DocumentsRowActionsMenuProps = {
  canAttach: boolean
  canDelete: boolean
  classNames: {
    menuButton: string
    rowMenuIcon: string
    rowMenuIconDel: string
    rowMenuItemDanger: string
  }
  item: AttachmentRegistryItem
  onAttach: (item: AttachmentRegistryItem) => void
  onDelete: (item: AttachmentRegistryItem) => void
}

export function DocumentsRowActionsMenu({
  canAttach,
  canDelete,
  classNames,
  item,
  onAttach,
  onDelete,
}: DocumentsRowActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={classNames.menuButton}
            aria-label="Действия"
            title="Действия"
          />
        )}
      >
        <FiMoreHorizontal size={18} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuItem onClick={() => window.open(`/api/attachments/${encodeURIComponent(item.id)}/download`, "_blank", "noopener,noreferrer")}>
          <FiDownload className={classNames.rowMenuIcon} />
          Скачать
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => window.open(`/api/attachments/${encodeURIComponent(item.id)}/inline`, "_blank", "noopener,noreferrer")}>
          <FiExternalLink className={classNames.rowMenuIcon} />
          Открыть
        </DropdownMenuItem>

        {canAttach ? (
          <DropdownMenuItem onClick={() => onAttach(item)}>
            <FiLink2 className={classNames.rowMenuIcon} />
            Привязать
          </DropdownMenuItem>
        ) : null}

        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={classNames.rowMenuItemDanger}
              onClick={() => onDelete(item)}
            >
              <FiTrash2 className={classNames.rowMenuIconDel} />
              Удалить
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
