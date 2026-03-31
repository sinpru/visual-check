import React from 'react';
import Link from 'next/link';
import { ResultEntry } from '@visual-check/core';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from './StatusBadge';
import { cn } from '@/lib/utils';
import { formatDiffPercent } from '@/lib/format';

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
      <Card className="group overflow-hidden border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl bg-white h-full flex flex-col">
        <div className="relative aspect-video bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
          <img
            src={imageUrl(thumbnailPath)}
            alt={result.testName}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-4 right-4">
            <StatusBadge status={result.status} className="shadow-sm" />
          </div>
        </div>
        <CardContent className="p-5 grow flex flex-col justify-between">
          <div className="space-y-1 mb-4">
            <h3 className="font-black text-slate-900 truncate tracking-tight">
              {result.testName}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {result.viewport.width} × {result.viewport.height}
            </p>
          </div>

          {result.status !== 'pass' && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Difference
              </span>
              <span
                className={cn(
                  'text-sm font-black font-mono',
                  result.diffPercent > 0
                    ? 'text-destructive'
                    : 'text-slate-900',
                )}
              >
                {formatDiffPercent(result.diffPercent)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};

export default SnapshotCard;
