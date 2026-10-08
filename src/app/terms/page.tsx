import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service - RaceHoller',
  description: 'Terms and conditions governing the use of RaceHoller race management and scoring platform.',
};

export default function TermsOfServicePage() {
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
          <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Shield className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Terms of Service</h1>
            <p className="text-xs text-slate-400">Last updated: October 8, 2026</p>
          </div>
        </div>
      </div>

      <div className="prose prose-invert prose-slate max-w-none text-slate-300 space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Agreement to Terms</h2>
          <p>
            By accessing or using RaceHoller (&ldquo;the Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
            including our website, mobile applications, race scoring software, and spectator feeds, you agree to be bound
            by these Terms of Service. If you do not agree with any part of these Terms, you may not use our platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. Description of Services</h2>
          <p>
            RaceHoller provides a specialized race management software-as-a-service (SaaS) platform designed for track
            operators, series promoters, racing clubs, and event organizers. Features include deterministic race scoring
            engines (drag racing, pull events, bracket racing, judged competitions), real-time spectator feeds, offline-first
            timing entry, and season championship standings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. Accounts and Responsibilities</h2>
          <p>
            When registering an account with RaceHoller, you agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Provide accurate, current, and complete registration information.</li>
            <li>Maintain the confidentiality of your account credentials and password.</li>
            <li>Promptly notify us of any unauthorized use or security breach of your account.</li>
            <li>Accept full responsibility for all activities and entries submitted under your organization account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Subscriptions, Event Passes & Payments</h2>
          <p>
            Access to event scoring and publication features is sold on an explicit, non-recurring basis:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>
              <strong>Event Passes ($50):</strong> One-time fee crediting single-event live scoring and public results retention for 30 days.
            </li>
            <li>
              <strong>Standard Season Pass ($200):</strong> One-time fee per calendar season for dedicated tracks or series (up to 3 tracks or series).
            </li>
            <li>
              <strong>Premium Season Pass ($250):</strong> One-time fee per calendar season providing unlimited events across tracks and traveling series.
            </li>
          </ul>
          <p>
            All payments are processed securely through Stripe. Prices are listed in U.S. Dollars (USD) and exclude applicable
            taxes unless explicitly stated. Because passes are one-time purchases, there are no hidden recurring renewals.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">5. Race Data Ownership & Publication License</h2>
          <p>
            Organizers retain ownership of their proprietary event details, contestant rosters, and competition rules.
            By entering scores or marking races live on RaceHoller, you grant RaceHoller a non-exclusive, worldwide,
            royalty-free license to host, display, broadcast, and distribute public spectator leaderboards, results,
            and season standings across our network.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">6. Offline Scoring & Network Continuity</h2>
          <p>
            RaceHoller incorporates offline-first progressive storage to allow scorekeepers to enter attempt times when
            local internet or cellular service is degraded. The user acknowledges that scores recorded on a local device
            remain stored on that specific device until connectivity is restored and synchronized. RaceHoller is not
            liable for data loss resulting from cleared browser caches, physical hardware failure, or device loss before
            cloud synchronization completes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Interfere with, disable, or tamper with the security features of the platform or deterministic scoring engines.</li>
            <li>Falsify competition results or misuse official publication snapshots.</li>
            <li>Engage in automated scraping, reverse engineering, or denial-of-service attacks against RaceHoller infrastructure.</li>
            <li>Resell or redistribute RaceHoller services without express written authorization.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">8. Disclaimer of Warranties & Limitation of Liability</h2>
          <p>
            RaceHoller is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We disclaim all warranties, express or
            implied, including fitness for a particular purpose and non-infringement. In no event shall RaceHoller, its
            officers, directors, or affiliates be liable for indirect, incidental, special, consequential, or punitive damages,
            or any loss of competition prize money, track revenue, or participant goodwill arising from timing system discrepancies
            or platform interruptions. Our aggregate liability shall not exceed the amount paid by you to RaceHoller in the preceding 12 months.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">9. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Material changes will be communicated via notice on our
            website or via email. Continued use of RaceHoller after modifications constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">10. Contact Us</h2>
          <p>
            For questions regarding these Terms of Service, please contact us at:
            <br />
            <strong className="text-white">Email:</strong>{' '}
            <a href="mailto:support@raceholler.com" className="text-amber-400 hover:underline">
              support@raceholler.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
