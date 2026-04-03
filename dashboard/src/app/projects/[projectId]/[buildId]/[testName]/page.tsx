import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readResults } from '@visual-check/core';
import DiffViewer from '@/components/DiffViewer';
import StatusBadge from '@/components/StatusBadge';
import ApproveRejectBar from '@/components/ApproveRejectBar';
import {
  ChevronLeft,
  Calendar,
  Maximize2,
  FileDigit,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDiffPercent, relativeTime } from '@/lib/format';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    buildId: string;
    testName: string;
  }>;
}

export default async function TestPage({ params }: PageProps) {
  const { buildId, testName } = await params;

  const results = await readResults(buildId);
  const result  = results.find((r) => r.testName === testName);

  console.log('DEBUG: Found Result Keys:', Object.keys(result || {}));
  console.log('DEBUG: diffRegions length:', result?.diffRegions?.length);

  if (!result) return notFound();

  const currentIndex = results.findIndex((r) => r.testName === testName);
  const nextSnapshot = currentIndex !== -1 && currentIndex < results.length - 1
    ? results[currentIndex + 1].testName
    : undefined;
  const prevSnapshot = currentIndex > 0
    ? results[currentIndex - 1].testName
    : undefined;

  const formattedDate = new Date(result.updatedAt || result.timestamp).toLocaleString(
    undefined,
    { dateStyle: 'medium', timeStyle: 'short' },
  );

  return (
    <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pb-48">
      <div className="mb-10">
        <Link
          href={`/builds/${buildId}`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all hover:-translate-x-1"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Build Overview
        </Link>
      </div>

      <Card className="bg-white border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden rounded-3xl mb-12">
        <CardHeader className="border-b border-slate-200/60 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {result.testName}
                </h1>
                <StatusBadge status={result.status} className="scale-110" />
              </div>
              <div className="flex flex-wrap items-center gap-6 text-slate-500 font-medium text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {relativeTime(result.timestamp)}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {formattedDate}
                </div>
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-slate-400" />
                  {result.viewport.width} × {result.viewport.height}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Diff Percent
                </p>
                <p className={`text-3xl font-black font-mono ${
                  result.diffPercent > 0 ? 'text-destructive' : 'text-slate-900'
                }`}>
                  {formatDiffPercent(result.diffPercent)}
                </p>
              </div>
              <div className="h-10 w-px bg-slate-100" />
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Pixels Changed
                </p>
                <div className="flex items-center gap-2">
                  <FileDigit className="w-4 h-4 text-slate-400" />
                  <p className="text-xl font-bold text-slate-900">
                    {result.diffPixels.toLocaleString()}
                  </p>
                </div>
              </div>
              {/* Region count badge — only shown when regions were extracted */}
              {result.diffRegions && result.diffRegions.length > 0 && (
                <>
                  <div className="h-10 w-px bg-slate-100" />
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Regions
                    </p>
                    <p className="text-xl font-bold text-orange-500">
                      {result.diffRegions.length}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 bg-white">
          <DiffViewer
            testName={result.testName}
            baselinePath={result.baselinePath}
            currentPath={result.currentPath}
            diffPath={result.diffPath ?? ''}
            baselineWidth={result.viewport.width}
            baselineHeight={result.viewport.height}
            currentWidth={result.viewport.width}
            currentHeight={result.viewport.height}
            diffRegions={result.diffRegions ?? []}
          />
        </CardContent>
      </Card>

      <ApproveRejectBar
              testName={result.testName}
              buildId={buildId}
              status={result.status}
              nextSnapshot={nextSnapshot}
              prevSnapshot={prevSnapshot} projectId={''}      />
    </main>
  );
}