import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ExternalLink, CreditCard } from "lucide-react";

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
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
                    Billing setup pending
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button disabled title="Tier controls are not implemented yet" className="text-slate-500 flex items-center justify-end space-x-2 w-full cursor-not-allowed">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-semibold">Limits pending</span>
                  </button>
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
