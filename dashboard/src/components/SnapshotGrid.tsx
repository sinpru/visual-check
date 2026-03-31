'use client';

import React, { useState } from 'react';
import { ResultEntry } from '@visual-check/core';
import SnapshotCard from './SnapshotCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  return (
    <div className="space-y-8">
      <Tabs defaultValue="changed" onValueChange={setFilter} className="w-full">
        <div className="flex items-center justify-between mb-8">
          <TabsList className="bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            <TabsTrigger
              value="all"
              className="px-6 py-2.5 rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="changed"
              className="px-6 py-2.5 rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500"
            >
              Changed
            </TabsTrigger>
            <TabsTrigger
              value="passed"
              className="px-6 py-2.5 rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500"
            >
              Passed
            </TabsTrigger>
          </TabsList>

          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Showing {filteredResults.length} of {results.length} snapshots
          </p>
        </div>

        <TabsContent value={filter} className="mt-0">
          {filteredResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredResults.map((result) => (
                <SnapshotCard
                  key={result.testName}
                  result={result}
                  buildId={buildId}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-2">
                No snapshots found
              </h3>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">
                No snapshots match the current filter criteria.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SnapshotGrid;
