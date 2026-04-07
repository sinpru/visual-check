import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      status: {
        pass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        fail: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        failed: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        approved: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
        rejected: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
        unreviewed: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
        passed: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  },
);

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    Omit<VariantProps<typeof badgeVariants>, 'status'> {
  status?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(badgeVariants({ status: status as any }), className)}
      {...props}
    >
      {status}
    </div>
  );
};

export default StatusBadge;
