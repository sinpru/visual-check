'use client';

import React, { useState } from 'react';
import { ResultEntry } from '@visual-check/core';
import SnapshotCard from './SnapshotCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  ListFilter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SnapshotGridProps {
  results: ResultEntry[];
  buildId: string;
}

const SnapshotGrid: React.FC<SnapshotGridProps> = ({ results, buildId }) => {
  const [filter, setFilter] = useState('changed');

  const filteredResults = results.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'changed')
      return r.status === 'fail' || r.status === 'pending';
    if (filter === 'passed')
      return r.status === 'pass' || r.status === 'approved';
    return true;
  });

  const countByStatus = (statusGroup: 'all' | 'changed' | 'passed') => {
    if (statusGroup === 'all') return results.length;
    if (statusGroup === 'changed')
      return results.filter(
        (r) => r.status === 'fail' || r.status === 'pending',
      ).length;
    if (statusGroup === 'passed')
      return results.filter(
        (r) => r.status === 'pass' || r.status === 'approved',
      ).length;
    return 0;
  };

  return (
    <div className="space-y-10">
      <Tabs
        value={filter}
        onValueChange={setFilter}
        className="w-full flex-col"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
          <TabsList className="bg-slate-100 p-1.5 rounded-4xl border border-slate-200 shadow-inner w-fit h-auto">
            <TabsTrigger
              value="all"
              className="px-8 py-3 rounded-3xl font-black text-sm transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary text-slate-500 gap-3"
            >
              <LayoutGrid className="h-4 w-4" />
              All
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] text-slate-400 group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary transition-colors">
                {countByStatus('all')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="changed"
              className="px-8 py-3 rounded-3xl font-black text-sm transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-destructive text-slate-500 gap-3"
            >
              <AlertCircle className="h-4 w-4" />
              Changed
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] text-slate-400 group-data-[state=active]:bg-destructive/10 group-data-[state=active]:text-destructive transition-colors">
                {countByStatus('changed')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="px-8 py-3 rounded-3xl font-black text-sm transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-green-600 text-slate-500 gap-3"
            >
              <CheckCircle2 className="h-4 w-4" />
              Passed
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-slate-100 text-[10px] text-slate-400 group-data-[state=active]:bg-green-100 group-data-[state=active]:text-green-600 transition-colors">
                {countByStatus('passed')}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
            <ListFilter className="h-4 w-4 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Filtering
            </span>
            <span className="text-sm font-black text-slate-900">
              {filteredResults.length} snapshots
            </span>
          </div>
        </div>

        <div className="pt-10">
          {filteredResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-10">
              {filteredResults.map((result) => (
                <SnapshotCard
                  key={result.testName}
                  result={result}
                  buildId={buildId}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white rounded-[3rem] border border-slate-200 shadow-sm ring-1 ring-slate-100">
              <div className="inline-flex items-center justify-center p-6 bg-slate-50 rounded-full mb-6">
                <LayoutGrid className="h-12 w-12 text-slate-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                No snapshots found
              </h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                We couldn&apos;t find any snapshots matching your current
                filter:{' '}
                <span className="text-slate-900 font-black capitalize">
                  {filter}
                </span>
                .
              </p>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default SnapshotGrid;
