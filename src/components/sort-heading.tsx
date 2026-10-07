'use client';
import type {ReactNode} from 'react';
export function SortHeading<T extends string>({label,value,order,reverse,onOrder,onReverse,className='px-4 py-3 text-left'}:{label:ReactNode;value:T;order:T;reverse:boolean;onOrder:(v:T)=>void;onReverse:(v:boolean)=>void;className?:string}){
 const active=order===value;
 return <th scope="col" aria-sort={active?(reverse?'descending':'ascending'):'none'} className={className}><button type="button" className="inline-flex items-center gap-2 font-inherit text-inherit" onClick={()=>{if(active)onReverse(!reverse);else{onOrder(value);onReverse(false);}}}>{label}<span aria-hidden="true">{active?(reverse?'▼':'▲'):'↕'}</span></button></th>;
}
