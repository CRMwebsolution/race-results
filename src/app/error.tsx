'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors for monitoring
    console.error('Root application error boundary caught:', error);
  }, [error]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-4 sm:p-8" role="alert">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">Something went wrong</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            An unexpected error occurred while loading this page. If you were scoring a race, your offline records stored on this device remain safe.
          </p>
        </div>

        {error.digest && (
          <p className="font-mono text-[11px] text-slate-500 bg-slate-950 p-2 rounded-lg truncate">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
          <Link
            href="/"
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <Home className="w-3.5 h-3.5" /> Return Home
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 pt-2">
          Need assistance? Contact our team at{' '}
          <a href="mailto:support@raceholler.com" className="text-amber-400 underline hover:text-amber-300">
            support@raceholler.com
          </a>
        </p>
      </div>
    </main>
  );
}
