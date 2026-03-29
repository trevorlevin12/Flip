'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Building2,
  Settings,
  LogOut,
} from 'lucide-react'
import { getBrowserClient } from '@/lib/db/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/inbox',      label: 'Inbox',      icon: MessageSquare },
  { href: '/leads',      label: 'Leads',      icon: Users },
  { href: '/properties', label: 'Properties', icon: Building2 },
  { href: '/settings',   label: 'Settings',   icon: Settings },
]

export default function DashboardNav({ landlordName }: { landlordName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const db = getBrowserClient()
    await db.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-200">
        <span className="text-xl font-bold text-emerald-600">Flip</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 pb-4 border-t border-gray-200 pt-3">
        <div className="px-3 py-1.5 text-xs text-gray-500 truncate">{landlordName}</div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
