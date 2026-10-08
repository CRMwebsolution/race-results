import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy - RaceHoller',
  description: 'Clear refund terms for Event Passes and Season Passes on RaceHoller.',
};

export default function RefundPolicyPage() {
  return (
    <main className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-16 space-y-10">
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to RaceHoller
        </Link>
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <RefreshCw className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Refund & Cancellation Policy</h1>
            <p className="text-xs text-slate-400">Last updated: October 8, 2026</p>
          </div>
        </div>
      </div>

      <div className="prose prose-invert prose-slate max-w-none text-slate-300 space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Overview</h2>
          <p>
            At RaceHoller, we want track owners, promoters, and organizers to feel completely confident when managing their
            races. Our plans are sold on a transparent, one-time purchase basis—there are no surprise recurring monthly
            fees or automatic credit card renewals.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. Event Passes ($50)</h2>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <p className="font-semibold text-white">Event Pass Details & Flexibility:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs">
              <li>
                <strong>Credits Never Expire:</strong> If your race is rained out, postponed, or rescheduled before the event
                goes live, your purchased event pass credit remains in your account balance indefinitely for your next race.
              </li>
              <li>
                <strong>Full Refunds on Unused Passes:</strong> You are eligible for a full refund on any unused Event Pass
                within <strong>14 days of purchase</strong>, provided the pass credit has not been consumed to take a race live.
              </li>
              <li>
                <strong>Once an Event is Live:</strong> Once an event has gone live and published spectator results, the Event
                Pass is deemed delivered and consumed, and is non-refundable.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. Season Passes (Standard $200 / Premium $250)</h2>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <p className="font-semibold text-white">Season Pass Details:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs">
              <li>
                <strong>Non-Renewing Coverage:</strong> Season passes provide unlimited events for the calendar season and
                do not auto-renew.
              </li>
              <li>
                <strong>7-Day Refund Window:</strong> You may request a 100% refund on a Season Pass within <strong>7 days of purchase</strong>,
                provided you have not run or published any live events under that season pass.
              </li>
              <li>
                <strong>Mid-Season Upgrades:</strong> If you upgrade from Standard to Premium mid-season, the remaining balance
                is credited toward your upgraded plan.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Weather Cancellations & Acts of God</h2>
          <p>
            We understand motorsports. If severe weather or unforeseen track conditions force an event cancellation after
            setup but before racing concludes, your event credit can be restored or rolled over to your make-up date upon
            request by contacting our support team.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">5. How to Request a Refund</h2>
          <p>
            To request a refund or credit adjustment, simply email us:
          </p>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-xs">
            <p className="font-bold text-amber-400">Refund Support Email:</p>
            <p className="text-white font-mono">support@raceholler.com</p>
            <p className="text-slate-400 pt-1">
              Please include your organization name, track/series name, and the email address associated with your Stripe purchase.
              Refunds are processed back to the original payment method within 3–5 business days.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
