import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ResultEntry } from '@visual-check/core';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import { cn } from '@/lib/utils';
import { formatDiffPercent } from '@/lib/format';
import { Maximize2 } from 'lucide-react';

interface SnapshotCardProps {
  result: ResultEntry;
  buildId: string;
}

const SnapshotCard: React.FC<SnapshotCardProps> = ({ result, buildId }) => {
  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  const thumbnailPath =
    result.status === 'pass' || result.status === 'approved'
      ? result.currentPath
      : result.diffPath || result.currentPath;

  return (
    <Link href={`/builds/${buildId}/${result.testName}`}>
      <Card className="group overflow-hidden border-slate-200/60 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 rounded-3xl bg-white h-full flex flex-col">
        <div className="relative h-64 bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
          <div className="absolute inset-0 bg-grid-slate-100/50 mask-[linear-gradient(to_bottom,white,transparent)]" />

          <Image
            src={imageUrl(thumbnailPath)}
            alt={result.testName}
            width={400}
            height={225}
            unoptimized
            className="relative z-10 w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 p-4"
          />

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 z-20 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-white/90 shadow-xl flex items-center justify-center scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500">
              <Maximize2 className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="absolute top-4 right-4 z-30">
            <StatusBadge
              status={result.status}
              className="shadow-lg backdrop-blur-md bg-white/80"
            />
          </div>
        </div>

        <CardContent className="p-6 grow flex flex-col justify-between relative bg-white">
          <div className="space-y-1.5 mb-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-black text-slate-900 truncate tracking-tight text-lg">
                {result.testName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                {result.viewport.width} × {result.viewport.height}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {result.status !== 'pass' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <span>Visual Difference</span>
                  <span
                    className={cn(
                      result.diffPercent > 0
                        ? 'text-destructive'
                        : 'text-slate-900',
                    )}
                  >
                    {formatDiffPercent(result.diffPercent)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                  <div
                    className={cn(
                      'h-full transition-all duration-1000',
                      result.diffPercent > 0
                        ? 'bg-destructive'
                        : 'bg-green-500',
                    )}
                    style={{
                      width: `${Math.min(result.diffPercent * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
                Review changes
              </span>
              <Maximize2 className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default SnapshotCard;
