import {AccountSafety} from "@/components/account-safety";
import {BackNavigation} from "@/components/back-navigation";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaceHoller - Standalone Race Results SaaS",
  description: "Deterministic race scoring, live standings, and multi-tenant track management.",
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
        {children}
      </body>
    </html>
  );
}
