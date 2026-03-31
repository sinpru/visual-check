import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LayoutGrid, History, Settings, ExternalLink } from 'lucide-react';

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
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 border-r border-slate-200 bg-white hidden lg:flex flex-col sticky top-0 h-screen">
            <div className="p-8">
              <Link href="/builds" className="flex items-center gap-3">
                <div className="bg-primary h-8 w-8 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <LayoutGrid className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-black tracking-tighter">
                  Visual Check
                </span>
              </Link>
            </div>

            <nav className="grow px-4 space-y-1">
              <Link
                href="/builds"
                className="flex items-center gap-3 px-4 py-3 text-sm font-black text-slate-900 bg-slate-50 rounded-2xl transition-all"
              >
                <History className="h-4 w-4 text-primary" />
                Builds
              </Link>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 rounded-2xl transition-all cursor-not-allowed">
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </nav>

            <div className="p-4 border-t border-slate-100">
              <a
                href="https://github.com"
                target="_blank"
                className="flex items-center justify-between px-4 py-4 bg-slate-900 rounded-2xl text-white text-xs font-black transition-all hover:bg-slate-800"
              >
                <span>Documentation</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </aside>

          {/* Main Content */}
          <div className="grow flex flex-col">
            <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 lg:hidden flex items-center px-6">
              <Link href="/builds" className="flex items-center gap-2">
                <div className="bg-primary h-6 w-6 rounded-lg flex items-center justify-center">
                  <LayoutGrid className="h-3 w-3 text-white" />
                </div>
                <span className="text-lg font-black tracking-tighter">
                  Visual Check
                </span>
              </Link>
            </header>

            <div className="grow">{children}</div>

            <footer className="py-12 border-t border-slate-200 bg-white px-8">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                <p className="text-sm font-medium text-slate-500">
                  © 2026 Visual Check. Built for pixel perfection.
                </p>
                <div className="flex items-center gap-8">
                  <Link
                    href="/builds"
                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                  >
                    Support
                  </Link>
                  <Link
                    href="/builds"
                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
                  >
                    Status
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
