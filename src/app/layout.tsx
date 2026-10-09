import {AccountSafety} from "@/components/account-safety";
import {BackNavigation} from "@/components/back-navigation";
import {Footer} from "@/components/footer";
import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const siteTitle = "RaceHoller - Standalone Race Results SaaS";
const siteDescription = "Follow live race results and championship standings with RaceHoller. Manage events, score every run, and publish official results for tracks and racing series.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://raceholler.com"),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: "RaceHoller",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="night" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:"try{var t=localStorage.getItem('raceholler:theme');if(t==='day'){document.documentElement.dataset.theme='day';document.documentElement.classList.remove('dark');}}catch(e){}"}}/></head>
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 min-h-screen flex flex-col">
        <AccountSafety/>
        <BackNavigation/>
        <div className="flex-1 w-full flex flex-col">{children}</div>
        <Footer/>
        <Analytics />
      </body>
    </html>
  );
}


