'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApproveRejectBarProps {
  testName: string;
  status: string;
}

const ApproveRejectBar: React.FC<ApproveRejectBarProps> = ({
  testName,
  status,
}) => {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  if (currentStatus === 'approved' || currentStatus === 'pass') {
    return null;
  }

  const handleApprove = async () => {
    if (
      !confirm(
        `Are you sure you want to approve "${testName}" as the new baseline?`,
      )
    ) {
      return;
    }

    const previousStatus = currentStatus;
    setCurrentStatus('approved'); // Optimistic update
    setIsPending(true);

    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        body: JSON.stringify({ testName }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to approve');
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setCurrentStatus(previousStatus); // Revert on error
      alert('Failed to approve baseline.');
    } finally {
      setIsPending(false);
    }
  };

  const handleReject = async () => {
    const previousStatus = currentStatus;
    setCurrentStatus('rejected'); // Optimistic update
    setIsPending(true);

    try {
      const res = await fetch('/api/reject', {
        method: 'POST',
        body: JSON.stringify({ testName }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Failed to reject');
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setCurrentStatus(previousStatus); // Revert on error
      alert('Failed to reject result.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg flex justify-center space-x-4 z-50">
      <button
        onClick={handleReject}
        disabled={isPending}
        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        Reject Changes
      </button>
      <button
        onClick={handleApprove}
        disabled={isPending}
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        Approve as Baseline
      </button>
    </div>
  );
};

export default ApproveRejectBar;
