"use client";

import {useTransition} from "react";
import {toggleTips} from "./actions";

export function TipToggle({initialShowTips}: {initialShowTips: boolean}) {
  const [isPending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        className="sr-only peer" 
        defaultChecked={initialShowTips}
        disabled={isPending}
        onChange={(e) => {
          const checked = e.target.checked;
          startTransition(async () => {
            await toggleTips(checked);
          });
        }}
      />
      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
    </label>
  );
}
