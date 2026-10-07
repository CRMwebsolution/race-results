import {authReturnPath} from "@/lib/auth-return";
import Link from "next/link";
import {Flag} from "lucide-react";
import {accountModes} from "@/lib/account-mode";
import {ActionFeedback} from "@/components/action-feedback";
import {signup} from "./actions";

type SearchParams = Promise<{error?: string; message?: string;next?:string}>;
const inputStyle = "block w-full px-4 py-3 mt-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50";

export default async function RegisterPage({searchParams}: {searchParams: SearchParams}) {
  const {error, message,next:requested} = await searchParams;
  const next=authReturnPath(requested),invited=next!=='/dashboard';
  return <main className="flex-1 flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-2xl"><Flag className="h-6 w-6 text-amber-500"/>Race<span className="text-amber-500">Holler</span></Link>
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="text-sm text-slate-400">{invited?'Create an account to accept your race staff invitation.':'Choose how you run races to set up your dashboard.'}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
        <ActionFeedback error={error} message={message}/>
        <form action={signup} className="space-y-4"><input type="hidden" name="next" value={next}/>
          <label className="block text-sm font-semibold">Email<input name="email" type="email" required autoComplete="email" className={inputStyle}/></label>
          <label className="block text-sm font-semibold">Password<input name="password" type="password" required autoComplete="new-password" className={inputStyle}/></label>
          {invited?<input type="hidden" name="operating_mode" value="single_track"/>:<><label className="block text-sm font-semibold">How do you run races?
            <select name="operating_mode" defaultValue="single_track" className={inputStyle}>{accountModes.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
          </label>
          <p className="text-xs text-slate-400">You can change this later in account settings.</p></>}
          <button type="submit" className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">Create account</button>
        </form>
        <p className="text-center text-sm text-slate-400">Already registered? <Link href={invited?`/login?next=${encodeURIComponent(next)}`:'/login'} className="font-semibold text-amber-400 underline">Sign in</Link></p>
      </div>
    </div>
  </main>;
}
