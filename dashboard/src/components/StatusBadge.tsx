import { ResultStatus } from '@visual-check/core';
import React from 'react';

interface StatusBadgeProps {
  status: ResultStatus;
}

const statusColors: Record<ResultStatus, string> = {
  pass: 'bg-green-100 text-green-800 border-green-200',
  fail: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-teal-100 text-teal-800 border-teal-200',
  rejected: 'bg-gray-100 text-gray-800 border-gray-200',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default StatusBadge;
