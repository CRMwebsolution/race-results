'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export function RaceNav({base,publicPath}:{base:string;publicPath:string}){
 const pathname=usePathname();
 const tabs=[['','Classes & rules'],['entries','Contestants'],['settings','Date & status'],['scoring','Enter results']];
 return <nav aria-label="Race navigation" className="flex flex-wrap gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1 print:hidden">{tabs.map(([path,label])=>{
  const href=`${base}${path?'/'+path:''}`;
  const active=path?pathname===href:pathname===base||pathname.startsWith(base+'/classes/');
  return <Link key={path} href={href} aria-current={active?'page':undefined} className={`rounded-lg px-4 py-3 text-sm font-semibold border-b-4 transition ${active?'bg-amber-500 text-slate-950 border-amber-600':'text-slate-300 border-transparent hover:bg-slate-800'}`}>{label}</Link>;
 })}<Link href={publicPath} className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-300 border-b-4 border-transparent hover:bg-slate-800">View results</Link></nav>;
}
