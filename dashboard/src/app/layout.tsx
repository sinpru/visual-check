import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Visual Check — Percy-style Visual Testing',
  description:
    'Review and manage visual changes between Figma baselines and Playwright screenshots.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 antialiased">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col">
              {/* Mobile Header & Sidebar Trigger */}
              <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 flex items-center px-6 gap-4">
                <SidebarTrigger className="lg:flex" />
                <div className="lg:hidden flex items-center gap-2">
                  <Link href="/builds" className="flex items-center gap-2">
                    <div className="bg-primary h-6 w-6 rounded-lg flex items-center justify-center">
                      <LayoutGrid className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-lg font-black tracking-tighter">
                      Visual Check
                    </span>
                  </Link>
                </div>
              </header>

              <div className="grow">{children}</div>

            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
