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

interface SnapshotGridProps {
  results: ResultEntry[];
  buildId: string;
  projectId?: string;
}

const SnapshotGrid: React.FC<SnapshotGridProps> = ({
  results,
  buildId,
  projectId,
}) => {
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
    <div className="space-y-8">
      <Tabs
        value={filter}
        onValueChange={setFilter}
        className="w-full flex-col"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <TabsList className="bg-gray-100 p-1 rounded-xl border border-gray-200 w-fit h-auto">
            <TabsTrigger
              value="all"
              className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-gray-500 gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              All
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] text-gray-400 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-colors">
                {countByStatus('all')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="changed"
              className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-red-600 text-gray-500 gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Changed
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] text-gray-400 data-[state=active]:bg-red-50 data-[state=active]:text-red-600 transition-colors">
                {countByStatus('changed')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-emerald-600 text-gray-500 gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Passed
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] text-gray-400 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-600 transition-colors">
                {countByStatus('passed')}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm">
            <ListFilter className="h-4 w-4 text-gray-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Showing
            </span>
            <span className="text-sm font-medium text-gray-900">
              {filteredResults.length} snapshots
            </span>
          </div>
        </div>

        <div className="pt-8">
          {filteredResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
              {filteredResults.map((result) => (
                <SnapshotCard
                  key={result.testName}
                  result={result}
                  buildId={buildId}
                  projectId={projectId}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="inline-flex items-center justify-center p-5 bg-gray-50 rounded-full mb-5">
                <LayoutGrid className="h-10 w-10 text-gray-200" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">
                No snapshots found
              </h3>
              <p className="text-gray-500 font-normal max-w-sm mx-auto leading-relaxed">
                No snapshots match the current filter:{' '}
                <span className="text-gray-900 font-semibold capitalize">
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
