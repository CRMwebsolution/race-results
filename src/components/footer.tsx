'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flag, ShieldCheck } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();

  // Suppress footer on full-screen kiosk pit displays
  if (pathname?.includes('/pit-display')) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/90 text-slate-400 text-xs print:hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Brand & Mission */}
          <div className="space-y-1.5 max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2 text-base font-black text-white hover:text-amber-400 transition">
              <span className="p-1 rounded bg-amber-500 text-slate-950">
                <Flag className="w-3.5 h-3.5" />
              </span>
              <span>Race<span className="text-amber-400">Holler</span></span>
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed">
              Deterministic race scoring, real-time spectator leaderboards, and offline-first track management for modern racing.
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div className="space-y-2">
              <p className="font-bold text-white uppercase text-[11px] tracking-wider">Product</p>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/" className="hover:text-amber-400 transition">Live Results</Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-amber-400 transition">Organizer Portal</Link>
                </li>
                <li>
                  <Link href="/dashboard/billing" className="hover:text-amber-400 transition">Pricing & Plans</Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-white uppercase text-[11px] tracking-wider">Legal & Compliance</p>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/terms" className="hover:text-amber-400 transition">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-amber-400 transition">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/refunds" className="hover:text-amber-400 transition">Refund Policy</Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <p className="font-bold text-white uppercase text-[11px] tracking-wider">Support</p>
              <ul className="space-y-1.5">
                <li>
                  <a href="mailto:support@raceholler.com" className="hover:text-amber-400 transition">support@raceholler.com</a>
                </li>
                <li className="flex items-center gap-1.5 text-slate-500 pt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Stripe Verified</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} RaceHoller. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-slate-300 transition">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-slate-300 transition">Privacy</Link>
            <span>·</span>
            <Link href="/refunds" className="hover:text-slate-300 transition">Refunds</Link>
            <span>·</span>
            <a href="mailto:support@raceholler.com" className="hover:text-slate-300 transition">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

