'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, Image as ImageIcon, Info } from 'lucide-react';
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
  const [showOverlay, setShowOverlay] = useState(true);

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

        <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          <div className="flex items-center gap-2 pl-3 pr-2 text-sm font-black text-slate-600">
            <Layers className="h-4 w-4" />
            Diff Overlay
          </div>
          <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-xl">
            <button
              onClick={() => setShowOverlay(true)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-300',
                showOverlay
                  ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              ON
            </button>
            <button
              onClick={() => setShowOverlay(false)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-300',
                !showOverlay
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              OFF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonPanel
          label="Baseline"
          path={baselinePath}
          badge="Expected"
          description="The approved ground truth from Figma or previous runs."
        />
        <ComparisonPanel
          label="Current"
          path={currentPath}
          badge="Actual"
          description="The screenshot captured from the live application."
          overlayPath={diffPath}
          showOverlay={showOverlay}
        />
      </div>
    </div>
  );
};

interface ComparisonPanelProps {
  label: string;
  path: string;
  badge: string;
  description: string;
  overlayPath?: string;
  showOverlay?: boolean;
}

const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  label,
  path,
  badge,
  description,
  overlayPath,
  showOverlay,
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

      <Card className="overflow-hidden border-slate-200 shadow-md group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-500 rounded-[2rem] bg-white ring-1 ring-slate-100">
        <CardContent className="p-2 sm:p-4 min-h-100 flex items-center justify-center">
          {path ? (
            <div className="w-full h-full bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100 p-1">
              <div className="relative aspect-auto">
                <Image
                  src={imageUrl(path)}
                  alt={label}
                  width={1920}
                  height={1080}
                  unoptimized
                  className="w-full h-auto object-contain block"
                />
                {overlayPath && (
                  <Image
                    src={imageUrl(overlayPath)}
                    alt={`${label} Overlay`}
                    width={1920}
                    height={1080}
                    unoptimized
                    className={cn(
                      'absolute inset-0 w-full h-auto object-contain block mix-blend-multiply transition-opacity duration-300',
                      showOverlay ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                )}
              </div>
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default DiffViewer;
