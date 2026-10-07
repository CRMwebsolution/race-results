'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export function ThemeToggle(){
 const [day,setDay]=useState(false);
 useEffect(()=>{const read=()=>setDay(document.documentElement.dataset.theme==='day');read();window.addEventListener('raceholler:theme',read);return()=>window.removeEventListener('raceholler:theme',read);},[]);
 function change(){const next=!day;document.documentElement.dataset.theme=next?'day':'night';document.documentElement.classList.toggle('dark',!next);setDay(next);try{localStorage.setItem('raceholler:theme',next?'day':'night');}catch{/* Theme remains usable without storage. */}window.dispatchEvent(new Event('raceholler:theme'));}
 return <button type="button" onClick={change} aria-label={`Switch to ${day?'Night':'Day'} mode`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold whitespace-nowrap">{day?<Moon size={18}/>:<Sun size={18}/>}<span>{day?'Night mode':'Day mode'}</span></button>;
}
