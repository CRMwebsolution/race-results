"use client";

import {createContext, useContext, useState} from "react";
import {HelpCircle, X} from "lucide-react";

const TipContext = createContext<{showTips: boolean}>({showTips: true});

export function TipProvider({children, showTips}: {children: React.ReactNode, showTips: boolean}) {
  return <TipContext.Provider value={{showTips}}>{children}</TipContext.Provider>;
}

export function TipBubble({
  children,
  className,
  title,
  step,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  step?: number | string;
}) {
  const {showTips} = useContext(TipContext);
  const [dismissed, setDismissed] = useState(false);

  if (!showTips || dismissed) return null;

  return (
    <div className={`relative bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200/90 text-sm flex items-start gap-3 ${className ?? ""}`}>
      <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 pr-6 leading-relaxed">
        {step && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] mb-2 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
            Step {step}
          </span>
        )}
        {title && <strong className="block text-white font-bold text-base mb-1">{title}</strong>}
        {children}
      </div>
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1.5 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function TipHighlight({
  children,
  step,
  label,
  active = true,
  className = "",
  position = "top-right",
}: {
  children: React.ReactNode;
  step?: number | string;
  label?: string;
  active?: boolean;
  className?: string;
  position?: "top-right" | "top-left" | "bottom-right" | "inline";
}) {
  const {showTips} = useContext(TipContext);

  if (!showTips || !active) {
    return <>{children}</>;
  }

  const posClasses = {
    "top-right": "-top-3 -right-2",
    "top-left": "-top-3 -left-2",
    "bottom-right": "-bottom-3 -right-2",
    inline: "relative mt-1",
  }[position];

  return (
    <div className={`relative inline-flex flex-col group/tip-highlight ${className}`}>
      <div className="relative rounded-xl ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.5)] transition duration-300">
        {children}
      </div>
      {(step || label) && (
        <span
          className={`absolute ${posClasses} z-30 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/50 border border-amber-200 whitespace-nowrap animate-bounce`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
          <span>{step ? `Step ${step}` : ""}{step && label ? `: ` : ""}{label}</span>
        </span>
      )}
    </div>
  );
}

export function GuidedStepBadge({
  step,
  label,
  className = "",
}: {
  step: number | string;
  label?: string;
  className?: string;
}) {
  const {showTips} = useContext(TipContext);
  if (!showTips) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 uppercase tracking-wide border border-amber-300 ${className}`}>
      <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
      <span>Step {step}{label ? `: ${label}` : ""}</span>
    </div>
  );
}
