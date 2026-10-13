import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Building2, Flag, Trophy, Calendar, ArrowRight } from "lucide-react";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: accountCount },
    { count: orgCount },
    { count: trackCount },
    { count: seriesCount },
    { count: eventCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("tracks").select("*", { count: "exact", head: true }),
    supabase.from("series").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    {
      title: "Promoter Accounts",
      count: accountCount ?? 0,
      href: "/admin/accounts",
      icon: Users,
      color: "text-emerald-400",
      description: "Manage accounts, grant credits, and delete user profiles",
    },
    {
      title: "Organizations",
      count: orgCount ?? 0,
      href: "/admin/organizations",
      icon: Building2,
      color: "text-amber-400",
      description: "Inspect organizations, adjust plans, and cascade delete",
    },
    {
      title: "Tracks",
      count: trackCount ?? 0,
      href: "/admin/tracks",
      icon: Flag,
      color: "text-blue-400",
      description: "Browse tracks, view public pages, and manage venues",
    },
    {
      title: "Championship Series",
      count: seriesCount ?? 0,
      href: "/admin/series",
      icon: Trophy,
      color: "text-purple-400",
      description: "Inspect racing series, points systems, and seasons",
    },
    {
      title: "Events & Races",
      count: eventCount ?? 0,
      href: "/admin/events",
      icon: Calendar,
      color: "text-rose-400",
      description: "Inspect scheduled, live, and completed races across all venues",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Platform Overview</h1>
        <p className="text-slate-400 mt-2">
          System health and management portal for RaceHoller. Click into any entity to inspect, manage, or delete with safety fail-safes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md transition hover:border-slate-700 hover:bg-slate-900/80 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {card.title}
                  </span>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-4xl font-extrabold text-white mt-3">{card.count}</p>
                <p className="text-xs text-slate-400 mt-2">{card.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-white">
                <span>Manage {card.title}</span>
                <ArrowRight className="w-4 h-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
