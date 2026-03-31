import { readResults, ResultEntry } from '@visual-check/core';
import TestTable from '../components/TestTable';

export default async function HomePage() {
  let results: ResultEntry[] = [];
  try {
    results = await readResults();
  } catch (error) {
    console.error('Failed to read results:', error);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Visual Regression Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review and manage visual changes between Figma baselines and
              Playwright screenshots.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>{results.length} Tests Tracked</span>
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <TestTable results={results} />
        </div>
      </div>
    </div>
  );
}
