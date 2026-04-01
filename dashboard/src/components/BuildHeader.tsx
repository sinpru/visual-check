'use client';

import React, { useState } from 'react';
import { BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  GitBranch,
  GitCommit,
  Calendar,
} from 'lucide-react';
import { relativeTime } from '@/lib/format';
import { useRouter } from 'next/navigation';

interface BuildHeaderProps {
  build: BuildEntry;
}

const BuildHeader: React.FC<BuildHeaderProps> = ({ build }) => {
  const router = useRouter();
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const handleApproveAll = async () => {
    if (
      !confirm(
        'Are you sure you want to approve ALL changed snapshots in this build?',
      )
    ) {
      return;
    }

    setIsApprovingAll(true);
    try {
      const res = await fetch('/api/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildId: build.buildId }),
      });

      if (!res.ok) throw new Error('Failed to approve all');

      router.refresh();
    } catch (error) {
      console.error(error);
      alert('Failed to approve all snapshots.');
    } finally {
      setIsApprovingAll(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {build.buildId}
            </h1>
            <StatusBadge status={build.status} className="scale-110" />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-slate-400" />
              {build.branch || 'main'}
            </div>
            {build.commitHash && (
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-slate-400" />
                {build.commitHash.substring(0, 7)}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              {relativeTime(build.createdAt)}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-slate-900">
              {build.changedSnapshots} changed
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">
              {build.passedSnapshots} passed
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{build.totalSnapshots} total</span>
          </div>
        </div>

        {build.status === 'unreviewed' && (
          <Button
            onClick={handleApproveAll}
            disabled={isApprovingAll}
            className="rounded-2xl h-14 px-8 font-black text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isApprovingAll ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Approving All...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-3 h-5 w-5" />
                Approve all changes
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default BuildHeader;
