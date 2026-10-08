import Link from "next/link";
import {Flag} from "lucide-react";
import {ActionFeedback} from "@/components/action-feedback";
import {verifyOtp} from "./actions";

type SearchParams = Promise<{error?: string; message?: string; next?: string; email?: string}>;
const inputStyle = "block w-full px-4 py-3 mt-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-center tracking-widest text-2xl font-mono";

export default async function VerifyOtpPage({searchParams}: {searchParams: SearchParams}) {
  const {error, message, next = '/dashboard', email = ''} = await searchParams;
  return <main className="flex-1 flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2 font-extrabold text-2xl"><Flag className="h-6 w-6 text-amber-500"/>Race<span className="text-amber-500">Holler</span></Link>
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-slate-400">We sent a 6-digit verification code to <strong>{email}</strong>.</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
        <ActionFeedback error={error} message={message}/>
        <form action={verifyOtp} className="space-y-4">
          <input type="hidden" name="next" value={next}/>
          <input type="hidden" name="email" value={email}/>
          <label className="block text-sm font-semibold text-center">Verification Code
            <input name="token" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoComplete="one-time-code" className={inputStyle} placeholder="000000"/>
          </label>
          <button type="submit" className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">Verify & Continue</button>
        </form>
      </div>
    </div>
  </main>;
}
