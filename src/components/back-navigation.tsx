'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';

/** Return to an existing parent page, including when a page is opened directly. */
function parentPage(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (pathname === '/register') return '/login';
  if (pathname === '/offline' || pathname === '/admin') return '/dashboard';
  if (parts[0] === 'dashboard') {
    if (parts.length <= 3) return parts.length === 1 ? '/' : '/dashboard';
    const owner = parts.slice(0, 3).join('/');
    if (parts[3] === 'events') {
      if (parts.length <= 5) return parts[1] === 'series' ? `/${owner}/schedule` : `/${owner}`;
      if (parts[5] === 'classes') return `/${parts.slice(0, 5).join('/')}`;
    }
  }
  if ((parts[0] === 'r' || parts[0] === 's') && parts.length <= 2) return '/';
  if (parts[0] === 's' && parts[2] === 'races') return `/${parts.slice(0, 2).join('/')}`;
  return parts.length > 1 ? `/${parts.slice(0, -1).join('/')}` : '/';
}

export function BackNavigation() {
  const pathname = usePathname();
  const destination = parentPage(pathname);
  const style = 'inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800';
  return <nav aria-label="Back navigation" className="px-4 py-2 print:hidden">
    {destination === pathname
      ? <span aria-disabled="true" className={`${style} opacity-50`}><ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back</span>
      : <Link href={destination} className={style}><ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back</Link>}
  </nav>;
}
