'use client';

import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import DiffViewer from '@/components/DiffViewer';
import type { DiffRegion } from '@visual-check/core';

interface DiffViewerPageProps {
  testName: string;
  baselinePath: string;
  currentPath: string;
  diffPath?: string;
  baselineWidth?: number;
  baselineHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  diffRegions: DiffRegion[];
}

export default function DiffViewerPage({
  testName,
  baselinePath, currentPath, diffPath,
  baselineWidth, baselineHeight, currentWidth, currentHeight,
  diffRegions,
}: DiffViewerPageProps) {
  const [activeRegion, setActiveRegion] = useState<DiffRegion | null>(null);
  const hasRegions = diffRegions.length > 0;

  return (
    // Two-column layout: DiffViewer fills the left, InspectionPanel is fixed-width right column.
    // The right column is always rendered (holds its width) so the DiffViewer never jumps when
    // a region is selected. It just shows a placeholder when nothing is selected.
    <div className="flex min-h-0">

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

      {/* ── RIGHT: Inspection panel — only rendered when there are regions ── */}
      {hasRegions && (
        <div className="w-72 shrink-0 border-l border-slate-100 flex flex-col">

          {/* Panel header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 shrink-0">
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

          {/* Region list — always visible, clicking selects / deselects */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-1 shrink-0">
            {diffRegions.map((region) => {
              const isActive = activeRegion?.index === region.index;
              return (
                <button
                  key={region.index}
                  onClick={() => setActiveRegion(isActive ? null : region)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all w-full',
                    isActive
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-700',
                  )}
                >
                  <span className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                    isActive ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600',
                  )}>
                    {region.index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[11px] font-black truncate', isActive ? 'text-white' : 'text-slate-700')}>
                      {region.domLabel
                        ? region.domLabel.split(' — ')[0]
                        : `Region ${region.index + 1}`}
                    </p>
                    <p className={cn('text-[10px] font-mono', isActive ? 'text-white/70' : 'text-slate-400')}>
                      {region.diffPixels.toLocaleString()} px
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel — shown when a region is selected */}
          <div className="flex-1 overflow-y-auto">
            {activeRegion ? (
              <div className="p-5 space-y-5">

                {/* Region heading */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
                    <span className="text-sm font-black text-slate-900">
                      Region {activeRegion.index + 1}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium pl-4">
                    Click the pin on the image to deselect
                  </p>
                </div>

                <DetailRow label="Position">
                  <code className="text-xs text-slate-700">
                    ({activeRegion.x}, {activeRegion.y})
                  </code>
                </DetailRow>

                <DetailRow label="Size">
                  <code className="text-xs text-slate-700">
                    {activeRegion.width} × {activeRegion.height} px
                  </code>
                </DetailRow>

                <DetailRow label="Changed pixels">
                  <span className="text-xs font-mono text-slate-700">
                    {activeRegion.diffPixels.toLocaleString()}
                    <span className="text-slate-400 ml-1.5">
                      ({activeRegion.diffPercent.toFixed(2)}% of image)
                    </span>
                  </span>
                </DetailRow>

                {activeRegion.domLabel && (
                  <DetailRow label="Web element">
                    <code className="text-[11px] text-violet-700 bg-violet-50 px-2.5 py-1.5 rounded-xl break-all leading-relaxed block">
                      {activeRegion.domLabel}
                    </code>
                  </DetailRow>
                )}

                {activeRegion.figmaLabel && (
                  <DetailRow label="Design node">
                    <code className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl break-all block">
                      {activeRegion.figmaLabel}
                    </code>
                  </DetailRow>
                )}

                {(activeRegion.deltaX != null || activeRegion.deltaY != null) && (
                  <DetailRow label="Shift">
                    <span className="text-xs font-mono text-slate-700">
                      {activeRegion.deltaX != null
                        ? `Δx ${activeRegion.deltaX > 0 ? '+' : ''}${activeRegion.deltaX}px  `
                        : ''}
                      {activeRegion.deltaY != null
                        ? `Δy ${activeRegion.deltaY > 0 ? '+' : ''}${activeRegion.deltaY}px`
                        : ''}
                    </span>
                  </DetailRow>
                )}

                {!activeRegion.domLabel && !activeRegion.figmaLabel && activeRegion.deltaX == null && (
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">
                    No element info available. DOM lookup runs during Playwright — re-run the test to populate this.
                  </p>
                )}

              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
                <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <MapPin className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-xs font-black text-slate-500 mb-1">Select a region</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Click a numbered pin on the image or a region in the list above to inspect it.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{label}</p>
      {children}
    </div>
  );
}