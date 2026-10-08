import {describe,it,expect} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {readAll} from '../read-all';

/** Exercise the real PostgREST builder against race_staff's compound-key schema. */
function staffClient(rows:{event_id:string;user_id:string;role:string}[]) {
 const orders:string[]=[];
 const db=createClient('https://staff-read.test','test-public-key',{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async(input)=>{
   const url=new URL(String(input)),order=url.searchParams.get('order')||'';
   orders.push(order);
   if(order.split(',').some(c=>!['event_id','user_id'].includes(c.split('.')[0])))return new Response(JSON.stringify({message:'column race_staff.id does not exist',code:'42703'}),{status:400,headers:{'content-type':'application/json'}});
   // Mimic a server row cap smaller than the requested page.
   const offset=Number(url.searchParams.get('offset')||0);
   return new Response(JSON.stringify(rows.slice(offset,offset+1)),{headers:{'content-type':'application/json'}});
  }}
 });
 return {db,orders};
}
describe('dashboard and invitation staff reads',()=>{
 it('loads an empty staff list without ordering by a nonexistent id',async()=>{
  const {db,orders}=staffClient([]);
  const result=await readAll(db.from('race_staff').select('role,events(id,name,local_date,status,track_id,series_id)').eq('user_id','account').eq('active',true),['event_id','user_id']);
  expect(result.data).toEqual([]);expect(orders).toEqual(['event_id.asc,user_id.asc']);
 });
 it('loads every staff member using the compound key across pages',async()=>{
  const rows=[{event_id:'race',user_id:'a',role:'judge'},{event_id:'race',user_id:'b',role:'official'}];
  const {db,orders}=staffClient(rows);
  expect((await readAll(db.from('race_staff').select('*').eq('event_id','race').eq('active',true),['event_id','user_id'])).data).toEqual(rows);
  expect(orders).toHaveLength(3);expect(orders.every(o=>o==='event_id.asc,user_id.asc')).toBe(true);
 });
 it('reproduces the old dashboard failure when the default id ordering is used',async()=>{
  const {db}=staffClient([]);
  await expect(readAll(db.from('race_staff').select('*'))).rejects.toThrow('column race_staff.id does not exist');
 });
});
