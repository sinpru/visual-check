import React from 'react';
import Link from 'next/link';
import { BuildEntry } from '@visual-check/core';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import { GitBranch, GitCommit, ChevronRight } from 'lucide-react';

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
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-75 font-black uppercase tracking-widest text-[10px] text-slate-400 py-6">
              Build ID / Branch
            </TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">
              Status
            </TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">
              Changed
            </TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">
              Total
            </TableHead>
            <TableHead className="font-black uppercase tracking-widest text-[10px] text-slate-400">
              Created At
            </TableHead>
            <TableHead className="w-12.5"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {builds.map((build) => (
            <TableRow key={build.buildId} className="group cursor-pointer">
              <TableCell className="py-6">
                <Link href={`/builds/${build.buildId}`} className="block">
                  <div className="font-black text-slate-900 group-hover:text-primary transition-colors mb-1">
                    {build.buildId}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3 text-slate-400" />
                      {build.branch || 'main'}
                    </div>
                    {build.commitHash && (
                      <div className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3 text-slate-400" />
                        {build.commitHash.substring(0, 7)}
                      </div>
                    )}
                  </div>
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={build.status} />
              </TableCell>
              <TableCell>
                <span className="font-black text-slate-900">
                  {build.changedSnapshots}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-bold text-slate-500">
                  {build.totalSnapshots}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm font-medium text-slate-500">
                  {relativeTime(build.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-900 transition-colors" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default BuildList;
