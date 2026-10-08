'use client';
import {useEffect,useState} from 'react';
export function InvitationLink({token}:{token:string}) {
 const [url,setUrl]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>setUrl(`${window.location.origin}/invitations/${token}`),[token]);
 async function copy(){try{await navigator.clipboard.writeText(url);setMessage('Invitation link copied.');}catch{setMessage('Select and copy the link below.');}}
 return <div className="space-y-2"><p className="text-sm text-slate-400">Copy the link and send it to the person you are inviting.</p><label className="block">Invitation link<input readOnly value={url} onFocus={e=>e.target.select()} className="block w-full p-3 bg-slate-950 text-white border rounded"/></label><button type="button" disabled={!url} onClick={()=>void copy()} className="p-3 border rounded">Copy link</button>{message&&<p role="status">{message}</p>}</div>;
}
