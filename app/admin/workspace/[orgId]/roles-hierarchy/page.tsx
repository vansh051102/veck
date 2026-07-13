'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import { PERMISSION_GROUPS, RESOURCE_LABELS, ACTION_LABELS } from '@/lib/permissions'
import { Modal } from '@/components/ui/modal'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  hierarchyLevel: number
  department: string | null
  parentRoleId: string | null
  memberCount?: number
}

function displayName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Column order for the permission matrix — union of every action across all resources.
const ALL_ACTIONS = Object.keys(ACTION_LABELS).filter((action) =>
  Object.values(PERMISSION_GROUPS).some((actions) => actions.includes(action))
)

export default function RolesHierarchyPage() {
  const { toast } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [editing, setEditing] = useState<Role | null>(null)
  const [perms, setPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [hierarchy, setHierarchy] = useState<{ roleId: string; parentRoleId?: string | null }[]>([])

  function load() {
    api
      .get<Role[]>('/roles')
      .then((res) => setRoles(res.data ?? []))
      .catch((err) => toast(toFormErrors(err, 'Failed to load roles').message, 'error'))
    api.get<{ roleHierarchy?: typeof hierarchy }>('/settings').then((res) => {
      setHierarchy((res.data?.roleHierarchy as typeof hierarchy) ?? [])
    })
  }

  useEffect(() => {
    load()
  }, [])

  function openEdit(role: Role) {
    setEditing(role)
    setPerms([...(role.permissions as string[])])
  }

  function toggle(resource: string, action: string) {
    const p = `${resource}:${action}`
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function applyPreset(resource: string, preset: 'none' | 'view' | 'full') {
    const actions = PERMISSION_GROUPS[resource]
    const resourcePerms = actions.map((a) => `${resource}:${a}`)
    setPerms((prev) => {
      const withoutResource = prev.filter((p) => !resourcePerms.includes(p))
      if (preset === 'none') return withoutResource
      if (preset === 'view') return [...withoutResource, `${resource}:read`]
      return [...withoutResource, ...resourcePerms]
    })
  }

  async function saveRole() {
    if (!editing) return
    setSaving(true)
    try {
      await api.put(`/roles/${editing.id}`, {
        permissions: perms,
        description: editing.description,
        hierarchyLevel: editing.hierarchyLevel,
        parentRoleId: editing.parentRoleId,
      })
      toast('Role updated')
      setEditing(null)
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to save role').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function createRole() {
    if (!newName.trim()) return
    try {
      await api.post('/roles', {
        name: newName.trim(),
        permissions: ['leads:read'],
        hierarchyLevel: 0,
      })
      toast('Role created')
      setCreating(false)
      setNewName('')
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to create role').message, 'error')
    }
  }

  async function exportJson() {
    const payload = { roles, hierarchy }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'veck-roles-hierarchy.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importJson(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as { roles?: Role[]; hierarchy?: typeof hierarchy }
      if (data.hierarchy) {
        await api.put('/settings', { roleHierarchy: data.hierarchy })
      }
      if (data.roles) {
        for (const r of data.roles) {
          const existing = roles.find((x) => x.name === r.name)
          if (existing) {
            await api.put(`/roles/${existing.id}`, {
              permissions: r.permissions,
              description: r.description,
            })
          } else {
            await api.post('/roles', {
              name: r.name,
              permissions: r.permissions?.length ? r.permissions : ['leads:read'],
              description: r.description,
              hierarchyLevel: r.hierarchyLevel ?? 0,
            })
          }
        }
      }
      toast('Import complete')
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Import failed').message, 'error')
    }
  }

  async function saveHierarchyOrder() {
    const ordered = roles
      .slice()
      .sort((a, b) => b.hierarchyLevel - a.hierarchyLevel)
      .map((r, i, arr) => ({
        roleId: r.id,
        parentRoleId: i === 0 ? null : arr[i - 1].id,
      }))
    try {
      await api.put('/settings', { roleHierarchy: ordered })
      setHierarchy(ordered)
      toast('Hierarchy saved')
    } catch (err) {
      toast(toFormErrors(err, 'Failed to save hierarchy').message, 'error')
    }
  }

  const sorted = [...roles].sort((a, b) => b.hierarchyLevel - a.hierarchyLevel)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define roles for your organization and control what each role can access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>
            Export JSON
          </Button>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
            />
          </label>
          <Button onClick={() => setCreating(true)}>+ Create new role</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{displayName(role.name)}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {role.description || 'Custom role'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {role.memberCount ?? 0} members assigned
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEdit(role)}
                className="text-xs font-medium text-accent hover:underline"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Hierarchy</h3>
            <p className="text-sm text-muted-foreground">
              Reporting structure by hierarchy level (highest at top).
            </p>
          </div>
          <Button variant="outline" onClick={saveHierarchyOrder}>
            Save hierarchy
          </Button>
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          {sorted.map((role, i) => (
            <div key={role.id} className="flex flex-col items-center">
              {i > 0 && <div className="h-4 w-px bg-border" />}
              <div
                className="rounded-full border border-border bg-sky-mist/40 px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: 'hsl(210 40% 96%)' }}
              >
                {displayName(role.name)}
              </div>
            </div>
          ))}
          {hierarchy.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Hierarchy saved for this workspace.</p>
          )}
        </div>
      </section>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit role: ${displayName(editing.name)}` : ''}
        size="lg"
      >
        {editing && (
          <div className="flex flex-col">
            <p className="text-sm text-muted-foreground">
              {editing.name === 'admin'
                ? 'The admin role always has full access and cannot be changed.'
                : 'Choose what this role can see and do in each area. Use the presets for a quick grant, or check individual actions for fine control.'}
            </p>
            <fieldset
              disabled={editing.name === 'admin'}
              className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-border disabled:opacity-60"
            >
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th className="w-56 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Area
                    </th>
                    {ALL_ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Quick set
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PERMISSION_GROUPS).map(([resource, actions]) => {
                    const meta = RESOURCE_LABELS[resource]
                    return (
                      <tr key={resource} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium">{meta?.label ?? displayName(resource)}</p>
                          {meta?.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                          )}
                        </td>
                        {ALL_ACTIONS.map((action) => {
                          if (!actions.includes(action)) {
                            return (
                              <td key={action} className="px-2 py-2 text-center text-muted-foreground">
                                —
                              </td>
                            )
                          }
                          const p = `${resource}:${action}`
                          const on = perms.includes(p) || perms.includes('*')
                          return (
                            <td key={action} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle(resource, action)}
                                aria-label={`${ACTION_LABELS[action]} ${meta?.label ?? resource}`}
                                className="h-4 w-4 cursor-pointer accent-primary"
                              />
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-right align-top">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => applyPreset(resource, 'none')}
                              className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                            >
                              None
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPreset(resource, 'view')}
                              className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                            >
                              View only
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPreset(resource, 'full')}
                              className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                            >
                              Full access
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </fieldset>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {perms.includes('*') ? 'All permissions' : `${perms.length} permission${perms.length === 1 ? '' : 's'} selected`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={saveRole} disabled={editing.name === 'admin' || saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create new role">
        <div className="space-y-3">
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            placeholder="Role name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button onClick={createRole}>Create</Button>
        </div>
      </Modal>
    </div>
  )
}
