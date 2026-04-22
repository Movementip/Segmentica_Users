import React, { useCallback, useEffect, useMemo, useState } from "react"

import { DataSearchField } from "@/components/DataSearchField/DataSearchField"
import { PageHeader } from "@/components/PageHeader/PageHeader"
import { RefreshButton } from "@/components/RefreshButton/RefreshButton"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

import {
  getPermissionModuleLabel,
  normalizePermissionKeyForGrouping,
  PERMISSION_MODULE_ORDER,
  permKeyCompare,
} from "../shared/permissionGroups"
import sharedStyles from "../shared/RbacShared.module.css"

type RoleItem = {
  id: number
  key: string
  name?: string | null
  description?: string | null
}

type PermissionItem = {
  id: number
  key: string
  name?: string | null
  description?: string | null
}

type RolePermissionLink = {
  role_id: number
  permission_id: number
}

export function RolePermissionsAdmin({
  embedded,
  onChanged,
}: {
  embedded?: boolean
  onChanged?: () => void
}): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [permissions, setPermissions] = useState<PermissionItem[]>([])
  const [links, setLinks] = useState<RolePermissionLink[]>([])
  const [query, setQuery] = useState("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchAll = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setError(null)
      if (!options?.silent) setLoading(true)

      const [rolesResponse, permissionsResponse, linksResponse] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/permissions"),
        fetch("/api/admin/role-permissions"),
      ])

      const rolesJson = (await rolesResponse.json().catch(() => ({}))) as any
      const permissionsJson = (await permissionsResponse.json().catch(() => ({}))) as any
      const linksJson = (await linksResponse.json().catch(() => ({}))) as any

      if (!rolesResponse.ok) throw new Error(rolesJson?.error || "Ошибка")
      if (!permissionsResponse.ok) throw new Error(permissionsJson?.error || "Ошибка")
      if (!linksResponse.ok) throw new Error(linksJson?.error || "Ошибка")

      setRoles(Array.isArray(rolesJson?.items) ? rolesJson.items : [])
      setPermissions(Array.isArray(permissionsJson?.items) ? permissionsJson.items : [])
      setLinks(Array.isArray(linksJson?.items) ? linksJson.items : [])
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      if (!options?.silent) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!isRefreshing) return
    const timeoutId = window.setTimeout(() => setIsRefreshing(false), 525)
    return () => window.clearTimeout(timeoutId)
  }, [isRefreshing])

  const permissionsById = useMemo(() => {
    const map = new Map<number, PermissionItem>()
    for (const permission of permissions) {
      map.set(Number(permission.id), permission)
    }
    return map
  }, [permissions])

  const permissionIdsByRoleId = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const link of links) {
      const roleId = Number((link as any).role_id)
      const permissionId = Number((link as any).permission_id)
      const set = map.get(roleId) || new Set<number>()
      set.add(permissionId)
      map.set(roleId, set)
    }
    return map
  }, [links])

  const filteredRoles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return roles

    return roles.filter((role) => {
      const rolePermissionIds = permissionIdsByRoleId.get(Number(role.id))
      const permissionKeys = rolePermissionIds
        ? Array.from(rolePermissionIds)
            .map((id) => permissionsById.get(id)?.key || "")
            .join(", ")
            .toLowerCase()
        : ""

      return (
        String(role.id).includes(normalizedQuery) ||
        String(role.key || "").toLowerCase().includes(normalizedQuery) ||
        String(role.name || "").toLowerCase().includes(normalizedQuery) ||
        permissionKeys.includes(normalizedQuery)
      )
    })
  }, [permissionIdsByRoleId, permissionsById, query, roles])

  const filteredPermissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const basePermissions = permissions.slice().sort((a, b) => Number(a.id) - Number(b.id))
    if (!normalizedQuery) return basePermissions

    return basePermissions.filter((permission) => {
      return (
        String(permission.key || "").toLowerCase().includes(normalizedQuery) ||
        String(permission.name || "").toLowerCase().includes(normalizedQuery)
      )
    })
  }, [permissions, query])

  useEffect(() => {
    if (selectedRole || roles.length === 0) return
    const directorRole = roles.find(
      (role) => String(role.key || "").trim().toLowerCase() === "director"
    )
    setSelectedRole(directorRole || roles[0])
  }, [roles, selectedRole])

  const selectedPermissionIds = useMemo(() => {
    if (!selectedRole) return new Set<number>()
    return permissionIdsByRoleId.get(Number(selectedRole.id)) || new Set<number>()
  }, [permissionIdsByRoleId, selectedRole])

  const selectedRoleKey = String(selectedRole?.key || "").trim().toLowerCase()
  const isDirector = selectedRoleKey === "director"

  const selectedPermissionIdsEffective = useMemo(() => {
    if (!selectedRole) return new Set<number>()
    if (isDirector) return new Set<number>(permissions.map((permission) => Number(permission.id)))
    return selectedPermissionIds
  }, [isDirector, permissions, selectedPermissionIds, selectedRole])

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>()

    for (const permission of filteredPermissions) {
      const normalized = normalizePermissionKeyForGrouping(String(permission.key || ""))
      const groupKey = normalized.groupKey || "other"
      const groupItems = groups.get(groupKey) || []
      groupItems.push(permission)
      groups.set(groupKey, groupItems)
    }

    return Array.from(groups.entries())
      .map(([groupKey, items]) => ({
        groupKey,
        label: getPermissionModuleLabel(groupKey),
        items: items.slice().sort(permKeyCompare),
      }))
      .sort((a, b) => {
        const aOrder = PERMISSION_MODULE_ORDER.get(a.groupKey) ?? Number.MAX_SAFE_INTEGER
        const bOrder = PERMISSION_MODULE_ORDER.get(b.groupKey) ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.label.localeCompare(b.label, "ru")
      })
  }, [filteredPermissions])

  useEffect(() => {
    setExpandedGroups((previous) => {
      const next: Record<string, boolean> = {}

      for (const group of permissionGroups) {
        if (Object.prototype.hasOwnProperty.call(previous, group.groupKey)) {
          next[group.groupKey] = previous[group.groupKey]
        } else {
          next[group.groupKey] = query.trim().length > 0
        }
      }

      return next
    })
  }, [permissionGroups, query])

  const toggleGroupExpanded = useCallback((groupKey: string) => {
    setExpandedGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }))
  }, [])

  const togglePermission = async (permissionId: number) => {
    if (!selectedRole || isDirector) return

    const roleId = Number(selectedRole.id)
    const hasPermission = selectedPermissionIdsEffective.has(permissionId)

    try {
      setSaving(true)

      if (!hasPermission) {
        const response = await fetch("/api/admin/role-permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, permissionId }),
        })
        const json = (await response.json().catch(() => ({}))) as any
        if (!response.ok) throw new Error(json?.error || "Ошибка")

        setLinks((previous) => previous.concat({ role_id: roleId, permission_id: permissionId }))
      } else {
        const response = await fetch(
          `/api/admin/role-permissions?roleId=${encodeURIComponent(String(roleId))}&permissionId=${encodeURIComponent(String(permissionId))}`,
          { method: "DELETE" }
        )
        const json = (await response.json().catch(() => ({}))) as any
        if (!response.ok) throw new Error(json?.error || "Ошибка")

        setLinks((previous) =>
          previous.filter(
            (link) =>
              !(
                Number((link as any).role_id) === roleId &&
                Number((link as any).permission_id) === permissionId
              )
          )
        )
      }

      void fetchAll({ silent: true })
      onChanged?.()
    } catch (errorResponse) {
      setError((errorResponse as any)?.message || "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div>
      <PageHeader
        title="Права ролей"
        subtitle="Выдача и отзыв прав ролям сотрудников"
        actions={(
          <div className={sharedStyles.sectionActions}>
            <RefreshButton
              className={sharedStyles.surfaceButton}
              isRefreshing={loading || isRefreshing}
              refreshKey={refreshKey}
              iconClassName={sharedStyles.spin}
              onClick={() => {
                setIsRefreshing(true)
                setRefreshKey((value) => value + 1)
                void fetchAll()
              }}
            />
          </div>
        )}
      />

      <div className={sharedStyles.searchRow}>
        <DataSearchField
          wrapperClassName={sharedStyles.searchField}
          value={query}
          onValueChange={setQuery}
          placeholder="Поиск по роли и правам…"
        />
      </div>

      {error ? (
        <div className={`${sharedStyles.stateCard} ${sharedStyles.stateCardError}`}>
          {error}
        </div>
      ) : loading ? (
        <div className={sharedStyles.stateCard}>Загрузка…</div>
      ) : filteredRoles.length === 0 ? (
        <div className={sharedStyles.stateCard}>Роли не найдены</div>
      ) : (
        <div className={sharedStyles.split}>
          <div className={sharedStyles.sideColumn}>
            <div className={sharedStyles.roleList}>
              {filteredRoles
                .slice()
                .sort((a, b) => Number(a.id) - Number(b.id))
                .map((role) => {
                  const roleId = Number(role.id)
                  const permissionIds = permissionIdsByRoleId.get(roleId) || new Set<number>()
                  const isSelected = selectedRole ? Number(selectedRole.id) === roleId : false
                  const count =
                    String(role.key || "").trim().toLowerCase() === "director"
                      ? permissions.length
                      : permissionIds.size

                  return (
                    <div
                      key={role.id}
                      className={`${sharedStyles.roleCard} ${sharedStyles.roleCardClickable} ${isSelected ? sharedStyles.roleCardSelected : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRole(role)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        setSelectedRole(role)
                      }}
                    >
                      <div className={sharedStyles.roleCardHeader}>
                        <div className={sharedStyles.roleCardTitleText}>
                          <div className={sharedStyles.roleCardName}>
                            {role.name || role.key}
                          </div>
                          <div className={sharedStyles.mono}>{role.key}</div>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          <div className={sharedStyles.mainColumn}>
            <div className={sharedStyles.panelCard}>
              <div className={sharedStyles.panelLead}>
                <div className={sharedStyles.panelTitle}>
                  {selectedRole
                    ? `Права роли "${selectedRole.name || selectedRole.key}"`
                    : "Права роли"}
                </div>
                <div className={sharedStyles.panelText}>
                  {isDirector
                    ? "У роли director все права выданы и не могут быть отозваны."
                    : "Отметьте права, которые должны быть выданы роли."}
                </div>
              </div>
            </div>

            <div className={sharedStyles.permSections}>
              {permissionGroups.length === 0 ? (
                <div className={sharedStyles.stateCard}>
                  По вашему запросу права не найдены.
                </div>
              ) : (
                permissionGroups.map((group) => {
                  const expanded = expandedGroups[group.groupKey] ?? false
                  const total = group.items.length
                  const selectedCount = group.items.reduce(
                    (accumulator, permission) =>
                      accumulator +
                      (selectedPermissionIdsEffective.has(Number(permission.id)) ? 1 : 0),
                    0
                  )

                  return (
                    <div key={group.groupKey} className={sharedStyles.permGroupCard}>
                      <button
                        type="button"
                        className={sharedStyles.permGroupToggle}
                        onClick={() => toggleGroupExpanded(group.groupKey)}
                      >
                        <div className={sharedStyles.permGroupToggleLeft}>
                          <div className={sharedStyles.roleCardName}>{group.label}</div>
                          <div className={sharedStyles.panelText}>
                            {expanded ? "Скрыть права" : "Показать права"}
                          </div>
                        </div>

                        <div className={sharedStyles.permGroupToggleRight}>
                          <Badge variant="outline">{selectedCount}/{total}</Badge>
                          <span
                            className={`${sharedStyles.permGroupChevron} ${expanded ? sharedStyles.permGroupChevronOpen : ""}`}
                            aria-hidden="true"
                          >
                            ▾
                          </span>
                        </div>
                      </button>

                      {expanded ? (
                        <div className={sharedStyles.permList}>
                          {group.items.map((permission) => {
                            const permissionId = Number(permission.id)
                            const checked = selectedPermissionIdsEffective.has(permissionId)
                            const disabled = saving || !selectedRole || isDirector

                            const toggleRow = () => {
                              if (disabled) return
                              void togglePermission(permissionId)
                            }

                            return (
                              <div
                                key={permission.id}
                                className={`${sharedStyles.permCard} ${sharedStyles.permCardInteractive}`}
                                role={disabled ? undefined : "button"}
                                tabIndex={disabled ? -1 : 0}
                                onClick={disabled ? undefined : toggleRow}
                                onKeyDown={(event) => {
                                  if (disabled) return
                                  if (event.key !== "Enter" && event.key !== " ") return
                                  event.preventDefault()
                                  toggleRow()
                                }}
                              >
                                <div className={sharedStyles.permCardHeader}>
                                  <div className={sharedStyles.permCardTitleRow}>
                                    <span
                                      onClick={(event) => event.stopPropagation()}
                                      onKeyDown={(event) => event.stopPropagation()}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={disabled}
                                        className={sharedStyles.checkbox}
                                        onCheckedChange={() => {
                                          if (disabled) return
                                          toggleRow()
                                        }}
                                      />
                                    </span>

                                    <div className={sharedStyles.permCardTitleText}>
                                      <div className={sharedStyles.permCardTitle}>
                                        {permission.name || permission.key}
                                      </div>
                                      <div className={sharedStyles.permKeyText}>
                                        {permission.key}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (embedded) return <div>{content}</div>
  return <div>{content}</div>
}
