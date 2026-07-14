'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { toFormErrors } from '@/lib/form-errors'
import { AssignmentRulesModal } from '@/components/assignment-rules-modal'
import { SlaRulesModal } from '@/components/admin/sla-rules-modal'
import { OperatingHoursModal } from '@/components/admin/operating-hours-modal'
import { KraDefinitionsModal } from '@/components/admin/kra-definitions-modal'

interface Settings {
  autoAssignmentEnabled: boolean
  autoAssignmentRule: { rule_type: 'least_open_leads' | 'round_robin' } | null
  emailNotificationsEnabled: boolean
}

export default function LeadSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [showSlaRules, setShowSlaRules] = useState(false)
  const [showCalendars, setShowCalendars] = useState(false)
  const [showKras, setShowKras] = useState(false)

  function load() {
    api
      .get<Settings>('/settings')
      .then((res) => setSettings(res.data ?? null))
      .catch((err) => toast(toFormErrors(err, 'Failed to load').message, 'error'))
  }

  useEffect(() => {
    load()
  }, [])

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
      toast(toFormErrors(err, 'Save failed').message, 'error')
    }
  }

  if (!settings) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Lead Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          SLA, auto-assignment, and routing rules for new leads.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold">Lead assignment</h3>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.autoAssignmentEnabled}
            onChange={(e) => update({ autoAssignmentEnabled: e.target.checked })}
          />
          <span>Auto-assign new leads</span>
        </label>
        {settings.autoAssignmentEnabled && (
          <select
            className="mt-3 h-9 w-full max-w-xs rounded-md border border-border px-3 text-sm"
            value={settings.autoAssignmentRule?.rule_type ?? 'least_open_leads'}
            onChange={(e) =>
              update({
                autoAssignmentRule: {
                  rule_type: e.target.value as 'least_open_leads' | 'round_robin',
                },
              })
            }
          >
            <option value="least_open_leads">Least open leads</option>
            <option value="round_robin">Round-robin</option>
          </select>
        )}
        <div className="mt-4">
          <Button variant="outline" onClick={() => setShowRules(true)}>
            Manage assignment rules
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold">SLA</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Default per-stage SLA hours are configured in{' '}
          <a href="../lead-workflow" className="underline">
            Lead Workflow
          </a>
          . Rules below override that default per department/stage — leave a rule&apos;s target
          blank to collect timing data without enforcing a breach.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowSlaRules(true)}>
            Manage SLA rules
          </Button>
          <Button variant="outline" onClick={() => setShowCalendars(true)}>
            Manage operating hours
          </Button>
          <Button variant="outline" onClick={() => setShowKras(true)}>
            Manage Key Result Areas
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-semibold">Notifications</h3>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={settings.emailNotificationsEnabled}
            onChange={(e) => update({ emailNotificationsEnabled: e.target.checked })}
          />
          <span>Email notifications</span>
        </label>
      </section>

      {showRules && <AssignmentRulesModal onClose={() => setShowRules(false)} />}
      {showSlaRules && <SlaRulesModal onClose={() => setShowSlaRules(false)} />}
      {showCalendars && <OperatingHoursModal onClose={() => setShowCalendars(false)} />}
      {showKras && <KraDefinitionsModal onClose={() => setShowKras(false)} />}
    </div>
  )
}
