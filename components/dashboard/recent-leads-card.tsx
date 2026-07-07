import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LeadSummary } from './types'

export function RecentLeadsCard({ leads }: { leads: LeadSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Leads</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
        {leads.map((lead) => (
          <Link
            key={lead.id}
            href={`/leads/${lead.id}`}
            className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="font-medium">{lead.companyName}</span>
            <Badge variant="primary">{lead.stage}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
