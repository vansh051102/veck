'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import { Modal } from '@/components/ui/modal'

interface Member {
  id: string
  email: string
  fullName: string
  phone?: string | null
  role: string
  department: string | null
  territory?: string | null
  status: string
  reportsToId?: string | null
}

interface Role {
  id: string
  name: string
}

function roleLabel(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function MembersPage() {
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [manageFor, setManageFor] = useState<Member | null>(null)
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    phone: '',
    password: '',
    role: 'sales_executive',
  })

  function load() {
    api
      .get<Member[]>('/users')
      .then((res) => setMembers(res.data ?? []))
      .catch((err) => toast(toFormErrors(err, 'Failed to load members').message, 'error'))
    api.get<Role[]>('/roles').then((res) => setRoles(res.data ?? []))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (!q.trim()) return true
      const s = q.toLowerCase()
      return (
        m.fullName.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s) ||
        (m.phone ?? '').includes(s)
      )
    })
  }, [members, q, roleFilter])

  async function addMember() {
    try {
      await api.post('/users', {
        ...form,
        phone: form.phone || null,
        department:
          form.role.includes('marketing')
            ? 'Marketing'
            : form.role.includes('purchase')
              ? 'Purchase'
              : form.role.includes('sales')
                ? 'Sales'
                : null,
      })
      toast('Member added')
      setShowAdd(false)
      setForm({ email: '', fullName: '', phone: '', password: '', role: 'sales_executive' })
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to add member').message, 'error')
    }
  }

  async function removeMember(id: string) {
    try {
      await api.delete(`/users/${id}`)
      toast('Member deactivated')
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to remove').message, 'error')
    }
  }

  function openManage(m: Member) {
    setManageFor(m)
    setSelectedReports(members.filter((x) => x.reportsToId === m.id).map((x) => x.id))
  }

  async function saveTeam() {
    if (!manageFor) return
    try {
      // Clear previous reports of this manager that were deselected
      const previous = members.filter((x) => x.reportsToId === manageFor.id)
      for (const p of previous) {
        if (!selectedReports.includes(p.id)) {
          await api.put(`/users/${p.id}`, { reportsToId: null })
        }
      }
      for (const id of selectedReports) {
        const person = members.find((m) => m.id === id)
        if (person?.reportsToId && person.reportsToId !== manageFor.id) {
          toast(`${person.fullName} is already assigned to another team`, 'error')
          continue
        }
        await api.put(`/users/${id}`, { reportsToId: manageFor.id })
      }
      toast('Team saved')
      setManageFor(null)
      load()
    } catch (err) {
      toast(toFormErrors(err, 'Failed to save team').message, 'error')
    }
  }

  function downloadCsvTemplate() {
    const csv = 'fullName,email,phone,role,department\nJane Doe,jane@example.com,+919999999999,sales_executive,Sales\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'veck-members-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add and manage team members in your workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadCsvTemplate}>
            Download CSV template
          </Button>
          <Button onClick={() => setShowAdd(true)}>+ Add team member</Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          placeholder="Search team members"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 w-64 rounded-md border border-border px-3 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-md border border-border px-3 text-sm"
        >
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {roleLabel(r.name)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Full name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 font-medium">{m.fullName}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {roleLabel(m.role)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{m.phone || '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{m.email}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{m.territory || 'India'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-accent hover:underline"
                      onClick={() => openManage(m)}
                    >
                      Manage Team
                    </button>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => removeMember(m.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add team member">
        <div className="space-y-3">
          {(['fullName', 'email', 'phone', 'password'] as const).map((k) => (
            <input
              key={k}
              type={k === 'password' ? 'password' : 'text'}
              placeholder={k}
              className="h-9 w-full rounded-md border border-border px-3 text-sm"
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <select
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.name}>
                {roleLabel(r.name)}
              </option>
            ))}
          </select>
          <Button onClick={addMember}>Add member</Button>
        </div>
      </Modal>

      <Modal
        open={!!manageFor}
        onClose={() => setManageFor(null)}
        title={manageFor ? `Manage Team — ${manageFor.fullName}` : ''}
      >
        {manageFor && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Assign eligible direct reports for <strong>{manageFor.fullName}</strong>.
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {members
                .filter((m) => m.id !== manageFor.id)
                .map((m) => {
                  const elsewhere = Boolean(m.reportsToId && m.reportsToId !== manageFor.id)
                  const checked = selectedReports.includes(m.id)
                  return (
                    <li key={m.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={elsewhere && !checked}
                        checked={checked}
                        onChange={(e) => {
                          setSelectedReports((prev) =>
                            e.target.checked
                              ? [...prev, m.id]
                              : prev.filter((id) => id !== m.id)
                          )
                        }}
                      />
                      <div>
                        <p className="font-medium">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel(m.role)} · {m.email}
                        </p>
                        {elsewhere && (
                          <p className="text-xs text-destructive">Already assigned to another team.</p>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
            <Button onClick={saveTeam}>Save team</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
