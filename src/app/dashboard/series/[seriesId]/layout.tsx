import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
/** Public series data belongs on /s; management needs organization authority. */
export default async function SeriesManagementLayout({children,params}:{children:React.ReactNode;params:Promise<{seriesId:string}>}){
 const {seriesId}=await params;const db=await createClient();
 const {data:series,error}=await db.from('series').select('organization_id').eq('id',seriesId).single();
 if(error||!series)redirect('/dashboard');
 const {data:canManage,error:permissionError}=await db.rpc('is_org_admin',{p_org_id:series.organization_id});
 if(permissionError||!canManage)redirect('/dashboard');
 return children;
}
