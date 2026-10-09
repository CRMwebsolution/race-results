"use client";

import { useState } from "react";
import { submitContactForm } from "./actions";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ContactPage() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean } | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setResult(null);
    const res = await submitContactForm(formData);
    setResult(res);
    setIsPending(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4 sm:p-8 mt-4 sm:mt-12">
      <div className="flex items-center space-x-3 mb-8">
        <Link 
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Contact Us</h1>
      </div>

      {result?.success ? (
        <div className="p-8 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Message Sent!</h2>
          <p className="text-slate-300">Thanks for reaching out. We'll get back to you as soon as possible.</p>
          <div className="pt-4">
            <Link href="/" className="inline-block px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition">Return Home</Link>
          </div>
        </div>
      ) : (
        <form action={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
          <p className="text-slate-400 text-sm mb-6">
            Have questions about RaceHoller, or want a custom website for your own track or series? Fill out the form below and we'll be in touch!
          </p>

          {result?.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {result.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Name</label>
            <input 
              name="name"
              required
              type="text" 
              placeholder="Your name"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Email</label>
            <input 
              name="email"
              required
              type="email" 
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Message</label>
            <textarea 
              name="message"
              required
              placeholder="How can we help?"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
              rows={5}
            />
          </div>
          
          <div className="pt-6 mt-2 border-t border-slate-800 flex justify-end">
            <button 
              type="submit" 
              disabled={isPending}
              className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-8 py-3 rounded-xl transition disabled:opacity-50 flex items-center"
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Message
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
