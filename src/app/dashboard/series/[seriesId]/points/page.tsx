import {notFound,redirect} from 'next/navigation';
import {readAll} from '@/lib/read-all';
import {createClient} from '@/lib/supabase/server';
import {revalidatePath} from 'next/cache';
import Link from 'next/link';
import { PlacementRuleInputs } from '@/components/placement-points-form';
import { TipBubble } from '@/components/tip-provider';

export default async function SeriesPointsPage({params,searchParams}:{params:Promise<{seriesId:string}>;searchParams:Promise<{error?:string;message?:string}>}){
 const {seriesId}=await params,p=await searchParams,db=await createClient();
 const {data:series,error}=await db.from('series').select('name').eq('id',seriesId).single();
 if(error||!series)notFound();
 const [{data:classes},{data:rules},{data:bonuses}]=await Promise.all([
  readAll(db.from('series_classes').select('id,name').eq('series_id',seriesId).order('order_num')),
  readAll(db.from('series_points_rules').select('*').eq('series_id',seriesId).order('rank_start')),
  readAll(db.from('series_bonuses').select('*,series_classes!series_bonuses_class_scope_fkey(name)').eq('series_id',seriesId).order('created_at')),
 ]);
 const url=`/dashboard/series/${seriesId}/points`;
 async function saveRule(f:FormData){'use server';const db=await createClient(),id=String(f.get('id')||'');
  const row={series_id:seriesId,rank_start:Number(f.get('rank_start')),rank_end:Number(f.get('rank_end')),points:Number(f.get('points'))};
  const {error}=id?await db.from('series_points_rules').update(row).eq('id',id).eq('series_id',seriesId).select('id').single():await db.from('series_points_rules').insert(row);
  if(error)redirect(`${url}?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard/series','layout');redirect(`${url}?message=Placement rule saved`);
 }
 async function saveBonus(f:FormData){'use server';const db=await createClient(),id=String(f.get('id')||'');
  const classId=String(f.get('series_class_id'));const row={series_id:seriesId,bonus_type:String(f.get('bonus_type')),points:Number(f.get('points')),series_class_id:classId==='all'?null:classId,frequency:String(f.get('frequency'))};
  const {error}=id?await db.from('series_bonuses').update(row).eq('id',id).eq('series_id',seriesId).select('id').single():await db.from('series_bonuses').insert(row);
  if(error)redirect(`${url}?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard/series','layout');redirect(`${url}?message=Bonus saved`);
 }
 async function remove(f:FormData){'use server';const db=await createClient(),kind=f.get('kind');if(kind!=='rule'&&kind!=='bonus')throw new Error('Unknown rule type');
  const {error}=await db.from(kind==='rule'?'series_points_rules':'series_bonuses').delete().eq('id',String(f.get('id'))).eq('series_id',seriesId).select('id').single();
  if(error)redirect(`${url}?error=${encodeURIComponent(error.message)}`);revalidatePath('/dashboard/series','layout');redirect(`${url}?message=Rule removed`);
 }
 function bonusFields(bonus?:typeof bonuses[number]){return <><input type="hidden" name="id" value={bonus?.id||''}/><label className="block">Bonus condition<select name="bonus_type" defaultValue={bonus?.bonus_type||'perfect_attendance'} className="block w-full min-w-0 p-3 bg-slate-950 border rounded">{[['perfect_attendance','Perfect attendance'],['consistent_pass','Most consistent pass'],['fastest_pass','Fastest pass'],['showmanship','Showmanship (manual award)'],['custom','Custom (manual award)']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="block">Applies to<select name="series_class_id" defaultValue={bonus?.series_class_id||'all'} className="block w-full p-3 bg-slate-950 border rounded"><option value="all">All classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="block">Frequency<select name="frequency" defaultValue={bonus?.frequency||'per_event'} className="block w-full p-3 bg-slate-950 border rounded"><option value="per_event">Once per race / racer</option><option value="per_class">Per class</option></select></label><label className="block">Points<input name="points" required type="number" min="0" defaultValue={bonus?.points??10} className="block w-full p-3 bg-slate-950 border rounded"/></label></>;}
 return <main className="max-w-5xl mx-auto w-full p-4 sm:p-8 space-y-6">
  <div className="flex items-center space-x-2">
    <Link href={`/dashboard/series/${seriesId}`} className="text-amber-400 hover:underline">&larr; Back to series</Link>
  </div>
  <h1 className="text-2xl font-bold">Points & Bonuses</h1>
  <p className="text-slate-400">{series.name}</p>
  <TipBubble title="Series Points System · Step 11">
    <p className="text-xs text-amber-200/90 leading-relaxed">
      <strong className="text-white">Step 11:</strong> Set up your placement points below. Enter the rank and point value, and check either <strong className="text-white">&ldquo;Multi-rank&rdquo;</strong> (e.g. ranks 2–4 get 30 pts) or <strong className="text-white">&ldquo;This rank and below&rdquo;</strong> (e.g. rank 5 and below get 10 pts). When finished, click &ldquo;&larr; Back to series&rdquo;!
    </p>
  </TipBubble>
  {p.error&&<p role="alert" className="p-3 bg-red-950 rounded text-red-300">{p.error}</p>}
  {p.message&&<p role="status" className="text-emerald-300">{p.message}</p>}
  <p className="text-xs text-slate-400">Rule changes require a new standings publication; earlier published versions are retained. Full attendance is awarded once after the complete announced schedule is official.</p>
  <div className="grid md:grid-cols-2 gap-6">
    <section className="min-w-0 space-y-4">
      <h2 className="text-xl font-bold">Placement points</h2>
      {rules.map(rule=><article key={rule.id} className="p-4 bg-slate-900 border rounded space-y-3">
        <p className="font-bold text-amber-300">
          {rule.rank_start === rule.rank_end
            ? `Rank ${rule.rank_start} · ${rule.points} points`
            : rule.rank_end >= 999
            ? `Rank ${rule.rank_start} & below · ${rule.points} points`
            : `Ranks ${rule.rank_start}–${rule.rank_end} · ${rule.points} points`}
        </p>
        <details><summary className="cursor-pointer p-2 text-sm text-slate-400 hover:text-white">Edit placement rule</summary>
          <form action={saveRule} className="space-y-3 pt-2">
            <PlacementRuleInputs rule={rule}/>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-sm border border-slate-700">Save rule</button>
          </form>
        </details>
        <form action={remove}>
          <input type="hidden" name="kind" value="rule"/>
          <input type="hidden" name="id" value={rule.id}/>
          <button aria-label={`Remove ranks ${rule.rank_start} to ${rule.rank_end}`} className="p-2 text-red-300 text-xs hover:underline">Remove rule</button>
        </form>
      </article>)}
      <form action={saveRule} aria-label="Add placement rule" className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <h3 className="font-bold text-lg text-white">Add placement rule</h3>
        <PlacementRuleInputs/>
        <button className="w-full p-3 bg-amber-500 hover:bg-amber-400 font-bold rounded-xl text-slate-950 transition">Add placement rule</button>
      </form>
    </section>
    <section className="min-w-0 space-y-4">
      <h2 className="text-xl font-bold">Bonus modifiers</h2>
      {bonuses.map(bonus=><article key={bonus.id} className="p-4 bg-slate-900 border rounded space-y-3">
        <p className="font-bold capitalize">{bonus.bonus_type.replaceAll('_',' ')} · {bonus.points} points</p>
        <p>{bonus.series_classes?.name||'All classes'} · {bonus.frequency==='per_event'?'Once per race / racer':'Per class'}</p>
        <details><summary className="cursor-pointer p-2">Edit bonus</summary>
          <form action={saveBonus} className="space-y-3">{bonusFields(bonus)}<button className="p-3 border rounded">Save bonus</button></form>
        </details>
        <form action={remove}>
          <input type="hidden" name="kind" value="bonus"/>
          <input type="hidden" name="id" value={bonus.id}/>
          <button aria-label={`Remove ${bonus.bonus_type.replaceAll('_',' ')} bonus`} className="p-2 text-red-300">Remove bonus</button>
        </form>
      </article>)}
      <form action={saveBonus} aria-label="Add bonus" className="p-4 bg-slate-900 border rounded space-y-3">
        <h3 className="font-bold">Add bonus</h3>{bonusFields()}<button className="p-3 bg-amber-500 rounded text-slate-950">Add bonus</button>
      </form>
    </section>
  </div>
 </main>;
}
