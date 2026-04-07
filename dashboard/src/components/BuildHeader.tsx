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
  Trash2,
} from 'lucide-react';
import { relativeTime } from '@/lib/format';
import { useRouter } from 'next/navigation';

interface BuildHeaderProps {
  build: BuildEntry;
}

const BuildHeader: React.FC<BuildHeaderProps> = ({ build }) => {
  const router = useRouter();
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this build? This action cannot be undone.',
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/builds/${build.buildId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete build');
      router.push(`/projects/${build.projectId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to delete build');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-display">
              {build.buildId}
            </h1>
            <StatusBadge status={build.status} />
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm font-normal text-gray-500">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-400" />
              {build.branch || 'main'}
            </div>
            {build.commitHash && (
              <div className="flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-gray-400" />
                <span className="font-mono text-xs">
                  {build.commitHash.substring(0, 7)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              {relativeTime(build.createdAt)}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-gray-900">
              {build.changedSnapshots} changed
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              {build.passedSnapshots} passed
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">{build.totalSnapshots} total</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-xl h-12 px-5 font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete build
              </>
            )}
          </Button>

          {build.status === 'unreviewed' && (
            <Button
              onClick={handleApproveAll}
              disabled={isApprovingAll}
              className="rounded-xl h-12 px-6 font-semibold text-base shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isApprovingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving All...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve all changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuildHeader;
