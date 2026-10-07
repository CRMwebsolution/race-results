'use client';
import {useFormStatus} from 'react-dom';
function SaveStatus(){const {pending}=useFormStatus();return <button disabled={pending} className="w-full bg-blue-600 text-white font-bold px-4 py-3 rounded">{pending?'Saving…':'Update status'}</button>;}
export function RaceStatusForm({status,revision,action}:{status:string;revision:number;action:(f:FormData)=>Promise<void>}){
 return <form action={action} className="grid gap-3 sm:grid-cols-2 items-center"><input type="hidden" name="revision" value={revision}/><label className="block">Race status<select name="status" defaultValue={status} className="block w-full min-w-0 bg-slate-950 border rounded p-3">{status==='completed'&&<option value="completed" disabled>Completed — choose a status to reopen</option>}<option value="draft">Draft (hidden)</option><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="cancelled">Cancelled</option></select></label><SaveStatus/></form>;
}
