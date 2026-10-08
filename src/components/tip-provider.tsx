"use client";

import {createContext, useContext, useState} from "react";
import {HelpCircle, X} from "lucide-react";

const TipContext = createContext<{showTips: boolean}>({showTips: true});

export function TipProvider({children, showTips}: {children: React.ReactNode, showTips: boolean}) {
  return <TipContext.Provider value={{showTips}}>{children}</TipContext.Provider>;
}

export function TipBubble({children, className}: {children: React.ReactNode, className?: string}) {
  const {showTips} = useContext(TipContext);
  const [dismissed, setDismissed] = useState(false);

  if (!showTips || dismissed) return null;

  return (
    <div className={`relative bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-200/90 text-sm flex items-start gap-3 ${className ?? ""}`}>
      <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 pr-6 leading-relaxed">
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
