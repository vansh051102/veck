'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ListChecks, Plus, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { NewLeadForm } from '@/components/new-lead-form'
import { PermissionGate } from '@/components/permission-gate'
import { useCurrentUser } from '@/lib/use-current-user'

// Matches Button's outline+sm variant classes for Link/anchor shortcuts,
// since Button renders a real <button> and can't wrap Link's <a>.
const linkButtonClass =
  'inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted'

export function QuickActionsCard({ showTeamPerformanceLink }: { showTeamPerformanceLink: boolean }) {
  const router = useRouter()
  const me = useCurrentUser()
  const [showNewLead, setShowNewLead] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <PermissionGate permission="leads:create">
          <Button size="sm" onClick={() => setShowNewLead(true)}>
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
        </PermissionGate>

        {me && (
          <Link href={`/leads?assignedToId=${me.id}`} className={linkButtonClass}>
            <ListChecks className="h-4 w-4" />
            My Open Leads
          </Link>
        )}

        <Link href="/leads?slaBreached=true" className={linkButtonClass}>
          <AlertTriangle className="h-4 w-4" />
          SLA Breaches
        </Link>

        {showTeamPerformanceLink && (
          <a href="#team-performance" className={linkButtonClass}>
            <Users className="h-4 w-4" />
            View Team Performance
          </a>
        )}
      </CardContent>

      {showNewLead && (
        <Modal title="New Lead" onClose={() => setShowNewLead(false)}>
          <NewLeadForm
            onCreated={(leadId) => {
              setShowNewLead(false)
              router.push(`/leads/${leadId}`)
            }}
          />
        </Modal>
      )}
    </Card>
  )
}
