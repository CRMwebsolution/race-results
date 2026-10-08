import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy - RaceHoller',
  description: 'How RaceHoller collects, uses, and protects personal and race competition information.',
};

export default function PrivacyPolicyPage() {
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
          <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Lock className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">Privacy Policy</h1>
            <p className="text-xs text-slate-400">Last updated: October 8, 2026</p>
          </div>
        </div>
      </div>

      <div className="prose prose-invert prose-slate max-w-none text-slate-300 space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">1. Introduction</h2>
          <p>
            RaceHoller (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) values your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our website, mobile interface,
            and race management SaaS services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
          <p>We collect information in the following categories:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>
              <strong>Account & Profile Information:</strong> When you register as an organizer or accept a race staff invite,
              we collect your email address, organization name, track/series name, and account password (stored securely via bcrypt/Argon2 hashing).
            </li>
            <li>
              <strong>Competition & Entry Data:</strong> Information entered by race organizers or scorekeepers, including racer
              names, vehicle/car numbers, vehicle classes, elapsed times, distances, penalties, and official competition outcomes.
            </li>
            <li>
              <strong>Billing & Payment Information:</strong> Payment transactions are handled directly through Stripe.
              RaceHoller receives tokenized confirmation receipts, customer reference IDs, and subscription dates.
              <em>We do not store or process raw credit card numbers or bank credentials on our servers.</em>
            </li>
            <li>
              <strong>Offline & Device Data:</strong> Local IndexedDB stores device identifiers and transient offline scoring packets
              to support race scoring when cellular or Wi-Fi signal drops at remote tracks.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Operate, calculate, and publish deterministic race scoring leaderboards and bracket ladders.</li>
            <li>Provide real-time live spectator feeds, pit displays, and championship points standings.</li>
            <li>Manage account authentication, staff role permissions, and offline synchronization.</li>
            <li>Process payments, activate plan credits, and prevent billing fraud.</li>
            <li>Respond to customer support requests and communicate service updates.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">4. Public Information (Spectator Feeds)</h2>
          <p>
            RaceHoller is designed to provide transparent, real-time race timing. By design, race names, contestant names,
            seeds, round matchups, elapsed run times, and championship placement points are published publicly on spectator
            URLs (`/r/[trackSlug]/[eventSlug]` and `/s/[seriesId]`) once published by the event organizer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">5. Information Sharing and Disclosure</h2>
          <p>
            We do not sell, rent, or trade your personal information to third parties. We share information only with:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>
              <strong>Service Providers:</strong> Trusted infrastructure partners who support our platform, including
              Supabase (database hosting & authentication) and Stripe (payment processing).
            </li>
            <li>
              <strong>Legal Compliance:</strong> When required by law, subpoena, or to protect the safety and rights of RaceHoller,
              our users, or the public.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">6. Data Security</h2>
          <p>
            We implement industry-standard administrative, technical, and physical security measures, including:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
            <li>Database-level Row Level Security (RLS) ensuring strict multi-tenant boundary isolation.</li>
            <li>TLS 1.3 encrypted data in transit across all web and API endpoints.</li>
            <li>HMAC signature verification for payment webhook processing.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">7. Your Privacy Rights</h2>
          <p>
            You have the right to request access to the personal data we hold about you, request corrections to inaccurate data,
            or request the deletion of your organizer account. To exercise these rights, please contact us at{' '}
            <a href="mailto:support@raceholler.com" className="text-amber-400 hover:underline">
              support@raceholler.com
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white">8. Contact Information</h2>
          <p>
            For privacy inquiries or data requests, contact us at:
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
