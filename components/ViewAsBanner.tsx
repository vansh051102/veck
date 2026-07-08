'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'

interface ViewAsUser {
  id: string
  fullName: string
  role: string
}

interface Props {
  viewAsUserId: string
}

export function ViewAsBanner({ viewAsUserId }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<ViewAsUser | null>(null)

  useEffect(() => {
    api
      .get<ViewAsUser>(`/users/${viewAsUserId}`)
      .then((res) => res.data && setUser(res.data))
      .catch(() => null)
  }, [viewAsUserId])

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <span>
        Viewing as{' '}
        <span className="font-semibold">{user ? user.fullName : '…'}</span>
        {user && (
          <span className="ml-1 text-amber-700 dark:text-amber-400">
            ({user.role.replace(/_/g, ' ')})
          </span>
        )}
        {' '}— data is scoped to this user&apos;s role
      </span>
      <button
        onClick={() => router.push('/dashboards/admin')}
        className="ml-4 rounded-md border border-amber-400 px-2.5 py-0.5 text-xs font-medium hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-900"
      >
        Exit
      </button>
    </div>
  )
}
