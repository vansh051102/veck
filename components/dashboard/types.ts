export interface DashboardStats {
  total: number
  open: number
  hot: number
  wonThisMonth: number
  slaBreached: number
  byStage: Record<string, number>
  // Marketing-only
  contactedCount?: number
  qualifiedCount?: number
  newLeadCount?: number
  // Sales-only
  activitiesThisWeek?: number
  dealAgingBuckets?: { '0-7d': number; '8-30d': number; '30d+': number }
  // Purchase-only
  avgQualifiedToQuoteSentHours?: number | null
  // Admin-only
  recentQuoteSents?: {
    id: string
    companyName: string
    quotationNumber: string | null
    quotationValue: number | null
    supplierMargin: number | null
    productCategory: string | null
    stageChangedAt: string | null
    assignedTo: { fullName: string } | null
  }[]
}

export interface LeadSummary {
  id: string
  companyName: string
  stage: string
  priority: string
  createdAt: string
  contact: { firstName: string; lastName: string } | null
}
