'use client';

import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, Columns, Image as ImageIcon } from 'lucide-react';
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

  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Visual Comparison
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            Inspect the changes pixel-by-pixel.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
              viewMode === 'side-by-side'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            <Columns className="h-4 w-4" />
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode('overlay')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
              viewMode === 'overlay'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            <Layers className="h-4 w-4" />
            Overlay
          </button>
        </div>
      </div>

      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <ComparisonPanel
            label="Baseline"
            path={baselinePath}
            badge="Expected"
          />
          <ComparisonPanel label="Current" path={currentPath} badge="Actual" />
          <ComparisonPanel
            label="Difference"
            path={diffPath}
            badge="Changes"
            isDiff
          />
        </div>
      ) : (
        <div className="space-y-8 max-w-5xl mx-auto">
          <Card className="overflow-hidden border-slate-200/60 shadow-xl rounded-3xl bg-slate-50/50">
            <CardContent className="p-0 relative aspect-16/10 sm:aspect-auto sm:min-h-150 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="relative w-full h-full bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
                  <img
                    src={imageUrl(baselinePath)}
                    alt="Baseline"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <img
                    src={imageUrl(currentPath)}
                    alt="Current"
                    className="absolute inset-0 w-full h-full object-contain transition-opacity duration-75"
                    style={{ opacity: opacity[0] / 100 }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">
                    Overlay Controls
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Adjust visibility to spot differences
                  </p>
                </div>
              </div>
              <span className="text-sm font-black font-mono bg-slate-100 px-3 py-1 rounded-full text-slate-600">
                {opacity[0]}%
              </span>
            </div>

            <Slider
              value={opacity}
              onValueChange={(val) => setOpacity(val as number[])}
              max={100}
              step={1}
              className="py-4"
            />

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
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
  isDiff?: boolean;
}

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  label,
  path,
  badge,
  isDiff,
}) => {
  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  return (
    <div className="space-y-4 group">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-black text-slate-900 tracking-tight">{label}</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
          {badge}
        </span>
      </div>

      <Card className="overflow-hidden border-slate-200/60 shadow-sm group-hover:shadow-md transition-all duration-300 rounded-3xl bg-slate-50/50">
        <CardContent className="p-4 aspect-video flex items-center justify-center">
          {path ? (
            <div className="relative w-full h-full bg-white rounded-lg shadow-sm overflow-hidden border border-slate-100">
              <img
                src={imageUrl(path)}
                alt={label}
                className={cn(
                  'w-full h-full object-contain',
                  isDiff && 'mix-blend-multiply',
                )}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-300">
              <ImageIcon className="h-12 w-12 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-widest">
                No changes
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DiffViewer;
