'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {scoreClass,rankEntries,buildBracketLadder} from '@/scoring';
import {judgeRoundAttempts,JudgeInput} from '@/scoring/multi-judge';
import {parseAttemptInput} from '@/scoring/parser';
import {sortResults,passCount,ResultOrder} from '@/lib/race-order';
import {Prepared,getPrepared,subscribePrepared,queueAttempt,localAttempts as deviceAttempts,activateAccount,changePrepared} from '@/lib/offline/store';
import {prepareEvent} from '@/lib/offline/prepare';
import {flushPrepared,retryPrepared,resolveConflict} from '@/lib/offline/sync';
import {SortHeading} from '@/components/sort-heading';
import {explainError,ActionFeedback} from '@/components/action-feedback';
import {saveAttempt, setBracketMatchWinner} from './actions';
import {finalizeEventStandings} from '../settings/actions';

export type EventType={id:string;name:string;working_revision:number;status:string};
export type ClassType={id:string;name:string;scoring_type:string;scoring_version?:number;scoring_config:any;order_num:number};
export type EntryType={id:string;event_class_id:string;display_name:string;seed:number|null;order_num:number};
export type AttemptType={id:string;event_class_id:string;entry_id:string;ordinal:number;status:string;elapsed_ms:number|null;distance_mm:number|null;penalty_ms:number;raw_input:string|null;save_version:number};
export type ScoringPacket={accountId?:string;canComplete?:boolean;trackId:string;ownerType?:'track'|'series';trackSlug?:string;eventSlug?:string;event:EventType;classes:ClassType[];initialEntries:EntryType[];initialAttempts:AttemptType[];judgeScores?:JudgeInput[]};

type Props=ScoringPacket&{offlineOnly?:boolean};
export function ScoringWorkspace({accountId,canComplete=false,offlineOnly=false,ownerType='track',trackId,event,classes,initialEntries,initialAttempts,judgeScores=[]}:Props){
 const router=useRouter(),base=`/dashboard/${ownerType==='series'?'series':'tracks'}/${trackId}/events/${event.id}`;
 const [activeClassId,setActiveClassId]=useState(classes[0]?.id||'');
 const [attempts,setAttempts]=useState(initialAttempts),[prepared,setPrepared]=useState<Prepared|null>(null);
 const [drafts,setDrafts]=useState<Record<string,string>>({}),[errors,setErrors]=useState<Record<string,string>>({});
 const [saving,setSaving]=useState<string[]>([]),[completing,setCompleting]=useState(false),[completeError,setCompleteError]=useState('');
 const [overrideWinners,setOverrideWinners]=useState<Record<string,Record<string,string|null>>>({});
 const [connected,setConnected]=useState(true),[order,setOrder]=useState<ResultOrder>('run'),[reverse,setReverse]=useState(false);
 const [frozen,setFrozen]=useState<string[]|null>(null);
 const [tabStop,setTabStop]=useState<string|null>(null);
 const recordRef=useRef<Prepared|null>(null),confirmed=useRef(initialAttempts),revision=useRef(event.working_revision);
 const draftRef=useRef<Record<string,string>>({}),jobs=useRef(new Map<string,Promise<boolean>>());
 const completingRef=useRef(false),storageReady=useRef(false);
 const storageKey=`raceholler:drafts:${accountId??'unknown'}:${trackId}:${event.id}`;
 recordRef.current=prepared;
 function writeDrafts(next:Record<string,string>){draftRef.current=next;setDrafts(next);if(storageReady.current)try{if(Object.keys(next).length)sessionStorage.setItem(storageKey,JSON.stringify(next));else sessionStorage.removeItem(storageKey);}catch{/* Input stays in memory. */}}
 function clearDraft(key:string){const next={...draftRef.current};delete next[key];writeDrafts(next);setErrors(previous=>{const next={...previous};delete next[key];return next;});}
 useEffect(()=>{try{const stored=JSON.parse(sessionStorage.getItem(storageKey)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))writeDrafts({...(Object.fromEntries(Object.entries(stored).filter(([,v])=>typeof v==='string')) as Record<string,string>),...draftRef.current});}catch{/* Use the current draft. */}storageReady.current=true;},[storageKey]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(!recordRef.current&&!jobs.current.size&&event.working_revision>=revision.current){confirmed.current=initialAttempts;revision.current=event.working_revision;setAttempts(initialAttempts);}},[initialAttempts,event.working_revision]);
 useEffect(()=>{if(!classes.some(c=>c.id===activeClassId))setActiveClassId(classes[0]?.id||'');},[classes,activeClassId]);
 useEffect(()=>{
  if(!accountId)return;let mounted=true;try{activateAccount(accountId);}catch{return;}
  async function load(){try{let r=await getPrepared(accountId!,event.id);if(!mounted)return;if(r&&!r.outbox.length&&r.packet.event.working_revision<revision.current){r=await changePrepared(accountId!,event.id,current=>({...current!,packet:{...current!.packet,event:{...current!.packet.event,working_revision:revision.current},initialAttempts:confirmed.current}}));}recordRef.current=r;setPrepared(r);if(r&&(r.outbox.length||r.packet.event.working_revision>=revision.current)){confirmed.current=r.packet.initialAttempts;revision.current=Math.max(revision.current,r.packet.event.working_revision);setAttempts(deviceAttempts(r));}}catch{/* Online saving does not require device storage. */}}
  async function ready(){setConnected(navigator.onLine);await load();if(navigator.onLine&&!offlineOnly&&event.status!=='completed'&&!completingRef.current){try{await prepareEvent(accountId!,event.id);await load();}catch{/* Keep online scoring and retained drafts available. */}}const r=await getPrepared(accountId!,event.id).catch(()=>null);if(r&&!r.closed)await retryPrepared(accountId!,event.id).catch(()=>{});}
  void ready();const unsubscribe=subscribePrepared(()=>void load());const online=()=>void ready(),offline=()=>setConnected(false);window.addEventListener('online',online);window.addEventListener('offline',offline);
  const timer=window.setInterval(()=>{if(recordRef.current?.outbox.some(o=>o.state==='queued'))void flushPrepared(accountId!,event.id).catch(()=>{});},5000);
  return()=>{mounted=false;unsubscribe();window.removeEventListener('online',online);window.removeEventListener('offline',offline);window.clearInterval(timer);};
 },[accountId,event.id,event.status,offlineOnly]);
 const activeClass=classes.find(c=>c.id===activeClassId);
 const classEntries=useMemo(()=>initialEntries.filter(e=>e.event_class_id===activeClassId),[initialEntries,activeClassId]);
 async function handleSetWinner(matchId:string,winnerEntryId:string|null){
  if(!activeClass)return;
  setOverrideWinners(prev=>({
   ...prev,
   [activeClass.id]:{...(prev[activeClass.id]||{}),[matchId]:winnerEntryId}
  }));
  try{
   const res=await setBracketMatchWinner(trackId,event.id,activeClass.id,matchId,winnerEntryId);
   if(!res.success)setCompleteError(res.error||'Failed to update bracket winner');
  }catch(e:any){setCompleteError(e?.message||'Failed to update bracket winner');}
 }
 const bracketLadder=useMemo(()=>{
  if(!activeClass||activeClass.scoring_type!=='head_to_head')return null;
  const classAttempts=attempts.filter(a=>a.event_class_id===activeClass.id).map(a=>({
    id:a.id,entryId:a.entry_id,ordinal:a.ordinal,status:a.status as 'valid'|'dq'|'dnf'|'dns'|'no_time',
    elapsedMs:a.elapsed_ms,distanceMm:a.distance_mm,penaltyMs:a.penalty_ms,rawInput:a.raw_input,
  }));
  const effectiveConfig={
    ...activeClass.scoring_config,
    manualWinners:{
      ...(activeClass.scoring_config?.manualWinners||{}),
      ...(overrideWinners[activeClass.id]||{}),
    }
  };
  return buildBracketLadder(classEntries,classAttempts,effectiveConfig);
 },[activeClass,classEntries,attempts,overrideWinners]);
 const columns=passCount(activeClass?.scoring_config,attempts.filter(a=>a.event_class_id===activeClassId));
 const ranked=useMemo(()=>{
  if(!activeClass)return [];
  const grouped=new Map<string,AttemptType[]>();for(const a of attempts){if(a.event_class_id===activeClass.id)grouped.set(a.entry_id,[...(grouped.get(a.entry_id)||[]),a]);}
  const effectiveConfig=bracketLadder?{...activeClass.scoring_config,bracketScores:bracketLadder.resultsByEntryId}:activeClass.scoring_config;
  return rankEntries(classEntries.map(entry=>{
   const judges=judgeScores.filter(s=>s.entryId===entry.id);
   const values=activeClass.scoring_type==='judged_points'?judgeRoundAttempts(entry.id,judges,activeClass.scoring_config):(grouped.get(entry.id)||[]).map(a=>({id:a.id,entryId:a.entry_id,ordinal:a.ordinal,status:a.status as 'valid'|'dq'|'dnf'|'dns'|'no_time',elapsedMs:a.elapsed_ms,distanceMm:a.distance_mm,penaltyMs:a.penalty_ms,rawInput:a.raw_input}));
   return {entry,entryId:entry.id,seed:entry.seed,orderNum:entry.order_num,attempts:values,score:scoreClass(activeClass.scoring_type,values,effectiveConfig,activeClass.scoring_version,judges)};
  }));
 },[activeClass,attempts,classEntries,judgeScores,bracketLadder]);
 const sorted=sortResults(ranked,order,reverse),rows=frozen?[...sorted].sort((a,b)=>frozen.indexOf(a.entryId)-frozen.indexOf(b.entryId)):sorted;
 const [tabEntry,tabPass]=(tabStop||'').split(':');
 const gridTabStop=rows.some(row=>row.entryId===tabEntry)&&Number(tabPass)>0&&Number(tabPass)<=columns
   ? tabStop : rows[0]?`${rows[0].entryId}:1`:null;
 function handleScoreKeyDown(e:KeyboardEvent<HTMLInputElement>){
  if(e.key==='Enter'){e.currentTarget.blur();return;}
  if(e.key!=='Tab'||e.altKey||e.ctrlKey||e.metaKey)return;
  const table=e.currentTarget.closest('table');
  if(!table)return;
  // DOM row order follows the selected sort and stays frozen while entering scores.
  const fields=Array.from(table.querySelectorAll<HTMLInputElement>('input[data-score-pass]:not(:disabled)'))
    .sort((a,b)=>Number(a.dataset.scorePass)-Number(b.dataset.scorePass));
  const index=fields.indexOf(e.currentTarget);
  if(index<0)return;
  const next=fields[index+(e.shiftKey?-1:1)];
  if(next){e.preventDefault();next.focus();next.select();}
  // Only the current cell is a native Tab stop, so boundaries leave the grid.
 }
 function saveInput(entryId:string,ordinal:number,raw:string):Promise<boolean>{
  const key=`${entryId}:${ordinal}`,running=jobs.current.get(key);if(running)return running;
  const task=(async()=>{
   try{
    const entry=initialEntries.find(e=>e.id===entryId);if(!entry)throw new Error('This contestant is no longer in this race.');
    const previous=confirmed.current.find(a=>a.entry_id===entryId&&a.ordinal===ordinal),parsed=parseAttemptInput(raw,previous?.penalty_ms??0);if(parsed.error)throw new Error(parsed.error);
    const cached=recordRef.current;
    if(accountId&&cached&&!cached.closed&&!cached.closing){const r=await queueAttempt(accountId,event.id,entry.event_class_id,entryId,ordinal,raw,parsed.penaltyMs);recordRef.current=r;setPrepared(r);setAttempts(deviceAttempts(r));clearDraft(key);void flushPrepared(accountId,event.id).catch(()=>{});return true;}
    if(offlineOnly||!navigator.onLine)throw new Error('Reconnect to save this score. Your input is kept on this page.');
    const result=await saveAttempt(trackId,event.id,entry.event_class_id,entryId,ordinal,raw,parsed.penaltyMs,previous?.save_version??0);if(!result.success)throw new Error(result.error);
    confirmed.current=[...confirmed.current.filter(a=>!(a.entry_id===entryId&&a.ordinal===ordinal)),result.attempt];revision.current=Math.max(revision.current,result.working_revision);setAttempts(confirmed.current);clearDraft(key);return true;
   }catch(e){setErrors(previous=>({...previous,[key]:explainError((e as Error).message)}));return false;}
  })();
  jobs.current.set(key,task);setSaving([...jobs.current.keys()]);void task.finally(()=>{jobs.current.delete(key);setSaving([...jobs.current.keys()]);});return task;
 }
 async function complete(){
  if(completingRef.current||!canComplete)return;
  if(!confirm('Complete this race and publish the final results? Make sure all scorekeepers have saved their results.'))return;
  completingRef.current=true;setCompleting(true);setCompleteError('');
  try{
   const pending=await Promise.all([...jobs.current.values()]);if(pending.some(ok=>!ok))throw new Error('Correct the highlighted scores before completing the race.');
   for(const [key,raw] of Object.entries(draftRef.current)){const [entry,pass]=key.split(':');if(!await saveInput(entry,Number(pass),raw))throw new Error('Correct the highlighted scores before completing the race.');}
   if(!navigator.onLine)throw new Error('Your scores are kept on this device. Reconnect to complete the race.');
   if(accountId){
    const deadline=Date.now()+15000;
    for(;;){
     const r=await getPrepared(accountId,event.id).catch(()=>null);if(!r||!r.outbox.length)break;
     if(r.outbox.some(o=>o.state==='conflict'))throw new Error('Choose which score to keep before completing the race.');
     await retryPrepared(accountId,event.id);
     const next=await getPrepared(accountId,event.id);if(!next?.outbox.length)break;
     if(Date.now()>deadline)throw new Error('Some scores are still waiting to save. Reconnect and try again.');
     await new Promise(resolve=>setTimeout(resolve,250));
    }
   }
   const result=await finalizeEventStandings(event.id,true);if(result.error)throw new Error(explainError(result.error));
   if(accountId)await changePrepared(accountId,event.id,r=>({...r!,closed:true,closing:false,packet:{...r!.packet,event:{...r!.packet.event,status:'completed'}}})).catch(()=>{});
   router.replace(`${base}/scoring?message=${encodeURIComponent('Race completed — results saved.')}`);router.refresh();
  }catch(e){setCompleteError((e as Error).message);}finally{completingRef.current=false;setCompleting(false);}
 }
 const pending=prepared?.outbox.length||0;
 const status=saving.length?'Saving…':pending?connected?'Saving…':'Saved on this device — waiting for signal':Object.keys(errors).length?'Some scores need attention':Object.keys(drafts).length?'Editing — not saved yet':connected?'Saved':'Saved on this device';
 return <div data-offline-ready={prepared&&!prepared.closed?"true":"false"} className="w-full min-w-0 space-y-3">
  <nav aria-label="Scoring actions" className="flex flex-wrap items-center gap-3 p-4 bg-slate-900 border-b">
   <div className="flex flex-wrap gap-2 flex-1">{classes.map(c=><button key={c.id} disabled={completing} aria-pressed={activeClassId===c.id} onClick={()=>{setActiveClassId(c.id);setFrozen(null);}} className={`p-3 rounded-lg font-semibold ${activeClassId===c.id?'bg-amber-500 text-slate-950':'border border-slate-700 bg-slate-950'}`}>{c.name}</button>)}</div>
   <Link href={`${base}/entries?class=${activeClassId}`} className="p-3 border rounded-lg">Add contestant</Link>
   {canComplete&&<button onClick={()=>void complete()} onMouseDown={e=>e.preventDefault()} disabled={completing} className="p-3 rounded-lg bg-emerald-600 text-white font-bold">{completing?'Saving and completing…':'Complete race'}</button>}
   <p role="status" className="w-full text-sm text-slate-400">{status}</p>
  </nav>
  <div className="px-4"><ActionFeedback error={completeError}/></div>
  {prepared?.outbox.filter((o,i,a)=>(o.state!=='queued'||o.error)&&a.findIndex(x=>x.entryId===o.entryId&&x.ordinal===o.ordinal)===i).map(o=><div key={o.id} role="alert" className="mx-4 p-3 border rounded space-y-2"><p>{initialEntries.find(e=>e.id===o.entryId)?.display_name}, pass {o.ordinal}: {o.state==='conflict'?'Another scorekeeper changed this result. Choose which score to keep.':`This score is saved on your device. ${explainError(o.error||'Reconnect and try saving again.')}`} Your entry: {o.raw}</p>{o.state==='conflict'?<div className="flex flex-wrap gap-3"><button className="p-3 border rounded" onClick={()=>accountId&&void resolveConflict(accountId,event.id,o.entryId,o.ordinal,false).catch(e=>setCompleteError(explainError(e.message)))}>Keep the other saved score</button><button className="p-3 border rounded" onClick={()=>accountId&&void resolveConflict(accountId,event.id,o.entryId,o.ordinal,true).catch(e=>setCompleteError(explainError(e.message)))}>Keep my score</button></div>:<button className="p-3 border rounded" onClick={()=>accountId&&void retryPrepared(accountId,event.id).catch(()=>{})}>Try saving again</button>}</div>)}
  {Object.keys(errors).length>0&&<p role="alert" className="p-4 text-red-400">{[...new Set(Object.values(errors))].join(' ')} Your entries are kept.</p>}
  {activeClass?.scoring_type==='judged_points'&&<Link href={`${base}/judging`} className="inline-block p-4 text-amber-400 underline">Enter scores for this judged class</Link>}
  {activeClass?.scoring_type==='head_to_head'&&bracketLadder&&(
   <div className="mx-4 p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div>
      <h3 className="font-bold text-amber-400 text-base">🏁 Bracket Pairings ({bracketLadder.bracketSize}-Car Field{bracketLadder.hasLosersBracket?' · Double Elimination':''})</h3>
      <p className="text-xs text-slate-400">
       {bracketLadder.winCriterion==='first_to_finish'
         ? '⚡ Rule: First to Finish Line — Times always recorded & displayed. Click racer to set 1st across line.'
         : '⚡ Rule: Fastest Elapsed Time — Lower ET advances automatically (Click racer to manually override winner).'}
      </p>
     </div>
     {bracketLadder.championId&&<span className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider">🏆 Winner: {bracketLadder.resultsByEntryId[bracketLadder.championId]?.displayName}</span>}
    </div>

    {/* Winners Rounds / Main Ladder */}
    <div className="space-y-2">
     {bracketLadder.hasLosersBracket&&<h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">Winners Bracket</h4>}
     <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {(bracketLadder.winnersRounds||bracketLadder.rounds).map(r=><div key={r.round} className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2">
       <p className="font-bold text-xs text-slate-400 uppercase tracking-wider">{r.roundName} (Pass {r.round})</p>
       {r.matchups.map(m=><MatchupBox key={m.id} match={m} onSelectWinner={handleSetWinner}/>)}
      </div>)}
     </div>
    </div>

    {/* Grand Finals if Double Elimination */}
    {bracketLadder.grandFinal&&(
     <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg space-y-2 max-w-lg">
      <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Grand Finals (Winners Champ vs Losers Champ)</h4>
      <MatchupBox match={bracketLadder.grandFinal} onSelectWinner={handleSetWinner}/>
     </div>
    )}

    {/* Losers Rounds if Double Elimination */}
    {bracketLadder.losersRounds&&bracketLadder.losersRounds.length>0&&(
     <div className="space-y-2 pt-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Losers Bracket (Consolation Ladder)</h4>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
       {bracketLadder.losersRounds.map(r=><div key={r.round} className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-2">
        <p className="font-bold text-xs text-cyan-500 uppercase tracking-wider">{r.roundName}</p>
        {r.matchups.map(m=><MatchupBox key={m.id} match={m} onSelectWinner={handleSetWinner}/>)}
       </div>)}
      </div>
     </div>
    )}
   </div>
  )}
  <div className="overflow-x-auto p-4 min-w-0">
   <p id="score-entry-help" className="mb-3 text-sm text-slate-400">Tab moves down each pass column, then to the next pass. Shift+Tab moves back.{activeClass?.scoring_type==='fastest_pass'&&' Enter seconds (9.082 s) for a completed run or distance (108.5 ft / 108 ft 6 in) for an incomplete run. Every completed run beats every incomplete run.'} Use - for no pass.</p>
   <table aria-label={`${activeClass?.name||'Class'} scores`} className="w-full min-w-[640px] text-left bg-slate-900 rounded-lg" onFocusCapture={e=>{if(e.target instanceof HTMLInputElement)setFrozen(rows.map(r=>r.entryId));}} onBlurCapture={e=>{if(!(e.relatedTarget instanceof HTMLInputElement)||!e.currentTarget.contains(e.relatedTarget))setFrozen(null);}}>
    <thead className="bg-slate-800"><tr><SortHeading<ResultOrder> label="Rank" value="rank" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/><SortHeading<ResultOrder> label="Order" value="run" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/><SortHeading<ResultOrder> label="Racer" value="name" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>{Array.from({length:columns},(_,i)=><SortHeading<ResultOrder> key={i} label={`Pass ${i+1}`} value={`pass:${i+1}`} order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>)}<th scope="col" className="p-3">Result</th></tr></thead>
    <tbody>{rows.map(row=><tr data-testid="scoring-row" data-entry-id={row.entryId} key={row.entryId} className="border-t border-slate-700"><td className="p-3">{row.rank===null?'—':`${row.tied?'T':''}${row.rank}`}</td><td className="p-3">{row.orderNum}</td><td className="p-3 font-semibold">{row.entry.display_name}</td>{Array.from({length:columns},(_,i)=>{const ordinal=i+1,key=`${row.entryId}:${ordinal}`,attempt=row.attempts.find(a=>a.ordinal===ordinal);return <td key={ordinal} className="p-2"><input type="text" data-score-pass={ordinal} tabIndex={key===gridTabStop?0:-1} onFocus={()=>setTabStop(key)} aria-describedby="score-entry-help" aria-label={`${row.entry.display_name}, pass ${ordinal}`} aria-invalid={Boolean(errors[key])} title={errors[key]} value={drafts[key]??attempt?.rawInput??''} onChange={e=>{const next={...draftRef.current};if(e.target.value===(attempt?.rawInput??''))delete next[key];else next[key]=e.target.value;writeDrafts(next);setErrors(previous=>{const next={...previous};delete next[key];return next;});}} onBlur={e=>{if(e.target.value!==(attempt?.rawInput??''))void saveInput(row.entryId,ordinal,e.target.value);}} onKeyDown={handleScoreKeyDown} disabled={completing||saving.includes(key)||event.status==='completed'||activeClass?.scoring_type==='judged_points'} placeholder="-" className={`w-full min-w-[96px] p-3 rounded border bg-slate-950 text-white font-mono ${errors[key]?'border-red-500':'border-slate-700'}`}/></td>;})}<td className="p-3 whitespace-nowrap font-mono">{row.score.label||'No score'}</td></tr>)}{!rows.length&&<tr><td colSpan={columns+4} className="p-6">No contestants in this class yet. Use Add contestant above.</td></tr>}</tbody>
   </table>
  </div>
 </div>;
}


function MatchupBox({match,onSelectWinner}:{match:import('@/scoring/bracket').BracketMatchup;onSelectWinner:(matchId:string,winnerId:string|null)=>void}){
 const isManual=Boolean(match.isManual);
 return <div className="p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono space-y-1.5">
  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1">
   <span className="font-bold">{match.id}</span>
   {isManual&&<button type="button" onClick={()=>onSelectWinner(match.id,null)} className="text-[10px] text-red-400 hover:underline">Reset Auto</button>}
  </div>
  {[match.racer1,match.racer2].map((racer,idx)=>{
   if(!racer) return <div key={idx} className="text-slate-600 italic py-0.5">TBD</div>;
   const isWinner=match.winnerId===racer.entryId;
   return <div key={racer.entryId} className={`flex items-center justify-between p-1 rounded ${isWinner?'bg-amber-500/10 border border-amber-500/40 text-amber-300':'text-slate-300'}`}>
    <div className="flex items-center gap-1.5 min-w-0">
     {!racer.isBye&&<span className="text-[10px] text-slate-400">#{racer.seed}</span>}
     <span className="truncate font-semibold text-xs">{racer.displayName}</span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
     <span className="font-bold text-xs">{racer.displayScore||'-'}</span>
     {!racer.isBye&&match.racer1&&match.racer2&&!match.racer1.isBye&&!match.racer2.isBye&&(
      <button type="button" onClick={()=>onSelectWinner(match.id,racer.entryId)} className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold transition ${isWinner?'bg-amber-500 text-slate-950':'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
       {isWinner?'★ Winner':'Pick Winner'}
      </button>
     )}
    </div>
   </div>;
  })}
  {match.winnerReason&&<p className="text-[10px] text-slate-400 truncate pt-0.5">{match.winnerReason}</p>}
 </div>;
}
