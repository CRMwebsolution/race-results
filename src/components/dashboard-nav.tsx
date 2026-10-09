import Link from 'next/link';
import {ThemeToggle} from './theme-toggle';

export function DashboardNav(){
  return (
    <nav aria-label="Account navigation" className="px-6 h-14 flex flex-wrap items-center gap-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40 print:hidden text-sm font-medium text-slate-300">
      <Link href="/dashboard" className="text-white font-extrabold tracking-tight text-base hover:text-amber-500 transition mr-2">Race<span className="text-amber-500">Holler</span></Link>
      <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
      <Link href="/dashboard/settings" className="hover:text-white transition">Account</Link>
      <Link href="/dashboard/billing" className="hover:text-white transition">Billing</Link>
      <Link href="/dashboard/help" className="hover:text-white transition">Help</Link>
      <div className="ml-auto flex items-center gap-6">
        <Link href="/" className="text-slate-400 hover:text-white transition">Spectator Home</Link>
        <ThemeToggle/>
      </div>
    </nav>
  );
}
