'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface QuoteSentLead {
  id: string
  companyName: string
  quotationNumber: string | null
  quotationValue: number | null
  supplierMargin: number | null
  productCategory: string | null
  stageChangedAt: string | null
  assignedTo: { fullName: string } | null
}

interface QuotationChangesCardProps {
  leads: QuoteSentLead[]
}

export function QuotationChangesCard({ leads }: QuotationChangesCardProps) {
  if (!leads || leads.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Quotation Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="flex items-start justify-between gap-4 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{lead.companyName}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {lead.quotationNumber && (
                    <Badge variant="outline" className="text-xs">
                      {lead.quotationNumber}
                    </Badge>
                  )}
                  {lead.productCategory && (
                    <Badge variant="secondary" className="text-xs">
                      {lead.productCategory}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                {lead.quotationValue != null && (
                  <span className="text-sm font-medium">
                    ₹{Number(lead.quotationValue).toLocaleString('en-IN')}
                  </span>
                )}
                {lead.supplierMargin != null && (
                  <span className="text-xs text-muted-foreground">
                    {lead.supplierMargin}% margin
                  </span>
                )}
                {lead.assignedTo && (
                  <span className="text-xs text-muted-foreground">
                    {lead.assignedTo.fullName}
                  </span>
                )}
                {lead.stageChangedAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(new Date(lead.stageChangedAt))}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
