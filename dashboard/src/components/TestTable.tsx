import React from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import { ResultEntry } from '@visual-check/core';

interface TestTableProps {
  results: ResultEntry[];
}

const TestTable: React.FC<TestTableProps> = ({ results }) => {
  const sortedResults = [...results].sort((a, b) => {
    // Sort by failure first
    if (a.status === 'fail' && b.status !== 'fail') return -1;
    if (a.status !== 'fail' && b.status === 'fail') return 1;

    // Then sort by timestamp descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));

    if (diffInMins < 1) return 'just now';
    if (diffInMins < 60) return `${diffInMins} min ago`;

    const diffInHours = Math.floor(diffInMins / 60);
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Test Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Diff %
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Viewport
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Timestamp
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedResults.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-6 py-4 text-center text-sm text-gray-500"
              >
                No test results found.
              </td>
            </tr>
          ) : (
            sortedResults.map((result) => (
              <tr key={result.testName} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                  <Link href={`/test/${result.testName}`}>
                    {result.testName}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={result.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.diffPercent?.toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.width}×{result.height}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(result.updatedAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TestTable;
