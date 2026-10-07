'use client';
import {useEffect,useState} from 'react';
export function TodayDate({name,label,defaultValue,min,className='block w-full min-w-0 p-3 bg-slate-900 border rounded'}:{name:string;label:string;defaultValue?:string;min?:string;className?:string}){
 const [value,setValue]=useState(defaultValue??'');
 useEffect(()=>{if(defaultValue!==undefined)return;const d=new Date();setValue(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);},[defaultValue]);
 return <label className="block min-w-0">{label}<input type="date" name={name} required min={min} value={value} onChange={e=>setValue(e.target.value)} className={className}/></label>;
}
