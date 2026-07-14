'use client'

import { useEffect, useState } from 'react'
import { IntegrationCard } from '@/components/admin/integration-card'
import { api } from '@/lib/api-client'

interface IntegrationsResponse {
  indiamart: { configured: boolean; webhookSecret: string | null }
  tradeindia: { configured: boolean; webhookSecret: string | null }
  whatsapp: { configured: boolean; verifyToken: string | null; appSecret: string | null; phoneNumberId: string | null }
  email: { configured: boolean; webhookSecret: string | null }
  justdial: { configured: boolean; apiKey: string | null }
}

function siteOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await api.get<IntegrationsResponse>('/settings/integrations')
    setData(res.data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const origin = siteOrigin()

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect external lead sources. Paste in the API key/secret from each platform and leads start flowing
        automatically — no deployment config needed.
      </p>
      <ul className="mt-6 space-y-3">
        <IntegrationCard
          provider="indiamart"
          name="IndiaMART"
          desc="Inbound webhook for lead ingestion. Generates a webhook secret for you to paste into IndiaMART's Lead Manager Push API setup."
          configured={data.indiamart.configured}
          fields={[{ key: 'webhookSecret', label: 'Webhook secret (leave blank to auto-generate)', maskedValue: data.indiamart.webhookSecret }]}
          webhookUrl={data.indiamart.configured ? undefined : `${origin}/api/v1/webhooks/indiamart/<secret>`}
          onSaved={load}
        />
        <IntegrationCard
          provider="tradeindia"
          name="TradeIndia"
          desc="Inbound webhook for lead ingestion. Generates a webhook secret for you to paste into TradeIndia's lead push setup."
          configured={data.tradeindia.configured}
          fields={[{ key: 'webhookSecret', label: 'Webhook secret (leave blank to auto-generate)', maskedValue: data.tradeindia.webhookSecret }]}
          webhookUrl={data.tradeindia.configured ? undefined : `${origin}/api/v1/webhooks/tradeindia/<secret>`}
          onSaved={load}
        />
        <IntegrationCard
          provider="whatsapp"
          name="WhatsApp Business"
          desc="Inbound webhook (Meta Cloud API) for lead capture. Paste the App Secret, a Verify Token you choose, and the Phone Number ID from Meta's dashboard."
          configured={data.whatsapp.configured}
          fields={[
            { key: 'verifyToken', label: 'Verify token (any string you choose)', maskedValue: data.whatsapp.verifyToken },
            { key: 'appSecret', label: 'Meta App Secret', maskedValue: data.whatsapp.appSecret },
            { key: 'phoneNumberId', label: 'Phone Number ID', maskedValue: data.whatsapp.phoneNumberId },
          ]}
          webhookUrl={`${origin}/api/v1/webhooks/whatsapp`}
          onSaved={load}
        />
        <IntegrationCard
          provider="email"
          name="Email"
          desc="Inbound webhook via SendGrid Inbound Parse. Generates a webhook secret to set as the Inbound Parse destination URL once your veck.in subdomain is routed to SendGrid."
          configured={data.email.configured}
          fields={[{ key: 'webhookSecret', label: 'Webhook secret (leave blank to auto-generate)', maskedValue: data.email.webhookSecret }]}
          webhookUrl={data.email.configured ? undefined : `${origin}/api/v1/webhooks/email/<secret>`}
          onSaved={load}
        />
        <IntegrationCard
          provider="justdial"
          name="Just Dial"
          desc="Polls the JustDial Lead Manager API every 20 minutes. Paste the API key from your JustDial Lead Manager account."
          configured={data.justdial.configured}
          fields={[{ key: 'apiKey', label: 'JustDial API key', maskedValue: data.justdial.apiKey }]}
          onSaved={load}
        />
      </ul>
    </div>
  )
}
