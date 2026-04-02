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
  projectId?: string;
}

const SnapshotCard: React.FC<SnapshotCardProps> = ({ result, buildId, projectId }) => {
  const imageUrl = (path: string) =>
    `/api/image?path=${encodeURIComponent(path)}`;

  const thumbnailPath =
    result.status === 'pass' || result.status === 'approved'
      ? result.currentPath
      : result.diffPath || result.currentPath;

  const href = projectId
    ? `/projects/${projectId}/${buildId}/${result.testName}`
    : `/projects/_/${buildId}/${result.testName}`;

  return (
    <Link href={href}>
      <Card className="group overflow-hidden border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl bg-white h-full flex flex-col">
        <div className="relative h-56 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
          <Image
            src={imageUrl(thumbnailPath)}
            alt={result.testName}
            width={400}
            height={225}
            unoptimized
            className="relative z-10 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 p-4"
          />

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 z-20 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300">
              <Maximize2 className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="absolute top-3 right-3 z-30">
            <StatusBadge
              status={result.status}
              className="shadow-sm backdrop-blur-sm bg-white/90"
            />
          </div>
        </div>

        <CardContent className="p-5 grow flex flex-col justify-between relative bg-white">
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold text-gray-900 truncate tracking-tight text-base">
                {result.testName}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-gray-50 text-[10px] font-medium text-gray-400 uppercase tracking-wider border border-gray-100">
                {result.viewport.width} × {result.viewport.height}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {result.status !== 'pass' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Visual Difference</span>
                  <span
                    className={cn(
                      result.diffPercent > 0
                        ? 'text-red-600'
                        : 'text-gray-900',
                    )}
                  >
                    {formatDiffPercent(result.diffPercent)}
                  </span>
                </div>
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                  <div
                    className={cn(
                      'h-full transition-all duration-700',
                      result.diffPercent > 0
                        ? 'bg-red-500'
                        : 'bg-emerald-500',
                    )}
                    style={{
                      width: `${Math.min(result.diffPercent * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform">
                Review changes
              </span>
              <Maximize2 className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default SnapshotCard;

