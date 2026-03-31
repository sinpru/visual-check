'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
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
  testName: string;
  buildId: string;
  status: string;
  nextSnapshot?: string;
  prevSnapshot?: string;
}

const ApproveRejectBar: React.FC<ApproveRejectBarProps> = ({
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
            router.push(`/builds/${buildId}/${prevSnapshot}`);
          } else {
            router.push(`/builds/${buildId}`);
          }
          break;
        case 'arrowright':
          if (nextSnapshot) {
            router.push(`/builds/${buildId}/${nextSnapshot}`);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleApprove,
    handleReject,
    buildId,
    nextSnapshot,
    prevSnapshot,
    router,
  ]);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden md:block">
          <p className="font-black text-slate-900">Review Required</p>
          <p className="text-sm text-slate-500 font-medium">
            Decide if these visual changes are intended.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {canReview && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting || isApproving}
                className="flex-1 md:flex-none h-14 px-8 border-2 border-slate-200 rounded-2xl font-black text-slate-600 hover:bg-slate-50 transition-all"
              >
                {isRejecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <X className="mr-2 h-5 w-5" />
                    Reject
                  </>
                )}
              </Button>

              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      disabled={isApproving || isRejecting}
                      className="flex-1 md:flex-none h-14 px-10 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isApproving ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Approve Changes
                        </>
                      )}
                    </Button>
                  }
                />
                <DialogContent className="rounded-3xl max-w-md p-8">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                      Approve visual changes?
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 font-medium pt-2">
                      This will update the baseline for{' '}
                      <span className="text-slate-900 font-bold">
                        {testName}
                      </span>
                      . Future tests will compare against this version.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {}}
                      className="rounded-xl font-bold border-slate-200"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleApprove}
                      className="rounded-xl font-black px-6"
                    >
                      Yes, Approve
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {!canReview && (
            <div className="flex items-center gap-4">
              <p className="text-slate-500 font-bold">
                Status:{' '}
                <span className="text-slate-900 capitalize">
                  {currentStatus}
                </span>
              </p>
              {nextSnapshot && (
                <Button
                  onClick={() =>
                    router.push(`/builds/${buildId}/${nextSnapshot}`)
                  }
                  className="rounded-xl font-black"
                >
                  Next Snapshot
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApproveRejectBar;
