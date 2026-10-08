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
import {saveAttempt, setBracketMatchWinner, setBracketPasses, setBracketByes} from './actions';
import {BracketView} from '@/components/bracket-view';
import {isByeMatch, drawRandomByes} from '@/scoring/bracket';
import {Trophy, ChevronLeft, ChevronRight, CheckCircle, Clock, Flag, Dices, Shuffle, Eye, EyeOff} from 'lucide-react';
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
 const [overrideByes,setOverrideByes]=useState<Record<string,string[]>>({});
 const [selectedMatchId,setSelectedMatchId]=useState<string|null>(null);
 const [showFullGrid,setShowFullGrid]=useState(false);
 const [extraPasses,setExtraPasses]=useState<Record<string,number>>({});
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
 async function handleSetByes(byeIds:string[]){
  if(!activeClass)return;
  setOverrideByes(prev=>({...prev,[activeClass.id]:byeIds}));
  try{
   const res=await setBracketByes(trackId,event.id,activeClass.id,byeIds);
   if(!res.success)setCompleteError(res.error||'Failed to update bracket byes');
  }catch(e:any){setCompleteError(e?.message||'Failed to update bracket byes');}
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
    },
    byeEntryIds:overrideByes[activeClass.id]??activeClass.scoring_config?.byeEntryIds,
  };
  return buildBracketLadder(classEntries,classAttempts,effectiveConfig);
 },[activeClass,classEntries,attempts,overrideWinners,overrideByes]);
 const allTournamentMatches=useMemo(()=>{
  if(!bracketLadder)return [];
  const rounds=bracketLadder.hasLosersBracket
    ?[...(bracketLadder.winnersRounds||bracketLadder.rounds),...(bracketLadder.losersRounds||[])]
    :bracketLadder.rounds;
  const list=rounds.flatMap(r=>r.matchups);
  if(bracketLadder.grandFinal)list.push(bracketLadder.grandFinal);
  return list;
 },[bracketLadder]);
 const playableMatches=useMemo(()=>{
  return allTournamentMatches.filter(m=>!isByeMatch(m)&&m.racer1&&m.racer2);
 },[allTournamentMatches]);
 const firstIncompletePlayable=useMemo(()=>{
  return playableMatches.find(m=>!m.isComplete)||null;
 },[playableMatches]);
 const activeMatch=useMemo(()=>{
  if(!allTournamentMatches.length)return null;
  if(selectedMatchId){
   const match=allTournamentMatches.find(m=>m.id===selectedMatchId);
   if(match)return match;
  }
  return firstIncompletePlayable||playableMatches[0]||allTournamentMatches[0];
 },[allTournamentMatches,selectedMatchId,firstIncompletePlayable,playableMatches]);
 const activeMatchIndex=activeMatch?playableMatches.findIndex(m=>m.id===activeMatch.id):-1;
 const prevMatchId=activeMatchIndex>0?playableMatches[activeMatchIndex-1].id:null;
 const nextMatchId=activeMatchIndex>=0&&activeMatchIndex<playableMatches.length-1?playableMatches[activeMatchIndex+1].id:null;
 async function handleAdjustPasses(newCount:number){
  if(!activeClass)return;
  setExtraPasses(prev=>({...prev,[activeClass.id]:newCount}));
  try{
   const res=await setBracketPasses(trackId,event.id,activeClass.id,newCount);
   if(!res.success)setCompleteError(res.error||'Failed to update passes');
  }catch(e:any){setCompleteError(e?.message||'Failed to update passes');}
 }
 const classConfig=useMemo(()=>{
  if(!activeClass)return {};
  const passes=extraPasses[activeClass.id]??activeClass.scoring_config?.requiredPasses;
  return {...activeClass.scoring_config,...(passes!=null?{requiredPasses:passes}:{})};
 },[activeClass,extraPasses]);
 const columns=passCount(classConfig,attempts.filter(a=>a.event_class_id===activeClassId));
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
   {activeClass?.scoring_type==='head_to_head'&&(
    <div className="flex items-center gap-1.5 p-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs">
     <span className="font-semibold text-slate-400">Passes:</span>
     <button type="button" disabled={columns<=1||completing} onClick={()=>void handleAdjustPasses(Math.max(1,columns-1))} className="w-6 h-6 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white disabled:opacity-30 font-bold" title="Decrease passes">-</button>
     <span className="font-mono font-bold text-amber-400 px-1">{columns}</span>
     <button type="button" disabled={columns>=100||completing} onClick={()=>void handleAdjustPasses(columns+1)} className="w-6 h-6 flex items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-300 hover:text-white font-bold" title="Add pass">+</button>
    </div>
   )}
   <Link href={`${base}/entries?class=${activeClassId}`} className="p-3 border rounded-lg">Add contestant</Link>
   {canComplete&&<button onClick={()=>void complete()} onMouseDown={e=>e.preventDefault()} disabled={completing} className="p-3 rounded-lg bg-emerald-600 text-white font-bold">{completing?'Saving and completing…':'Complete race'}</button>}
   <p role="status" className="w-full text-sm text-slate-400">{status}</p>
  </nav>
  <div className="px-4"><ActionFeedback error={completeError}/></div>
  {prepared?.outbox.filter((o,i,a)=>(o.state!=='queued'||o.error)&&a.findIndex(x=>x.entryId===o.entryId&&x.ordinal===o.ordinal)===i).map(o=><div key={o.id} role="alert" className="mx-4 p-3 border rounded space-y-2"><p>{initialEntries.find(e=>e.id===o.entryId)?.display_name}, pass {o.ordinal}: {o.state==='conflict'?'Another scorekeeper changed this result. Choose which score to keep.':`This score is saved on your device. ${explainError(o.error||'Reconnect and try saving again.')}`} Your entry: {o.raw}</p>{o.state==='conflict'?<div className="flex flex-wrap gap-3"><button className="p-3 border rounded" onClick={()=>accountId&&void resolveConflict(accountId,event.id,o.entryId,o.ordinal,false).catch(e=>setCompleteError(explainError(e.message)))}>Keep the other saved score</button><button className="p-3 border rounded" onClick={()=>accountId&&void resolveConflict(accountId,event.id,o.entryId,o.ordinal,true).catch(e=>setCompleteError(explainError(e.message)))}>Keep my score</button></div>:<button className="p-3 border rounded" onClick={()=>accountId&&void retryPrepared(accountId,event.id).catch(()=>{})}>Try saving again</button>}</div>)}
  {Object.keys(errors).length>0&&<p role="alert" className="p-4 text-red-400">{[...new Set(Object.values(errors))].join(' ')} Your entries are kept.</p>}
  {activeClass?.scoring_type==='judged_points'&&<Link href={`${base}/judging`} className="inline-block p-4 text-amber-400 underline">Enter scores for this judged class</Link>}
  {activeClass?.scoring_type==='head_to_head'&&bracketLadder&&(
    <div className="mx-4 space-y-5">
     {/* 1. Active Match Scoring Field (The 2 Contestants Currently Racing) */}
     <div className="p-4 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-5">
      {/* Header with Navigation and Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
       <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
         <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs font-mono uppercase tracking-wider">
          {activeMatch ? activeMatch.id : 'No Match'}
         </span>
         <h3 className="font-black text-white text-lg sm:text-xl">
          {activeMatch
            ? `${activeMatch.bracketType === 'finals' ? 'Grand Finals' : `Round ${activeMatch.round} (Pass ${activeMatch.round})`} · Heat ${activeMatch.matchNumber}`
            : 'All Matches Complete'}
         </h3>
         {activeMatch?.isComplete ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1">
           <CheckCircle className="w-3.5 h-3.5" /> Done
          </span>
         ) : (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center gap-1 animate-pulse">
           <Clock className="w-3.5 h-3.5" /> Currently Racing
          </span>
         )}
        </div>
        <p className="text-xs text-slate-400">
         {activeClass.scoring_config?.winCriterion === 'first_to_finish'
           ? '⚡ Win Rule: First to Finish Line — Times always recorded & displayed. Click contestant to confirm stripe winner.'
           : '⚡ Win Rule: Fastest Elapsed Time — Lower ET advances automatically (Click contestant to override winner).'}
        </p>
       </div>

       {/* Prev / Next controls */}
       <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!prevMatchId}
          onClick={() => prevMatchId && setSelectedMatchId(prevMatchId)}
          className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-300 hover:text-white disabled:opacity-30 text-xs font-bold flex items-center gap-1 transition"
        >
         <ChevronLeft className="w-4 h-4" /> Prev Match
        </button>
        <span className="text-xs font-mono text-slate-400">
         {activeMatchIndex >= 0 ? `${activeMatchIndex + 1} of ${playableMatches.length}` : '—'}
        </span>
        <button
          type="button"
          disabled={!nextMatchId}
          onClick={() => nextMatchId && setSelectedMatchId(nextMatchId)}
          className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-300 hover:text-white disabled:opacity-30 text-xs font-bold flex items-center gap-1 transition"
        >
         Next Match <ChevronRight className="w-4 h-4" />
        </button>
       </div>
      </div>

      {/* Quick Playable Match Pills */}
      {playableMatches.length > 1 && (
       <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 hide-scrollbar text-xs">
        {playableMatches.map((m) => {
         const isActive = m.id === activeMatch?.id;
         return (
          <button
           key={m.id}
           type="button"
           onClick={() => setSelectedMatchId(m.id)}
           className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-mono font-bold transition flex items-center gap-1.5 ${
            isActive
              ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
              : m.isComplete
              ? 'bg-slate-950 border border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
           }`}
          >
           <span>{m.id}</span>
           <span className="text-[11px] font-sans font-normal opacity-80">
            ({m.racer1?.displayName?.split(' ')[0] || '#1'} vs {m.racer2?.displayName?.split(' ')[0] || '#2'})
           </span>
           {m.isComplete && <CheckCircle className="w-3 h-3 text-emerald-400" />}
          </button>
         );
        })}
       </div>
      )}

      {/* Contestants In This Race (Only 2 at a time) */}
      {activeMatch && activeMatch.racer1 && activeMatch.racer2 ? (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* Racer 1 (Lane 1) */}
        {(() => {
          const r1 = activeMatch.racer1;
          const passOrd = activeMatch.round;
          const k1 = r1 && !r1.isBye ? `${r1.entryId}:${passOrd}` : null;
          const att1 = attempts.find(a => a.event_class_id === activeClass.id && a.entry_id === r1?.entryId && a.ordinal === passOrd);
          const val1 = k1 ? (drafts[k1] ?? att1?.raw_input ?? '') : '';
          const isWinner1 = activeMatch.winnerId === r1?.entryId;
          const isLoser1 = activeMatch.isComplete && !isWinner1;

          return (
           <div className={`p-4 rounded-2xl border transition-all space-y-4 ${
            isWinner1
              ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
              : isLoser1
              ? 'bg-slate-950/60 border-slate-800 opacity-70'
              : 'bg-slate-950 border-slate-800'
           }`}>
            <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold text-xs">
               Seed #{r1?.seed}
              </span>
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Lane 1</span>
             </div>
             {isWinner1 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1">
               <Trophy className="w-3 h-3" /> Winner
              </span>
             )}
            </div>

            <div>
             <h4 className="text-xl sm:text-2xl font-black text-white truncate">
              {r1?.displayName}
             </h4>
             <p className="text-xs font-mono text-slate-400">
              Pass {passOrd} Recorded ET: <span className="text-white font-bold">{r1?.displayScore || '—'}</span>
             </p>
            </div>

            <div className="space-y-1.5">
             <label className="block text-xs font-semibold text-slate-400">
              Enter Pass {passOrd} Time / Distance
             </label>
             <input
              type="text"
              data-score-pass={passOrd}
              aria-label={`${r1?.displayName}, pass ${passOrd}`}
              aria-invalid={Boolean(k1 && errors[k1])}
              title={k1 ? errors[k1] : undefined}
              value={val1}
              onChange={e => {
               if (!k1) return;
               const next = { ...draftRef.current };
               if (e.target.value === (att1?.raw_input ?? '')) delete next[k1];
               else next[k1] = e.target.value;
               writeDrafts(next);
               setErrors(prev => { const n = { ...prev }; delete n[k1]; return n; });
              }}
              onBlur={e => {
               if (k1 && e.target.value !== (att1?.raw_input ?? '')) {
                void saveInput(r1!.entryId, passOrd, e.target.value);
               }
              }}
              onKeyDown={e => {
               if (e.key === 'Enter') e.currentTarget.blur();
              }}
              disabled={completing || (k1 ? saving.includes(k1) : false) || event.status === 'completed'}
              placeholder="e.g. 9.082 s or -"
              className={`w-full p-3 rounded-xl border bg-slate-900 text-white font-mono text-lg text-center font-bold focus:ring-2 focus:ring-amber-500 ${
               k1 && errors[k1] ? 'border-red-500' : 'border-slate-700'
              }`}
             />
             {k1 && errors[k1] && <p className="text-xs text-red-400">{errors[k1]}</p>}
            </div>

            <button
             type="button"
             disabled={!r1 || r1.isBye || completing || event.status === 'completed'}
             onClick={() => {
              if (!activeMatch || !r1) return;
              void handleSetWinner(activeMatch.id, isWinner1 ? null : r1.entryId);
             }}
             className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              isWinner1
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
             }`}
            >
             {isWinner1 ? (
              <>
               <CheckCircle className="w-4 h-4" /> Winner (Click to reset)
              </>
             ) : activeClass.scoring_config?.winCriterion === 'first_to_finish' ? (
              <>
               <Flag className="w-4 h-4 text-emerald-400" /> 🏁 1st Across Finish Line
              </>
             ) : (
              <>
               <Trophy className="w-4 h-4 text-amber-400" /> ★ Pick Winner (Override)
              </>
             )}
            </button>
           </div>
          );
        })()}

        {/* Racer 2 (Lane 2) */}
        {(() => {
          const r2 = activeMatch.racer2;
          const passOrd = activeMatch.round;
          const k2 = r2 && !r2.isBye ? `${r2.entryId}:${passOrd}` : null;
          const att2 = attempts.find(a => a.event_class_id === activeClass.id && a.entry_id === r2?.entryId && a.ordinal === passOrd);
          const val2 = k2 ? (drafts[k2] ?? att2?.raw_input ?? '') : '';
          const isWinner2 = activeMatch.winnerId === r2?.entryId;
          const isLoser2 = activeMatch.isComplete && !isWinner2;

          return (
           <div className={`p-4 rounded-2xl border transition-all space-y-4 ${
            isWinner2
              ? 'bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
              : isLoser2
              ? 'bg-slate-950/60 border-slate-800 opacity-70'
              : 'bg-slate-950 border-slate-800'
           }`}>
            <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold text-xs">
               Seed #{r2?.seed}
              </span>
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">Lane 2</span>
             </div>
             {isWinner2 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1">
               <Trophy className="w-3 h-3" /> Winner
              </span>
             )}
            </div>

            <div>
             <h4 className="text-xl sm:text-2xl font-black text-white truncate">
              {r2?.displayName}
             </h4>
             <p className="text-xs font-mono text-slate-400">
              Pass {passOrd} Recorded ET: <span className="text-white font-bold">{r2?.displayScore || '—'}</span>
             </p>
            </div>

            <div className="space-y-1.5">
             <label className="block text-xs font-semibold text-slate-400">
              Enter Pass {passOrd} Time / Distance
             </label>
             <input
              type="text"
              data-score-pass={passOrd}
              aria-label={`${r2?.displayName}, pass ${passOrd}`}
              aria-invalid={Boolean(k2 && errors[k2])}
              title={k2 ? errors[k2] : undefined}
              value={val2}
              onChange={e => {
               if (!k2) return;
               const next = { ...draftRef.current };
               if (e.target.value === (att2?.raw_input ?? '')) delete next[k2];
               else next[k2] = e.target.value;
               writeDrafts(next);
               setErrors(prev => { const n = { ...prev }; delete n[k2]; return n; });
              }}
              onBlur={e => {
               if (k2 && e.target.value !== (att2?.raw_input ?? '')) {
                void saveInput(r2!.entryId, passOrd, e.target.value);
               }
              }}
              onKeyDown={e => {
               if (e.key === 'Enter') e.currentTarget.blur();
              }}
              disabled={completing || (k2 ? saving.includes(k2) : false) || event.status === 'completed'}
              placeholder="e.g. 9.082 s or -"
              className={`w-full p-3 rounded-xl border bg-slate-900 text-white font-mono text-lg text-center font-bold focus:ring-2 focus:ring-amber-500 ${
               k2 && errors[k2] ? 'border-red-500' : 'border-slate-700'
              }`}
             />
             {k2 && errors[k2] && <p className="text-xs text-red-400">{errors[k2]}</p>}
            </div>

            <button
             type="button"
             disabled={!r2 || r2.isBye || completing || event.status === 'completed'}
             onClick={() => {
              if (!activeMatch || !r2) return;
              void handleSetWinner(activeMatch.id, isWinner2 ? null : r2.entryId);
             }}
             className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              isWinner2
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
             }`}
            >
             {isWinner2 ? (
              <>
               <CheckCircle className="w-4 h-4" /> Winner (Click to reset)
              </>
             ) : activeClass.scoring_config?.winCriterion === 'first_to_finish' ? (
              <>
               <Flag className="w-4 h-4 text-emerald-400" /> 🏁 1st Across Finish Line
              </>
             ) : (
              <>
               <Trophy className="w-4 h-4 text-amber-400" /> ★ Pick Winner (Override)
              </>
             )}
            </button>
           </div>
          );
        })()}
       </div>
      ) : (
       <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400">
        <p>No active head-to-head match ready to score.</p>
       </div>
      )}

      {/* Outcome / Advance bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
       <div className="text-xs text-slate-400 font-mono">
        {activeMatch?.winnerReason && (
         <span className="text-amber-300 font-semibold">Outcome: {activeMatch.winnerReason}</span>
        )}
       </div>
       {activeMatch?.isComplete && nextMatchId && (
        <button
         type="button"
         onClick={() => setSelectedMatchId(nextMatchId)}
         className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm flex items-center gap-2 shadow-lg transition"
        >
         Advance to Next Match ({playableMatches[activeMatchIndex + 1]?.racer1?.displayName?.split(' ')[0] || 'Racer'} vs {playableMatches[activeMatchIndex + 1]?.racer2?.displayName?.split(' ')[0] || 'Racer'}) <ChevronRight className="w-4 h-4" />
        </button>
       )}
      </div>

      {/* Bye Allocation Card (Owner Decides / Draws from Hat) */}
      {bracketLadder.numByes != null && bracketLadder.numByes > 0 && (
       <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
         <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg flex-shrink-0">
          <Dices className="w-4 h-4" />
         </div>
         <div className="min-w-0">
          <p className="font-bold text-amber-400">
           🎩 Bye Allocation ({bracketLadder.numByes} {bracketLadder.numByes === 1 ? 'Bye' : 'Byes'})
          </p>
          <p className="text-slate-400 text-[11px] truncate">
           Assigned to: <span className="font-semibold text-white">
            {bracketLadder.byeEntryIds && bracketLadder.byeEntryIds.length
              ? bracketLadder.byeEntryIds
                  .map(id => classEntries.find(e => e.id === id)?.display_name || id)
                  .join(', ')
              : `${classEntries[0]?.display_name || 'Seed #1'} (Top Seed)`}
           </span>
          </p>
         </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
         <button
          type="button"
          onClick={() => {
           const randomIds = drawRandomByes(classEntries, bracketLadder.numByes!);
           void handleSetByes(randomIds);
          }}
          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition flex items-center gap-1.5 shadow"
          title="Randomly draw bye recipient from a hat"
         >
          <Shuffle className="w-3.5 h-3.5" /> 🎲 Draw From Hat
         </button>
         <select
          value={bracketLadder.byeEntryIds?.[0] || ''}
          onChange={e => {
           if (e.target.value) void handleSetByes([e.target.value]);
          }}
          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium"
         >
          <option value="">Choose racer for bye...</option>
          {classEntries.map(e => (
           <option key={e.id} value={e.id}>
            {e.display_name} (Seed #{e.seed ?? '—'})
           </option>
          ))}
         </select>
         {bracketLadder.byeEntryIds && bracketLadder.byeEntryIds.length > 0 && (
          <button
           type="button"
           onClick={() => void handleSetByes([])}
           className="text-slate-400 hover:text-white text-[11px] underline"
          >
           Reset to #1 Seed
          </button>
         )}
        </div>
       </div>
      )}
     </div>

     {/* 2. Tournament Bracket Tree Pairings (Placed BELOW the scoring field for the owner) */}
     <div className="p-4 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <div>
        <h3 className="font-black text-amber-400 text-base sm:text-lg flex items-center gap-2">
         <Trophy className="w-5 h-5 text-amber-500" /> Tournament Bracket Tree ({bracketLadder.bracketSize}-Car Field{bracketLadder.hasLosersBracket ? ' · Double Elimination' : ''})
        </h3>
        <p className="text-xs text-slate-400">
         Click any matchup card in the tree to jump to it in the scoring field above.
        </p>
       </div>
       {bracketLadder.championId && (
        <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider">
         🏆 Champion: {bracketLadder.resultsByEntryId[bracketLadder.championId]?.displayName}
        </span>
       )}
      </div>

      <BracketView
       ladder={bracketLadder}
       selectedMatchId={activeMatch?.id}
       onSelectMatch={mId => setSelectedMatchId(mId)}
      />
     </div>

     {/* 3. Collapsible Full Contestant Table */}
     <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
       <p className="text-xs text-slate-400 font-semibold">
        Full Contestant Leaderboard Table ({rows.length} Contestants)
       </p>
       <button
        type="button"
        onClick={() => setShowFullGrid(prev => !prev)}
        className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1.5"
       >
        {showFullGrid ? (
         <>
          <EyeOff className="w-3.5 h-3.5" /> Hide Full Table
         </>
        ) : (
         <>
          <Eye className="w-3.5 h-3.5" /> Show Full Table
         </>
        )}
       </button>
      </div>

      {showFullGrid && (
       <div className="overflow-x-auto pt-2 min-w-0">
        <table aria-label={`${activeClass?.name||'Class'} scores`} className="w-full min-w-[640px] text-left bg-slate-900 rounded-lg">
         <thead className="bg-slate-800">
          <tr>
           <SortHeading<ResultOrder> label="Rank" value="rank" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>
           <SortHeading<ResultOrder> label="Order" value="run" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>
           <SortHeading<ResultOrder> label="Racer" value="name" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>
           {Array.from({length:columns},(_,i)=><SortHeading<ResultOrder> key={i} label={`Pass ${i+1}`} value={`pass:${i+1}`} order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>)}
           <th scope="col" className="p-3">Result</th>
          </tr>
         </thead>
         <tbody>
          {rows.map(row=><tr data-testid="scoring-row" data-entry-id={row.entryId} key={row.entryId} className="border-t border-slate-700">
           <td className="p-3">{row.rank===null?'—':`${row.tied?'T':''}${row.rank}`}</td>
           <td className="p-3">{row.orderNum}</td>
           <td className="p-3 font-semibold">{row.entry.display_name}</td>
           {Array.from({length:columns},(_,i)=>{
            const ordinal=i+1,key=`${row.entryId}:${ordinal}`,attempt=row.attempts.find(a=>a.ordinal===ordinal);
            return <td key={ordinal} className="p-2">
             <input type="text" data-score-pass={ordinal} tabIndex={key===gridTabStop?0:-1} onFocus={()=>setTabStop(key)} aria-label={`${row.entry.display_name}, pass ${ordinal}`} aria-invalid={Boolean(errors[key])} title={errors[key]} value={drafts[key]??attempt?.rawInput??''} onChange={e=>{const next={...draftRef.current};if(e.target.value===(attempt?.rawInput??''))delete next[key];else next[key]=e.target.value;writeDrafts(next);setErrors(prev=>{const next={...prev};delete next[key];return next;});}} onBlur={e=>{if(e.target.value!==(attempt?.rawInput??''))void saveInput(row.entryId,ordinal,e.target.value);}} onKeyDown={handleScoreKeyDown} disabled={completing||saving.includes(key)||event.status==='completed'} placeholder="-" className={`w-full min-w-[96px] p-2.5 rounded border bg-slate-950 text-white font-mono ${errors[key]?'border-red-500':'border-slate-700'}`}/>
            </td>;
           })}
           <td className="p-3 whitespace-nowrap font-mono">{row.score.label||'No score'}</td>
          </tr>)}
          {!rows.length&&<tr><td colSpan={columns+4} className="p-6">No contestants in this class yet. Use Add contestant above.</td></tr>}
         </tbody>
        </table>
       </div>
      )}
     </div>
    </div>
   )}

   {/* Standard full table for non-bracket race formats */}
   {activeClass?.scoring_type!=='head_to_head'&&(
    <div className="overflow-x-auto p-4 min-w-0">
     <p id="score-entry-help" className="mb-3 text-sm text-slate-400">Tab moves down each pass column, then to the next pass. Shift+Tab moves back.{activeClass?.scoring_type==='fastest_pass'&&' Enter seconds (9.082 s) for a completed run or distance (108.5 ft / 108 ft 6 in) for an incomplete run. Every completed run beats every incomplete run.'} Use - for no pass.</p>
     <table aria-label={`${activeClass?.name||'Class'} scores`} className="w-full min-w-[640px] text-left bg-slate-900 rounded-lg" onFocusCapture={e=>{if(e.target instanceof HTMLInputElement)setFrozen(rows.map(r=>r.entryId));}} onBlurCapture={e=>{if(!(e.relatedTarget instanceof HTMLInputElement)||!e.currentTarget.contains(e.relatedTarget))setFrozen(null);}}>
      <thead className="bg-slate-800"><tr><SortHeading<ResultOrder> label="Rank" value="rank" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/><SortHeading<ResultOrder> label="Order" value="run" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/><SortHeading<ResultOrder> label="Racer" value="name" order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>{Array.from({length:columns},(_,i)=><SortHeading<ResultOrder> key={i} label={`Pass ${i+1}`} value={`pass:${i+1}`} order={order} reverse={reverse} onOrder={setOrder} onReverse={setReverse}/>)}<th scope="col" className="p-3">Result</th></tr></thead>
      <tbody>{rows.map(row=><tr data-testid="scoring-row" data-entry-id={row.entryId} key={row.entryId} className="border-t border-slate-700"><td className="p-3">{row.rank===null?'—':`${row.tied?'T':''}${row.rank}`}</td><td className="p-3">{row.orderNum}</td><td className="p-3 font-semibold">{row.entry.display_name}</td>{Array.from({length:columns},(_,i)=>{const ordinal=i+1,key=`${row.entryId}:${ordinal}`,attempt=row.attempts.find(a=>a.ordinal===ordinal);return <td key={ordinal} className="p-2"><input type="text" data-score-pass={ordinal} tabIndex={key===gridTabStop?0:-1} onFocus={()=>setTabStop(key)} aria-describedby="score-entry-help" aria-label={`${row.entry.display_name}, pass ${ordinal}`} aria-invalid={Boolean(errors[key])} title={errors[key]} value={drafts[key]??attempt?.rawInput??''} onChange={e=>{const next={...draftRef.current};if(e.target.value===(attempt?.rawInput??''))delete next[key];else next[key]=e.target.value;writeDrafts(next);setErrors(previous=>{const next={...previous};delete next[key];return next;});}} onBlur={e=>{if(e.target.value!==(attempt?.rawInput??''))void saveInput(row.entryId,ordinal,e.target.value);}} onKeyDown={handleScoreKeyDown} disabled={completing||saving.includes(key)||event.status==='completed'||activeClass?.scoring_type==='judged_points'} placeholder="-" className={`w-full min-w-[96px] p-3 rounded border bg-slate-950 text-white font-mono ${errors[key]?'border-red-500':'border-slate-700'}`}/></td>;})}<td className="p-3 whitespace-nowrap font-mono">{row.score.label||'No score'}</td></tr>)}{!rows.length&&<tr><td colSpan={columns+4} className="p-6">No contestants in this class yet. Use Add contestant above.</td></tr>}</tbody>
     </table>
    </div>
   )}
  </div>;
}
