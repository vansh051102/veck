export default function TemplateInsightsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight">Template Insights</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Usage stats for message templates will appear here once sending is connected.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No template activity yet.
      </div>
    </div>
  )
}
