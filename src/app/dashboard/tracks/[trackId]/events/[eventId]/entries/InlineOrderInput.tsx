"use client";

import { useTransition, useRef } from "react";
import { Loader2 } from "lucide-react";

export function InlineOrderInput({ entryId, defaultOrder, updateAction }: { entryId: string, defaultOrder: number, updateAction: (formData: FormData) => void }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form 
      ref={formRef}
      action={(fd) => {
        startTransition(() => {
          updateAction(fd);
        });
      }} 
      className="flex items-center space-x-2"
    >
      <input type="hidden" name="entry_id" value={entryId} />
      <input 
        type="number" 
        name="order_num" 
        defaultValue={defaultOrder} 
        onBlur={() => {
           if (formRef.current) formRef.current.requestSubmit();
        }}
        className="w-12 bg-slate-950 border border-slate-700 rounded p-1 text-xs text-center text-white focus:border-amber-500 focus:outline-none"
      />
      {isPending && <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />}
    </form>
  );
}
