import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
// @ts-ignore - Assuming core package will be implemented by Person 1
import { readResults } from '@visual-check/core';
import DiffViewer from '../../../components/DiffViewer';
import StatusBadge from '../../../components/StatusBadge';
import ApproveRejectBar from '../../../components/ApproveRejectBar';

interface PageProps {
  params: {
    testName: string;
  };
}

export default async function TestPage({ params }: PageProps) {
  const { testName } = params;
  
  let results = [];
  try {
    results = await readResults();
  } catch (e) {
    console.error('Failed to read results:', e);
  }

  const result = results.find((r: any) => r.testName === testName);

  if (!result) {
    return notFound();
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 pb-32">
      <div className="mb-8 flex items-center space-x-4">
        <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center transition-colors">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to list
        </Link>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100 mb-10">
        <div className="bg-gray-50 border-b border-gray-100 px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              {result.testName}
              <span className="ml-4">
                <StatusBadge status={result.status} />
              </span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Captured at {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-mono font-bold text-red-600">{result.diffPercent.toFixed(2)}% Diff</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">{result.diffPixels.toLocaleString()} pixels</div>
          </div>
        </div>
        
        <div className="p-8">
          <DiffViewer 
            testName={result.testName}
            baselinePath={result.baselinePath}
            currentPath={result.currentPath}
            diffPath={result.diffPath}
          />
        </div>
      </div>

      <ApproveRejectBar testName={result.testName} status={result.status} />
    </div>
  );
}
