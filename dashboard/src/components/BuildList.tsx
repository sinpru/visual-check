'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import {
  GitBranch,
  GitCommit,
  ChevronRight,
  ImagePlus,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface BuildListProps {
  builds: BuildEntry[];
}

const BuildList: React.FC<BuildListProps> = ({ builds }) => {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, buildId: string) => {
    e.stopPropagation();
    if (
      !confirm(
        'Are you sure you want to delete this build? This action cannot be undone.',
      )
    ) {
      return;
    }

    setDeletingId(buildId);
    try {
      const res = await fetch(`/api/builds/${buildId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete build');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete build');
    } finally {
      setDeletingId(null);
    }
  };

  if (builds.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-2">No builds yet</h3>
        <p className="text-gray-500 font-normal max-w-sm mx-auto">
          Run your Playwright tests to create the first build and start
          reviewing changes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50 [&_th]:border-b-0">
            <TableHead className="w-70 font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3 px-4">
              Build
            </TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Context
            </TableHead>
            <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Status
            </TableHead>
            <TableHead className="text-right font-semibold uppercase tracking-wider text-[10px] text-gray-500 py-3">
              Stats
            </TableHead>
            <TableHead className="w-25 py-3 px-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {builds.map((build) => {
            const isFigma = build.branch === 'figma';

            return (
              <TableRow
                key={build.buildId}
                className="group cursor-pointer hover:bg-gray-50/60 transition-colors"
                onClick={() =>
                  router.push(`/projects/${build.projectId}/${build.buildId}`)
                }
              >
                <TableCell className="py-3 px-4 max-w-50">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-gray-900 group-hover:text-primary transition-colors tracking-tight text-sm truncate">
                      {build.buildId}
                    </span>
                    <div className="text-[11px] font-normal text-gray-400">
                      {relativeTime(build.createdAt)}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    {isFigma ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#1ABCFE]/10 text-[#0FA8E8] text-[11px] font-medium ring-1 ring-[#1ABCFE]/20">
                        <ImagePlus className="h-3 w-3" />
                        Figma baseline
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600">
                          <GitBranch className="h-3.5 w-3.5 text-gray-400" />
                          <span className="truncate max-w-30">
                            {build.branch || 'main'}
                          </span>
                        </div>
                        {build.commitHash && (
                          <div className="flex items-center gap-1.5">
                            <GitCommit className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-mono text-[10px] bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-200 text-gray-500">
                              {build.commitHash.substring(0, 7)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-3">
                  <StatusBadge status={build.status} />
                </TableCell>

                <TableCell className="py-3 text-right w-35">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-end gap-2 text-sm">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-gray-900">
                          {build.changedSnapshots}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                          Changed
                        </span>
                      </div>
                      <span className="text-gray-200 text-xs">/</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-gray-400">
                          {build.totalSnapshots}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
                          Total
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 w-full bg-gray-100 flex rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-700"
                        style={{
                          width: `${
                            (build.passedSnapshots / build.totalSnapshots) * 100
                          }%`,
                        }}
                      />
                      <div
                        className="h-full bg-red-500 transition-all duration-700"
                        style={{
                          width: `${
                            (build.changedSnapshots / build.totalSnapshots) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      onClick={(e) => handleDelete(e, build.buildId)}
                      disabled={deletingId === build.buildId}
                    >
                      {deletingId === build.buildId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-gray-200 transition-all">
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default BuildList;
