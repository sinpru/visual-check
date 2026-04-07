'use client';

import { useState } from 'react';
import {
  MapPin,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DiffViewer from '@/components/DiffViewer';
import type { DiffRegion } from '@visual-check/core';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiffViewerPageProps {
  testName: string;
  buildId: string;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  baselineWidth?: number;
  baselineHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  diffRegions: DiffRegion[];
}

type AnalysisState = 'idle' | 'loading' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiffViewerPage({
  testName,
  buildId,
  baselinePath,
  currentPath,
  diffPath,
  baselineWidth,
  baselineHeight,
  currentWidth,
  currentHeight,
  diffRegions,
}: DiffViewerPageProps) {
  const [activeRegion, setActiveRegion] = useState<DiffRegion | null>(null);
  const hasRegions = diffRegions.length > 0;

  // Local description cache — merges with server-persisted region.aiDescription.
  // Key: region.index. Value: description string.
  // This means descriptions show immediately after the API call without a page reload,
  // AND come back from the server on the next render (from results.json via props).
  const [localDescriptions, setLocalDescriptions] = useState<
    Record<number, string>
  >({});
  const [analysisStates, setAnalysisStates] = useState<
    Record<number, AnalysisState>
  >({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<number, string>>(
    {},
  );

  // ── Active region helpers ─────────────────────────────────────────────────

  // Get the current description for a region:
  // 1. Local cache (set after successful API call this session)
  // 2. Server-persisted value from results.json (comes in via props)
  function getDescription(region: DiffRegion): string | undefined {
    return localDescriptions[region.index] ?? region.aiDescription ?? undefined;
  }

  function getAnalysisState(region: DiffRegion): AnalysisState {
    return analysisStates[region.index] ?? 'idle';
  }

  // ── AI analysis call ─────────────────────────────────────────────────────

  async function analyzeRegion(region: DiffRegion) {
    setAnalysisStates((prev) => ({ ...prev, [region.index]: 'loading' }));
    setAnalysisErrors((prev) => {
      const n = { ...prev };
      delete n[region.index];
      return n;
    });

    try {
      const res = await fetch('/api/analyze-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName,
          buildId,
          regionIndex: region.index,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      setLocalDescriptions((prev) => ({
        ...prev,
        [region.index]: data.description,
      }));
      setAnalysisStates((prev) => ({ ...prev, [region.index]: 'idle' }));

      // Keep the active region in sync so the panel re-renders with the new description
      if (activeRegion?.index === region.index) {
        setActiveRegion({ ...region, aiDescription: data.description });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAnalysisErrors((prev) => ({ ...prev, [region.index]: message }));
      setAnalysisStates((prev) => ({ ...prev, [region.index]: 'error' }));
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT: DiffViewer ── */}
        <div className={cn('flex-1 min-w-0 p-8', hasRegions ? 'pr-4' : '')}>
          <DiffViewer
            testName={testName}
            baselinePath={baselinePath}
            currentPath={currentPath}
            diffPath={diffPath}
            baselineWidth={baselineWidth}
            baselineHeight={baselineHeight}
            currentWidth={currentWidth}
            currentHeight={currentHeight}
            diffRegions={diffRegions}
            onRegionSelect={setActiveRegion}
            activeRegionIndex={activeRegion?.index ?? null}
          />
        </div>

        {/* ── RIGHT: Region list — only when regions exist ── */}
        {hasRegions && (
          <div className="w-72 shrink-0 border-l border-slate-100 flex flex-col bg-slate-50/50">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Inspection
              </span>
              {activeRegion && (
                <button
                  onClick={() => setActiveRegion(null)}
                  className="ml-auto h-6 w-6 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Region list */}
            <div className="px-4 py-3 flex-1 overflow-y-auto flex flex-col gap-1">
              {diffRegions.map((region) => {
                const isActive = activeRegion?.index === region.index;
                const hasDesc = !!getDescription(region);
                const isAnalyzing = getAnalysisState(region) === 'loading';

                return (
                  <button
                    key={region.index}
                    onClick={() => setActiveRegion(isActive ? null : region)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all w-full',
                      isActive
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'hover:bg-slate-100 text-slate-700 bg-white shadow-sm ring-1 ring-slate-200/50',
                    )}
                  >
                    <span
                      className={cn(
                        'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-orange-100 text-orange-600',
                      )}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        region.index + 1
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-[11px] font-black truncate',
                          isActive ? 'text-white' : 'text-slate-700',
                        )}
                      >
                        {region.aiLabel ??
                          region.figmaLabel ??
                          (region.domLabel
                            ? region.domLabel.split(' — ')[0]
                            : `Region ${region.index + 1}`)}
                      </p>
                      <p
                        className={cn(
                          'text-[10px] font-mono',
                          isActive ? 'text-white/70' : 'text-slate-400',
                        )}
                      >
                        {region.diffPixels.toLocaleString()} px
                        {hasDesc && (
                          <span
                            className={cn(
                              'ml-1.5 text-[9px] font-black',
                              isActive ? 'text-white/60' : 'text-emerald-500',
                            )}
                          >
                            ✦ AI
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM: Inspection panel for Active Region ── */}
      {activeRegion && (
        <div className="border-t border-slate-200 bg-slate-50 overflow-hidden shadow-[inset_0_4px_6px_-4px_rgba(0,0,0,0.05)]">
          <div className="max-w-7xl mx-auto">
            <ActiveRegionPanel
              region={activeRegion}
              description={getDescription(activeRegion)}
              analysisState={getAnalysisState(activeRegion)}
              analysisError={analysisErrors[activeRegion.index]}
              onAnalyze={() => analyzeRegion(activeRegion)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active region detail panel ───────────────────────────────────────────────

function ActiveRegionPanel({
  region,
  description,
  analysisState,
  analysisError,
  onAnalyze,
}: {
  region: DiffRegion;
  description?: string;
  analysisState: AnalysisState;
  analysisError?: string;
  onAnalyze: () => void;
}) {
  const isLoading = analysisState === 'loading';
  const hasDesc = !!description;

  return (
    <div className="p-5 space-y-5">
      {/* Region heading */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
          <span className="text-sm font-black text-slate-900">
            Region {region.index + 1}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-medium pl-4">
          Click the pin again to deselect
        </p>
      </div>

      {/* Property Diffs */}
      {(region.domMetrics || region.figmaMetrics) && (
        <div className="pt-2">
          <div className="grid grid-cols-[150px_1fr_1fr] gap-4 text-xs font-black uppercase tracking-widest text-slate-400 mb-2 px-3">
            <div>Property</div>
            <div>Figma (Expected)</div>
            <div>Web (Actual)</div>
          </div>
          <div className="space-y-1.5">
            {Array.from(
              new Set([
                ...Object.keys(region.domMetrics || {}),
                ...Object.keys(region.figmaMetrics || {}),
              ]),
            ).map((key) => {
              const expected =
                region.figmaMetrics?.[key as keyof typeof region.figmaMetrics];
              const actual =
                region.domMetrics?.[key as keyof typeof region.domMetrics];

              if (expected == null && actual == null) return null;
              if (
                expected != null &&
                actual != null &&
                String(expected) === String(actual)
              )
                return null; // Hide perfect matches to reduce noise

              return (
                <div
                  key={key}
                  className="grid grid-cols-[150px_1fr_1fr] gap-4 text-sm items-start border border-slate-200 rounded-xl p-3 bg-white shadow-sm"
                >
                  <div className="font-bold text-slate-600 capitalize mt-0.5">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="font-mono text-slate-600 wrap-break-word whitespace-pre-wrap">
                    {expected ?? '—'}
                  </div>
                  <div
                    className={cn(
                      'font-mono wrap-break-word whitespace-pre-wrap font-semibold',
                      expected !== actual ? 'text-red-600' : 'text-slate-700',
                    )}
                  >
                    {actual ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AI Analysis section ── */}
      <div className="pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              AI Analysis
            </span>
          </div>

          {/* Analyze / Re-analyze button */}
          <button
            onClick={onAnalyze}
            disabled={isLoading}
            title={hasDesc ? 'Re-analyze this region' : 'Analyze with AI'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all',
              isLoading
                ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                : hasDesc
                  ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing…
              </>
            ) : hasDesc ? (
              <>
                <RefreshCw className="h-3 w-3" />
                Re-analyze
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Error state */}
        {analysisState === 'error' && analysisError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mb-3">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-red-600 font-medium leading-relaxed">
              {analysisError}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !hasDesc && (
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 rounded-full animate-pulse w-full" />
            <div className="h-3 bg-slate-100 rounded-full animate-pulse w-4/5" />
            <div className="h-3 bg-slate-100 rounded-full animate-pulse w-3/5" />
          </div>
        )}

        {/* Description */}
        {hasDesc ? (
          <div
            className={cn(
              'text-[13px] text-slate-700 leading-relaxed bg-violet-50 border border-violet-100 rounded-xl p-4',
              isLoading && 'opacity-50',
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ node, ...props }) => (
                  <p className="mb-2 last:mb-0" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul
                    className="list-disc pl-4 mb-2 last:mb-0 space-y-1"
                    {...props}
                  />
                ),
                li: ({ node, ...props }) => <li {...props} />,
                strong: ({ node, ...props }) => (
                  <strong className="font-bold text-slate-900" {...props} />
                ),
                code: ({ node, ...props }) => (
                  <code
                    className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-violet-700"
                    {...props}
                  />
                ),
              }}
            >
              {description}
            </ReactMarkdown>
          </div>
        ) : (
          !isLoading && (
            <p className="text-[11px] text-slate-400 italic leading-relaxed">
              Click &quot;Analyze&quot; to get an AI description of what&apos;s
              visually different in this region.
            </p>
          )
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
      <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <MapPin className="h-4 w-4 text-slate-400" />
      </div>
      <p className="text-xs font-black text-slate-500 mb-1">Select a region</p>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Click a numbered pin on the image or a row in the list above to inspect
        it.
      </p>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </p>
      <p
        className={cn(
          'text-[11px] text-slate-700 font-bold',
          mono && 'font-mono',
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>
      )}
    </div>
  );
}
