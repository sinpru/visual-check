'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import {
  Layers,
  Columns,
  Image as ImageIcon,
  Info,
  GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  testName: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  testName,
  baselinePath,
  currentPath,
  diffPath,
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>(
    'side-by-side',
  );
  const [opacity, setOpacity] = useState([50]);
  const [showDiff, setShowDiff] = useState(false);

  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  return (
    <div className="space-y-12 pb-32">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 pb-8 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Visual Comparison
            <Info className="h-5 w-5 text-slate-300" />
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            Compare the baseline with the current snapshot to identify
            regressions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {diffPath && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-300 border',
                showDiff
                  ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900 hover:border-slate-300',
              )}
            >
              <GitCompare className="h-4 w-4" />
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300',
                viewMode === 'side-by-side'
                  ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50',
              )}
            >
              <Columns className="h-4 w-4" />
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all duration-300',
                viewMode === 'overlay'
                  ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white/50',
              )}
            >
              <Layers className="h-4 w-4" />
              Overlay
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComparisonPanel
            label="Baseline"
            path={baselinePath}
            badge="Expected"
            description="The approved ground truth from Figma or previous runs."
          />
          <ComparisonPanel
            label={showDiff ? 'Difference' : 'Current'}
            path={showDiff ? diffPath : currentPath}
            badge={showDiff ? 'Diff' : 'Actual'}
            description={
              showDiff
                ? 'Highlighting pixels that differ from the baseline.'
                : 'The screenshot captured from the live application.'
            }
            isDiff={showDiff}
          />
        </div>
      ) : (
        <div className="space-y-12 max-w-350 mx-auto">
          <div className="overflow-hidden border-slate-200 shadow-2xl rounded-[2.5rem] bg-white ring-1 ring-slate-200/50p-4 md:p-6 min-h-[600px] flex items-center justify-center">
            <div className="rounded-2xl overflow-hidden group-hover:-translate-y-2 transition-all duration-500">
              <Image
                src={imageUrl(baselinePath)}
                alt="Baseline"
                width={1920}
                height={1080}
                unoptimized
                className="w-full h-auto object-contain block"
              />
              <Image
                src={imageUrl(currentPath)}
                alt="Current"
                width={1920}
                height={1080}
                unoptimized
                className="absolute inset-0 w-full h-auto object-contain transition-opacity duration-150"
                style={{ opacity: opacity[0] / 100 }}
              />
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-8 max-w-2xl mx-auto ring-1 ring-slate-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Opacity Controller
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    Slide to toggle between baseline and current
                  </p>
                </div>
              </div>
              <span className="text-lg font-black font-mono bg-slate-50 px-4 py-2 rounded-2xl text-primary border border-slate-100 shadow-inner">
                {opacity[0]}%
              </span>
            </div>

            <Slider
              value={opacity}
              onValueChange={(val) => setOpacity(val as number[])}
              max={100}
              step={1}
              className="py-6"
            />

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">
              <span>Baseline (Under)</span>
              <span>Current (Over)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ComparisonPanelProps {
  label: string;
  path: string;
  badge: string;
  description: string;
  isDiff?: boolean;
}

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  label,
  path,
  badge,
  description,
  isDiff,
}) => {
  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  return (
    <div className="space-y-6 group">
      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-primary transition-colors">
            {label}
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            {badge}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden group-hover:-translate-y-2 transition-all duration-500">
        {path ? (
          <Image
            src={imageUrl(path)}
            alt={label}
            width={1920}
            height={1080}
            unoptimized
            className={cn(
              'w-full h-auto object-contain block',
              isDiff && 'mix-blend-multiply',
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-200">
            <div className="p-6 bg-slate-100 rounded-full">
              <ImageIcon className="h-12 w-12 opacity-50" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              No visual changes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;
