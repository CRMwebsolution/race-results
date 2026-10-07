import {beforeEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},rpc})}));
import {changePrepared,getPrepared,queueAttempt} from '../store';
import {prepareEvent,finishPrepared} from '../prepare';
const packet={accountId:'owner',trackId:'track',event:{id:'event',name:'Race',working_revision:2,status:'live'},classes:[],initialEntries:[],initialAttempts:[]};
beforeEach(async()=>{
 rpc.mockReset();rpc.mockResolvedValue({data:{...packet,sessionId:'session'},error:null});
 vi.stubGlobal('indexedDB',new IDBFactory());vi.stubGlobal('window',new EventTarget());
 vi.stubGlobal('navigator',{onLine:true,serviceWorker:{register:async()=>{},ready:Promise.resolve()},storage:{persist:async()=>true}});
 vi.stubGlobal('caches',{open:async()=>({put:async()=>{}})});
 vi.stubGlobal('fetch',vi.fn(async(path:string)=>new Response(path==='/offline'?'<script src="/_next/static/app.js"></script>':'app')));
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
 await changePrepared('owner','event',()=>({key:'owner:event',schemaVersion:1,accountId:'owner',sessionId:'session',packet,outbox:[],closed:false,preparedAt:'now'}));
});
it('reopens a closed session and retains scores waiting to upload',async()=>{
 await queueAttempt('owner','event','class','entry',1,'-',0);
 await changePrepared('owner','event',r=>({...r!,closed:true,closing:true}));
 await prepareEvent('owner','event');
 const saved=(await getPrepared('owner','event'))!;
 expect(saved.closed).toBe(false);expect(saved.closing).toBe(false);
 expect(saved.outbox).toHaveLength(1);expect(saved.outbox[0].raw).toBe('-');
 await expect(queueAttempt('owner','event','class','entry',2,'9.1',0)).resolves.toBeDefined();
});
it('deduplicates simultaneous automatic preparation on the same device',async()=>{
 await Promise.all([prepareEvent('owner','event'),prepareEvent('owner','event')]);
 expect(rpc.mock.calls.filter(c=>c[0]==='prepare_offline_event')).toHaveLength(1);
});
it('keeps the grid usable when closing a session loses its response',async()=>{
 rpc.mockResolvedValue({data:null,error:{message:'Connection lost'}});
 await expect(finishPrepared('owner','event')).rejects.toThrow('Connection lost');
 expect((await getPrepared('owner','event'))!.closing).toBe(false);
 await expect(queueAttempt('owner','event','class','entry',1,'9.1',0)).resolves.toBeDefined();
});
it('does not close a session with an unsent score',async()=>{
 await queueAttempt('owner','event','class','entry',1,'9.1',0);
 await expect(finishPrepared('owner','event')).rejects.toThrow('waiting to save');
 expect(rpc).not.toHaveBeenCalled();expect((await getPrepared('owner','event'))!.outbox).toHaveLength(1);
});
