import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ExternalLink, CreditCard } from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function AdminOrganizationsPage() {
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select(`
      id, 
      name, 
      tracks (id, name)
    `)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Registered Organizations</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-6 py-4">Organization</th>
              <th className="px-6 py-4">Tracks</th>
              <th className="px-6 py-4">Subscription</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {orgs?.map((org: any) => (
              <tr key={org.id} className="hover:bg-slate-800/30 transition">
                <td className="px-6 py-4 font-medium text-white">{org.name}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {org.tracks.map((t: any) => (
                      <Link 
                        key={t.id} 
                        href={`/dashboard/tracks/${t.id}`}
                        className="text-amber-500 hover:text-amber-400 flex items-center space-x-1"
                      >
                        <span>{t.name}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ))}
                    {org.tracks.length === 0 && <span className="text-slate-500 italic">No tracks</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-widest border ${
                    org.active_tier === 'premium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    org.active_tier === 'standard' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {org.active_tier || 'free'}
                  </span>
                  <div className="text-xs text-slate-500 mt-1">Quota: {org.event_quota || 0}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <form action={async (formData) => {
                    'use server';
                    const supabase = await createClient();
                    const tier = formData.get('tier') as string;
                    const orgId = formData.get('orgId') as string;
                    const action = formData.get('admin_action') as string;
                    
                    if (action === 'bypass') {
                      await supabase.rpc('grant_organization_entitlement', {
                        p_org_id: orgId, p_tier: 'premium', p_quota: 9999, p_end_date: '2099-12-31'
                      });
                    } else if (action === 'set_tier') {
                      await supabase.rpc('grant_organization_entitlement', {
                        p_org_id: orgId, p_tier: tier, p_quota: 100, p_end_date: '2099-12-31'
                      });
                    }
                    revalidatePath('/', 'layout');
                  }}>
                    <input type="hidden" name="orgId" value={org.id} />
                    <div className="flex items-center justify-end space-x-2">
                      <select name="tier" className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1">
                        <option value="free">Free</option>
                        <option value="event_pass">Event Pass</option>
                        <option value="standard">Standard</option>
                        <option value="premium">Premium</option>
                      </select>
                      <button name="admin_action" value="set_tier" className="text-xs font-semibold px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white transition">
                        Set
                      </button>
                      <button name="admin_action" value="bypass" className="text-xs font-semibold px-2 py-1 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/30 rounded transition" title="Grant unlimited lifetime premium access">
                        Bypass Limits
                      </button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
            {orgs?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No organizations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
