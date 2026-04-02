"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import { GitBranch, GitCommit, ChevronRight, ImagePlus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BuildListProps {
  builds: BuildEntry[];
}

const BuildList: React.FC<BuildListProps> = ({ builds }) => {
  const router = useRouter();

  if (builds.length === 0) {
    return (
      <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 mb-2">
          No builds yet
        </h3>
        <p className="text-slate-500 font-medium max-w-sm mx-auto">
          Run your Playwright tests to create the first build and start
          reviewing changes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50 [&_th]:border-b-0">
            <TableHead className="w-[280px] font-black uppercase tracking-wider text-[10px] text-slate-500 py-3 px-4">
              Build
            </TableHead>
            <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Context
            </TableHead>
            <TableHead className="font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Status
            </TableHead>
            <TableHead className="text-right font-black uppercase tracking-wider text-[10px] text-slate-500 py-3">
              Stats
            </TableHead>
            <TableHead className="w-[50px] py-3 px-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {builds.map((build) => {
            const isFigma = build.branch === 'figma';

            return (
              <TableRow
                key={build.buildId}
                className="group cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => router.push(`/projects/${build.projectId}/${build.buildId}`)}
              >
                <TableCell className="py-2.5 px-4 max-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-black text-slate-900 group-hover:text-primary transition-colors tracking-tight text-sm truncate">
                      {build.buildId}
                    </span>
                    <div className="text-[11px] font-medium text-slate-400">
                      {relativeTime(build.createdAt)}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2">
                    {isFigma ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#1ABCFE]/10 text-[#0FA8E8] text-[11px] font-bold ring-1 ring-[#1ABCFE]/20">
                        <ImagePlus className="h-3 w-3" />
                        Figma baseline
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                          <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate max-w-[120px]">
                            {build.branch || 'main'}
                          </span>
                        </div>
                        {build.commitHash && (
                          <div className="flex items-center gap-1.5">
                            <GitCommit className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-[10px] bg-slate-100/50 px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-500">
                              {build.commitHash.substring(0, 7)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>

                <TableCell className="py-2.5">
                  <StatusBadge status={build.status} />
                </TableCell>

                <TableCell className="py-2.5 text-right w-[140px]">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-end gap-2 text-sm">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-slate-900">
                          {build.changedSnapshots}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Changed
                        </span>
                      </div>
                      <span className="text-slate-200 text-xs">/</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-slate-400">
                          {build.totalSnapshots}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          Total
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 flex rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-1000"
                        style={{
                          width: `${
                            (build.passedSnapshots / build.totalSnapshots) * 100
                          }%`,
                        }}
                      />
                      <div
                        className="h-full bg-destructive transition-all duration-1000"
                        style={{
                          width: `${
                            (build.changedSnapshots / build.totalSnapshots) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </TableCell>

                <TableCell className="py-2.5 px-4 text-right">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
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
