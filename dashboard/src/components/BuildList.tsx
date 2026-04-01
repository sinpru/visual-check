import React from 'react';
import Link from 'next/link';
import { BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import { GitBranch, GitCommit, ChevronRight, ImagePlus } from 'lucide-react';

interface BuildListProps {
  builds: BuildEntry[];
}

const BuildList: React.FC<BuildListProps> = ({ builds }) => {
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
    <div className="space-y-4">
      {builds.map((build) => {
        const isFigma = build.branch === 'figma';
        return (
          <Link
            key={build.buildId}
            href={`/builds/${build.buildId}`}
            className="group block bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-center p-6 sm:p-8">
              <div className="flex-1 min-w-0 pr-8">
                <div className="flex items-center gap-4 mb-3">
                  <h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors truncate tracking-tight">
                    {build.buildId}
                  </h3>
                  <StatusBadge status={build.status} />
                  {isFigma && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#1ABCFE]/10 text-[#0FA8E8] text-[10px] font-black uppercase tracking-wider ring-1 ring-[#1ABCFE]/20">
                      <ImagePlus className="h-3 w-3" />
                      Figma
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    {isFigma ? (
                      <div className="flex items-center gap-2 text-[#0FA8E8] font-bold">
                        <ImagePlus className="h-4 w-4" />
                        Figma baseline
                      </div>
                    ) : (
                      <>
                        <GitBranch className="h-4 w-4 text-slate-400" />
                        <span className="truncate max-w-37.5">
                          {build.branch || 'main'}
                        </span>
                      </>
                    )}
                  </div>
                  {!isFigma && build.commitHash && (
                    <div className="flex items-center gap-2">
                      <GitCommit className="h-4 w-4 text-slate-400" />
                      <span className="font-mono text-xs bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                        {build.commitHash.substring(0, 7)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-slate-200">•</span>
                    <span>{relativeTime(build.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 pr-8 border-r border-slate-100 hidden md:flex">
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-900">
                    {build.changedSnapshots}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Changed
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-400">
                    {build.totalSnapshots}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Total
                  </div>
                </div>
              </div>

              <div className="pl-8 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                  <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </div>

            {/* Progress bar at the bottom */}
            <div className="h-1.5 w-full bg-slate-50 flex">
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
          </Link>
        );
      })}
    </div>
  );
};

export default BuildList;
