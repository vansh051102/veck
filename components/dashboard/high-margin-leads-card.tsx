'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface HighMarginLead {
  id: string
  companyName: string
  supplierMargin: number | null
  assignedTo: { fullName: string } | null
}

export function HighMarginLeadsCard({ leads }: { leads: HighMarginLead[] }) {
  if (!leads || leads.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Highest margin leads</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{lead.companyName}</span>
                <span className="text-xs text-muted-foreground">{lead.assignedTo?.fullName ?? 'Unassigned'}</span>
              </div>
              <span className="font-medium">{lead.supplierMargin ?? 0}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
