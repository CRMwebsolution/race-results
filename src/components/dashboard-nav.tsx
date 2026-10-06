import Link from 'next/link';
export function DashboardNav(){return <nav aria-label="Account navigation" className="px-4 py-3 flex flex-wrap gap-4 border-b border-slate-800 bg-slate-950"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/settings">Account settings</Link><Link href="/">Spectator home</Link></nav>;}
