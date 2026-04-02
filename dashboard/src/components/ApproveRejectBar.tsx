'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Check,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ApproveRejectBarProps {
  projectId: string;
  testName: string;
  buildId: string;
  status: string;
  nextSnapshot?: string;
  prevSnapshot?: string;
}

const ApproveRejectBar: React.FC<ApproveRejectBarProps> = ({
  projectId,
  testName,
  buildId,
  status,
  nextSnapshot,
  prevSnapshot,
}) => {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  const canReview =
    currentStatus !== 'approved' &&
    currentStatus !== 'pass' &&
    currentStatus !== 'rejected';

  const handleApprove = useCallback(async () => {
    if (!canReview || isApproving || isRejecting) return;

    setIsApproving(true);
    const prevStatus = currentStatus;
    setCurrentStatus('approved'); // Optimistic

    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testName, buildId }),
      });

      if (!res.ok) throw new Error('Failed to approve');

      router.refresh();
      if (nextSnapshot) {
        router.push(`/builds/${buildId}/${nextSnapshot}`);
      } else {
        router.push(`/builds/${buildId}`);
      }
    } catch (error) {
      console.error(error);
      setCurrentStatus(prevStatus);
    } finally {
      setIsApproving(false);
    }
  }, [
    buildId,
    canReview,
    currentStatus,
    isApproving,
    isRejecting,
    nextSnapshot,
    projectId,
    router,
    testName,
  ]);

  const handleReject = useCallback(async () => {
    if (!canReview || isRejecting || isApproving) return;

    setIsRejecting(true);
    const prevStatus = currentStatus;
    setCurrentStatus('rejected'); // Optimistic

    try {
      const res = await fetch('/api/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testName, buildId }),
      });

      if (!res.ok) throw new Error('Failed to reject');

      router.refresh();
      if (nextSnapshot) {
        router.push(`/builds/${buildId}/${nextSnapshot}`);
      } else {
        router.push(`/builds/${buildId}`);
      }
    } catch (error) {
      console.error(error);
      setCurrentStatus(prevStatus);
    } finally {
      setIsRejecting(false);
    }
  }, [
    buildId,
    canReview,
    currentStatus,
    isApproving,
    isRejecting,
    nextSnapshot,
    projectId,
    router,
    testName,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          handleApprove();
          break;
        case 'r':
          handleReject();
          break;
        case 'arrowleft':
          if (prevSnapshot) {
            router.push(`/projects/${projectId}/${buildId}/${prevSnapshot}`);
          } else {
            router.push(`/projects/${projectId}/${buildId}`);
          }
          break;
        case 'arrowright':
          if (nextSnapshot) {
            router.push(`/projects/${projectId}/${buildId}/${nextSnapshot}`);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleApprove,
    handleReject,
    handleReject,
    projectId,
    buildId,
    nextSnapshot,
    prevSnapshot,
    router,
  ]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-5xl bg-white/80 backdrop-blur-2xl border border-slate-200 p-4 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 ring-1 ring-slate-200/50">
      <div className="flex items-center justify-between gap-8 px-4">
        <div className="hidden lg:flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-2xl">
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="font-black text-slate-900 tracking-tight">
              Review Required
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Keyboard:{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">
                A
              </kbd>{' '}
              Approve ·{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">
                R
              </kbd>{' '}
              Reject
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 lg:flex-none">
          {canReview ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting || isApproving}
                className="flex-1 lg:flex-none h-14 px-8 border-2 border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
              >
                {isRejecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <X className="mr-2 h-5 w-5 text-red-500" />
                    Reject
                  </>
                )}
              </Button>

              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      disabled={isApproving || isRejecting}
                      className="flex-1 lg:flex-none h-14 px-10 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isApproving ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Approve
                        </>
                      )}
                    </Button>
                  }
                />
                <DialogContent className="rounded-[2.5rem] max-w-md p-10 ring-1 ring-slate-200/50">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight">
                      Confirm Approval
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium pt-4 text-base leading-relaxed">
                      You are about to approve visual changes for{' '}
                      <span className="text-slate-900 font-black">
                        {testName}
                      </span>
                      . This will set the current snapshot as the new ground
                      truth.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-10 flex flex-col sm:flex-row gap-4">
                    <Button
                      variant="ghost"
                      className="rounded-2xl font-bold text-slate-500 h-12"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApprove}
                      className="rounded-2xl font-black px-8 h-12 shadow-lg shadow-primary/20"
                    >
                      Yes, Approve Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex items-center gap-6 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Status
                </span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black uppercase tracking-widest shadow-sm">
                  {currentStatus}
                </span>
              </div>

              <div className="w-px h-6 bg-slate-200" />

              <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
                Review Complete
                <Check className="h-4 w-4 text-green-500" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              prevSnapshot
                ? router.push(`/projects/${projectId}/${buildId}/${prevSnapshot}`)
                : router.push(`/projects/${projectId}/${buildId}`)
            }
            className="h-14 w-14 rounded-2xl hover:bg-slate-100"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!nextSnapshot}
            onClick={() =>
              nextSnapshot && router.push(`/projects/${projectId}/${buildId}/${nextSnapshot}`)
            }
            className="h-14 w-14 rounded-2xl hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApproveRejectBar;
