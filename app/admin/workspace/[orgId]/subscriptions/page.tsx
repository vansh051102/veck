'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'

export default function SubscriptionsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    api.get<{ subscriptionPlan: string }>(`/organizations/${orgId}`).then((res) => {
      setPlan(res.data?.subscriptionPlan ?? 'free')
    })
  }, [orgId])

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Subscriptions</h2>
      <p className="mt-1 text-sm text-muted-foreground">Current plan for this workspace.</p>
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Active plan</p>
        <p className="mt-1 text-2xl font-semibold capitalize text-primary">{plan}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Billing provider integration is not connected yet. Contact support to change plans.
        </p>
      </div>
    </div>
  )
}
