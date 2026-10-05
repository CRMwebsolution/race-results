import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackScore - Standalone Race Results SaaS",
  description: "Deterministic race scoring, live standings, and multi-tenant track management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
