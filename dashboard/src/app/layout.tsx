import { Roboto, Poppins, Inconsolata } from 'next/font/google';
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

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const inconsolata = Inconsolata({
  variable: '--font-inconsolata',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata = {
  title: 'Visual Check — Visual Regression Testing',
  description:
    'Review and manage visual changes between Figma baselines and Playwright screenshots.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto.variable} ${poppins.variable} ${inconsolata.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900 antialiased">
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="flex flex-col">
              {/* Mobile Header & Sidebar Trigger */}
              <header className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 flex items-center px-6 gap-4">
                <SidebarTrigger className="lg:flex" />
                <div className="lg:hidden flex items-center gap-2">
                  <Link href="/" className="flex items-center gap-2">
                    <div className="bg-primary h-6 w-6 rounded-lg flex items-center justify-center">
                      <LayoutGrid className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight font-display">
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
