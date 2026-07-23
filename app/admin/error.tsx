'use client'

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-xl font-semibold">Unable to load data</h2>
      <p className="text-muted-foreground">{error.message || 'Retrying may help.'}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90">
        Try again
      </button>
    </div>
  )
}
