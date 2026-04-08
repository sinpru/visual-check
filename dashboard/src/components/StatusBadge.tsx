import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      status: {
        pass: 'bg-green-100 text-green-700 hover:bg-green-100/80',
        fail: 'bg-red-100 text-red-700 hover:bg-red-100/80',
        pending: 'bg-amber-100 text-amber-700 hover:bg-amber-100/80',
        approved: 'bg-blue-100 text-blue-700 hover:bg-blue-100/80',
        rejected: 'bg-slate-100 text-slate-700 hover:bg-slate-100/80',
        unreviewed: 'bg-amber-100 text-amber-700 hover:bg-amber-100/80',
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
