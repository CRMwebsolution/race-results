import {createClient} from "@/lib/supabase/server";
import {LifeBuoy, Lightbulb} from "lucide-react";
import {TipToggle} from "./tip-toggle";

export default async function HelpPage() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  const {data: profile} = await supabase.from('profiles').select('show_tips').eq('id', user?.id || '').single();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><LifeBuoy className="text-amber-500" /> Help & Support</h1>
          <p className="text-slate-400 mt-2">Get help with running your races and managing your account.</p>
        </div>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> Interface Tips</h2>
              <p className="text-sm text-slate-400">Show helpful tooltips around the app to guide you on how things work.</p>
            </div>
            <TipToggle initialShowTips={profile?.show_tips ?? true} />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <h3 className="font-bold text-lg">How do I run a bracket race?</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Bracket racing allows you to place contestants into a single-elimination tournament. 
                Go to your event, click "Add Class", select "Bracket" as the scoring style. 
                Once contestants are registered, go to the Scoring Workspace to randomly draw byes and begin racing!
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <h3 className="font-bold text-lg">How do spectators see live results?</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Click the "Pit Display" button at the top of your event. You can open this on a large TV or tablet. 
                Spectators can also scan the QR code on the Pit Display to view live results directly on their phones.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
