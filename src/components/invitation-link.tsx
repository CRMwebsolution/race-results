'use client';
import {useEffect,useState} from 'react';
export function InvitationLink({token,email}:{token:string;email:string}) {
 const [url,setUrl]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>setUrl(`${window.location.origin}/invitations/${token}`),[token]);
 async function copy(){try{await navigator.clipboard.writeText(url);setMessage('Invitation link copied.');}catch{setMessage('Select and copy the link below.');}}
 return <div className="space-y-2"><label className="block">Invitation link<input readOnly value={url} onFocus={e=>e.target.select()} className="block w-full p-3 bg-slate-950 text-white border rounded"/></label><div className="flex flex-wrap gap-3"><button type="button" disabled={!url} onClick={()=>void copy()} className="p-3 border rounded">Copy link</button><a className="p-3 border rounded" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('RaceHoller race staff invitation')}&body=${encodeURIComponent(`You are invited to help with a race on RaceHoller. Sign in or create an account using ${email}, then accept this invitation: ${url}\nThis link expires after seven days.`)}`}>Open email draft</a></div>{message&&<p role="status">{message}</p>}</div>;
}
