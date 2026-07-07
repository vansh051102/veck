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
}

export interface LeadSummary {
  id: string
  companyName: string
  stage: string
  priority: string
  createdAt: string
  contact: { firstName: string; lastName: string } | null
}
