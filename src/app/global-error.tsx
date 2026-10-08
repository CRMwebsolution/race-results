'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application layout error caught:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Application Error</h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              A critical error occurred while rendering the application shell. Please reload to restore service.
            </p>
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 shadow"
          >
            <RefreshCw className="w-4 h-4" /> Reload RaceHoller
          </button>
        </div>
      </body>
    </html>
  );
}
