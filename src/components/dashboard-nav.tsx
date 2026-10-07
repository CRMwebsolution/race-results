import Link from 'next/link';
import {ThemeToggle} from './theme-toggle';
export function DashboardNav(){return <nav aria-label="Account navigation" className="px-4 py-3 flex flex-wrap items-center gap-4 border-b border-slate-800 bg-slate-950 print:hidden"><Link href="/dashboard">Dashboard</Link><Link href="/dashboard/settings">Account settings</Link><Link href="/">Spectator home</Link><div className="ml-auto"><ThemeToggle/></div></nav>;}
