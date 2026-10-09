'use client';

import {useId,useRef,useState} from 'react';
import {QrCode,X} from 'lucide-react';
import QRCode from 'qrcode';

export function SpectatorQR({path,eventName,className}: {path: string; eventName: string; className?: string}) {
  const dialog=useRef<HTMLDialogElement>(null), titleId=useId();
  const [url,setUrl]=useState(''), [image,setImage]=useState(''), [error,setError]=useState('');
  async function open() {
    const targetUrl = new URL(path, window.location.origin);
    const parts = targetUrl.pathname.split('/');
    const slug = parts.length > 2 ? parts[2] : 'raceholler';
    targetUrl.searchParams.set('utm_source', slug);
    targetUrl.searchParams.set('utm_medium', 'qr');
    targetUrl.searchParams.set('utm_campaign', 'spectator');
    const target = targetUrl.href;
    setUrl(target);setImage('');setError('');dialog.current?.showModal();
    try {setImage(await QRCode.toDataURL(target,{width:512,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}}));}
    catch {setError('The QR code could not be created. Close this window and try again.');}
  }
  function print() {
    const page=window.open('','_blank','width=700,height=800');
    if(!page){setError('Allow pop-ups to print the QR code. You can also download it.');return;}
    page.opener=null;page.document.title=`${eventName} · Spectator QR`;
    page.document.body.style.cssText='font-family:Arial,sans-serif;text-align:center;padding:32px;color:#000;background:#fff';
    const heading=page.document.createElement('h1');heading.textContent=eventName;
    const description=page.document.createElement('p');description.textContent='Scan for race results';
    const qr=page.document.createElement('img');qr.alt='QR code for the spectator race page';qr.style.cssText='width:100%;max-width:450px;height:auto';
    const address=page.document.createElement('p');address.textContent=url;address.style.overflowWrap='anywhere';
    qr.onload=()=>{page.focus();page.print();};
    page.document.body.append(heading,description,qr,address);qr.src=image;
  }
  const button='p-3 border border-slate-700 rounded-lg font-semibold';
  return <>
    <button type="button" onClick={()=>void open()} className={`${className||button} inline-flex items-center gap-2`}><QrCode aria-hidden="true" className="h-5 w-5"/>Spectator QR</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-5 bg-slate-900 text-white border border-slate-700 backdrop:bg-black/70">
      <div className="flex items-start justify-between gap-3"><div><h2 id={titleId} className="text-xl font-bold">Spectator QR code</h2><p className="mt-1 text-sm text-slate-400">{eventName}</p></div><button type="button" aria-label="Close QR code" onClick={()=>dialog.current?.close()} className="p-3 rounded-lg border border-slate-700"><X aria-hidden="true" className="h-5 w-5"/></button></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="my-4">{image?<img src={image} alt={`Scan to view ${eventName} results`} width={512} height={512} className="w-full h-auto rounded-lg"/>:<p role="status">{error?'':'Creating QR code…'}</p>}</div>
      {error&&<p role="alert" className="mb-3 text-red-300">{error}</p>}
      <label className="block text-sm font-semibold">Spectator link<input readOnly value={url} onFocus={e=>e.currentTarget.select()} className="block w-full my-2 p-3 rounded-lg border border-slate-700 bg-slate-950 text-white"/></label>
      <div className="flex flex-wrap gap-2 mt-4"><a href={url} target="_blank" rel="noopener noreferrer" className={button}>Open spectator view</a>{image&&<><a href={image} download="race-spectator-qr.png" className={button}>Download QR</a><button type="button" onClick={print} className={button}>Print QR</button></>}</div>
    </dialog>
  </>;
}

