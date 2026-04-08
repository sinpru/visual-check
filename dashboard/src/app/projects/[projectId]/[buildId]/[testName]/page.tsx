import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readResults } from '@visual-check/core';
import StatusBadge from '@/components/StatusBadge';
import ApproveRejectBar from '@/components/ApproveRejectBar';
import DiffViewerPage from '@/components/DiffViewerPage';
import {
  ChevronLeft,
  Calendar,
  Maximize2,
  FileDigit,
  Clock,
} from 'lucide-react';
import { formatDiffPercent, relativeTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ projectId: string; buildId: string; testName: string }>;
}

export default async function TestPage({ params }: PageProps) {
  const { projectId, buildId, testName } = await params;

  const results = await readResults(buildId);
  const result = results.find((r) => r.testName === testName);
  if (!result) return notFound();

  const currentIndex = results.findIndex((r) => r.testName === testName);
  const nextSnapshot =
    currentIndex < results.length - 1
      ? results[currentIndex + 1].testName
      : undefined;
  const prevSnapshot =
    currentIndex > 0 ? results[currentIndex - 1].testName : undefined;

  const formattedDate = new Date(
    result.updatedAt || result.timestamp,
  ).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <main className="py-10 px-6 lg:px-10">
      {/* Back */}
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}/${buildId}`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-all hover:-translate-x-1"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Build Overview
        </Link>
      </div>

      {/* Header card */}
      <div className="mb-8">
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

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-6">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Diff %
              </p>
              <p
                className={`text-3xl font-black font-mono ${result.diffPercent > 0 ? 'text-destructive' : 'text-slate-900'}`}
              >
                {formatDiffPercent(result.diffPercent)}
              </p>
            </div>
            <div className="h-10 w-px bg-slate-100" />
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Pixels
              </p>
              <div className="flex items-center gap-2">
                <FileDigit className="w-4 h-4 text-slate-400" />
                <p className="text-xl font-bold text-slate-900">
                  {result.diffPixels.toLocaleString()}
                </p>
              </div>
            </div>
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
      </div>

      {/*
        DiffViewerPage is a 'use client' component that owns the region selection
        state and renders the two-column layout: DiffViewer (left) + InspectionPanel (right).
      */}
      <div className="-mx-6 lg:-mx-10 border-y border-slate-200 bg-white">
        <DiffViewerPage
          testName={result.testName}
          buildId={buildId}
          baselinePath={result.baselinePath}
          currentPath={result.currentPath}
          diffPath={result.diffPath ?? ''}
          baselineWidth={result.viewport.width}
          baselineHeight={result.viewport.height}
          currentWidth={result.viewport.width}
          currentHeight={result.viewport.height}
          diffRegions={result.diffRegions ?? []}
        />
      </div>

      <ApproveRejectBar
        testName={result.testName}
        buildId={buildId}
        status={result.status}
        nextSnapshot={nextSnapshot}
        prevSnapshot={prevSnapshot}
        projectId={projectId}
      />
    </main>
  );
}
