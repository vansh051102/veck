'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { toFormErrors } from '@/lib/form-errors'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useCurrentUser } from '@/lib/use-current-user'
import { PermissionGate } from '@/components/permission-gate'
import { PERMISSIONS } from '@/lib/rbac'

interface Settings {
  autoAssignmentEnabled: boolean
  autoAssignmentRule: { rule_type: 'least_open_leads' | 'round_robin' } | null
  slaDefaultHours: number
  slaWarningHours: number
  emailNotificationsEnabled: boolean
}

interface OrgUser {
  id: string
  email: string
  fullName: string
  role: string
  department: string | null
  designation: string | null
  status: string
  lastLogin: string | null
  createdAt: string
}

interface Role {
  id: string
  name: string
  description: string | null
  permissions: string[]
  hierarchyLevel: number
  department: string | null
}

const ALL_PERMISSIONS: Record<string, string[]> = {
  leads: ['read', 'create', 'edit', 'delete', 'assign', 'import', 'export'],
  contacts: ['read', 'create', 'edit', 'delete'],
  companies: ['read', 'create', 'edit', 'delete'],
  activities: ['read', 'create', 'edit', 'delete'],
  quotes: ['read', 'create', 'edit', 'send', 'delete'],
  purchase_requests: ['read', 'create', 'edit', 'delete'],
  checklists: ['read', 'create', 'edit', 'delete'],
  reports: ['read', 'export'],
  settings: ['read', 'edit'],
  roles: ['read', 'edit'],
  users: ['read', 'create', 'edit', 'delete'],
  tags: ['read', 'create', 'edit', 'delete'],
  documents: ['read', 'create', 'edit', 'delete'],
  tasks: ['read', 'create', 'edit', 'delete'],
}

const DEPARTMENTS = ['Marketing', 'Sales', 'Purchase', 'Management']
const DESIGNATIONS = [
  'Marketing Manager',
  'Marketing Executive',
  'Sales Manager',
  'Sales Executive',
  'Purchase Executive',
  'Admin',
  'Director',
]

export default function SettingsPage() {
  const { toast } = useToast()
  const me = useCurrentUser()
  const isAdmin = me?.role === 'admin'

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // User management state
  const [users, setUsers] = useState<OrgUser[]>([])
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null)
  const [showUserForm, setShowUserForm] = useState(false)
  const [userForm, setUserForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: 'sales_executive',
    department: '',
    designation: '',
  })
  const [saving, setSaving] = useState(false)

  // Role management state
  const [roles, setRoles] = useState<Role[]>([])
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [rolePermissions, setRolePermissions] = useState<string[]>([])

  useEffect(() => {
    api
      .get<Settings>('/settings')
      .then((res) => setSettings(res.data ?? null))
      .catch((err) => setError(toFormErrors(err, 'Failed to load settings').message))
      .finally(() => setLoading(false))
  }, [])

  // Load users for admin
  useEffect(() => {
    if (!isAdmin) return
    loadUsers()
    loadRoles()
  }, [isAdmin])

  function loadUsers() {
    api
      .get<OrgUser[]>('/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => {})
  }

  function loadRoles() {
    api
      .get<Role[]>('/roles')
      .then((res) => setRoles(res.data ?? []))
      .catch(() => {})
  }

  async function update(patch: Partial<Settings>) {
    if (!settings) return
    const previous = settings
    setSettings({ ...settings, ...patch })
    try {
      const res = await api.put<Settings>('/settings', patch)
      setSettings(res.data ?? { ...settings, ...patch })
      toast('Settings saved')
    } catch (err) {
      setSettings(previous)
      toast(toFormErrors(err, 'Failed to save settings').message, 'error')
    }
  }

  async function createUser() {
    if (!userForm.email || !userForm.fullName || !userForm.password) {
      toast('Please fill in all required fields', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/users', {
        email: userForm.email,
        password: userForm.password,
        fullName: userForm.fullName,
        role: userForm.role,
        department: userForm.department || null,
        designation: userForm.designation || null,
      })
      toast('User created successfully')
      setShowUserForm(false)
      setUserForm({ email: '', fullName: '', password: '', role: 'sales_executive', department: '', designation: '' })
      loadUsers()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to create user').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function updateUser() {
    if (!editingUser) return
    setSaving(true)
    try {
      await api.put(`/users/${editingUser.id}`, {
        role: userForm.role,
        department: userForm.department || null,
        designation: userForm.designation || null,
      })
      setUsers(users.map((u) =>
        u.id === editingUser.id
          ? { ...u, role: userForm.role, department: userForm.department || null, designation: userForm.designation || null }
          : u
      ))
      setEditingUser(null)
      toast('User updated')
    } catch (err) {
      toast(toFormErrors(err, 'Failed to update user').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deactivateUser(userId: string) {
    if (!confirm('Are you sure you want to deactivate this user? They will not be able to log in.')) return
    try {
      await api.delete(`/users/${userId}`)
      setUsers(users.map((u) => (u.id === userId ? { ...u, status: 'inactive' } : u)))
      toast('User deactivated')
    } catch (err) {
      toast(toFormErrors(err, 'Failed to deactivate user').message, 'error')
    }
  }

  async function saveRole() {
    if (!editingRole) return
    setSaving(true)
    try {
      await api.put(`/roles/${editingRole.id}`, {
        permissions: rolePermissions,
      })
      setRoles(roles.map((r) => (r.id === editingRole.id ? { ...r, permissions: rolePermissions } : r)))
      setEditingRole(null)
      toast('Role permissions updated')
    } catch (err) {
      toast(toFormErrors(err, 'Failed to update role').message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function togglePermission(resource: string, action: string) {
    const perm = `${resource}:${action}`
    setRolePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading settings…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!settings) return null

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Settings are read-only for your role. Ask an admin to make changes.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lead assignment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.autoAssignmentEnabled}
              disabled={!isAdmin}
              onChange={(e) => update({ autoAssignmentEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Auto-assign new leads</span>
          </label>

          {settings.autoAssignmentEnabled && (
            <div className="ml-7 flex flex-col gap-1.5">
              <label htmlFor="assignment-rule" className="text-sm font-medium">
                Assignment rule
              </label>
              <select
                id="assignment-rule"
                value={settings.autoAssignmentRule?.rule_type ?? 'least_open_leads'}
                disabled={!isAdmin}
                onChange={(e) =>
                  update({
                    autoAssignmentRule: {
                      rule_type: e.target.value as 'least_open_leads' | 'round_robin',
                    },
                  })
                }
                className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="least_open_leads">Least open leads (capacity-based)</option>
                <option value="round_robin">Round-robin (sequential rotation)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {settings.autoAssignmentRule?.rule_type === 'round_robin'
                  ? 'Assigns to the next user in alphabetical order after the last assigned.'
                  : 'Assigns to the active user with the fewest open leads.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.emailNotificationsEnabled}
              disabled={!isAdmin}
              onChange={(e) => update({ emailNotificationsEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Email notifications</span>
          </label>
        </CardContent>
      </Card>

      {/* Role Management — Admin Only */}
      <PermissionGate permission={PERMISSIONS.ROLES_READ}>
        <Card>
          <CardHeader>
            <CardTitle>Role Management</CardTitle>
            <p className="text-sm text-muted-foreground">View and edit role permissions</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {role.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        L{role.hierarchyLevel}
                      </span>
                      {role.department && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {role.department}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {role.description || `${role.permissions.length} permissions`}
                    </p>
                  </div>
                  <PermissionGate permission={PERMISSIONS.ROLES_EDIT}>
                    <button
                      onClick={() => {
                        setEditingRole(role)
                        setRolePermissions([...role.permissions])
                      }}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                    >
                      Edit
                    </button>
                  </PermissionGate>
                </div>
              ))}
            </div>

            {editingRole && (
              <div className="mt-4 rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    Editing: {editingRole.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={saveRole}
                      disabled={saving || editingRole.name === 'admin'}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingRole(null)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                {editingRole.name === 'admin' ? (
                  <p className="text-xs text-muted-foreground">
                    Admin role has all permissions and cannot be modified.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(ALL_PERMISSIONS).map(([resource, actions]) => (
                      <div key={resource}>
                        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {resource.replace(/_/g, ' ')}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {actions.map((action) => {
                            const perm = `${resource}:${action}`
                            const checked = rolePermissions.includes(perm)
                            return (
                              <label key={action} className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(resource, action)}
                                  className="h-3 w-3 rounded border-border"
                                />
                                {action}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </PermissionGate>

      {/* User Management — Admin Only */}
      <PermissionGate permission="users:read">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <PermissionGate permission="users:create">
                <button
                  onClick={() => {
                    setShowUserForm(true)
                    setEditingUser(null)
                    setUserForm({ email: '', fullName: '', password: '', role: 'sales_executive', department: '', designation: '' })
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Add User
                </button>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Role</th>
                      <th className="pb-2 font-medium">Department</th>
                      <th className="pb-2 font-medium">Designation</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-border/50">
                        <td className="py-2 font-medium">{user.fullName}</td>
                        <td className="py-2 text-muted-foreground">{user.email}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">{user.department || '—'}</td>
                        <td className="py-2 text-muted-foreground">{user.designation || '—'}</td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <PermissionGate permission="users:edit">
                              <button
                                onClick={() => {
                                  setEditingUser(user)
                                  setShowUserForm(false)
                                  setUserForm({
                                    email: user.email,
                                    fullName: user.fullName,
                                    password: '',
                                    role: user.role,
                                    department: user.department || '',
                                    designation: user.designation || '',
                                  })
                                }}
                                className="text-xs text-primary hover:underline"
                              >
                                Edit
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="users:delete">
                              {user.status === 'active' && user.id !== me?.id && (
                                <button
                                  onClick={() => deactivateUser(user.id)}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  Deactivate
                                </button>
                              )}
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create / Edit User Form */}
            {(showUserForm || editingUser) && (
              <div className="mt-4 rounded-lg border border-border p-4">
                <h3 className="mb-3 text-sm font-medium">
                  {editingUser ? `Edit: ${editingUser.fullName}` : 'Add New User'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {!editingUser && (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground">Full Name *</label>
                        <input
                          value={userForm.fullName}
                          onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Email *</label>
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          placeholder="john@veck.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Password *</label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          placeholder="Min 8 characters"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground">Role *</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="admin">Admin</option>
                      <option value="marketing_manager">Marketing Manager</option>
                      <option value="marketing_executive">Marketing Executive</option>
                      <option value="sales_manager">Sales Manager</option>
                      <option value="sales_executive">Sales Executive</option>
                      <option value="purchase">Purchase / Quotation</option>
                      <option value="sales_purchase">Sales / Purchase (dual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Department</label>
                    <select
                      value={userForm.department}
                      onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                      className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Designation</label>
                    <select
                      value={userForm.designation}
                      onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                      className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                    >
                      <option value="">Select designation</option>
                      {DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      if (editingUser) {
                        updateUser()
                      } else {
                        createUser()
                      }
                    }}
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingUser(null)
                      setShowUserForm(false)
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
                {!editingUser && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    The user will be able to log in immediately with the email and password you provide.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  )
}
