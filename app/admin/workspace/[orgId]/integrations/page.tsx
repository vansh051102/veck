'use client'

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Integrations</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect external lead sources and tools. Configure secrets in your deployment environment.
      </p>
      <ul className="mt-6 space-y-3">
        {[
          {
            name: 'IndiaMART',
            desc: 'Inbound webhook for lead ingestion. Uses INDIAMART_WEBHOOK_SECRET, ORG_ID, and SYSTEM_USER_ID.',
            status: 'Configured via env',
          },
          { name: 'WhatsApp Business', desc: 'Outbound messaging (coming soon).', status: 'Soon' },
          { name: 'TradeIndia', desc: 'Lead webhook (coming soon).', status: 'Soon' },
        ].map((item) => (
          <li key={item.name} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                {item.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
