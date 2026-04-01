'use client';

import React, { useState } from 'react';
import { Columns, Loader2, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import DiffViewer from './DiffViewer';

type Step = 'idle' | 'loading' | 'success' | 'error';

interface CompareResult {
  baselinePath: string;
  currentPath: string;
  diffPath: string;
  diffPixels: number;
  diffPercent: number;
}

export default function CompareDemoButton() {
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);

  async function handleDemo() {
    setStep('loading');
    setError('');

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseline: 'baselines/homepage-hero.png',
          current: 'baselines/test.png',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      setResult(data as CompareResult);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }

  function close() {
    setStep('idle');
    setResult(null);
    setError('');
  }

  return (
    <>
      <button
        onClick={handleDemo}
        disabled={step === 'loading'}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
          'bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm',
          'shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {step === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Columns className="h-4 w-4" />
        )}
        Compare Demo
      </button>

      {/* Full screen modal for diff viewer */}
      {step === 'success' && result && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Demo Comparison Result
              </h2>
              <div className="flex gap-4 text-sm font-medium text-slate-500 mt-1">
                <span>{result.diffPixels} pixels changed</span>
                <span>{result.diffPercent.toFixed(2)}% difference</span>
              </div>
            </div>
            <button
              onClick={close}
              className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold transition-colors"
            >
              Close Demo
            </button>
          </div>

          <div className="p-8 pb-32 max-w-[1600px] w-full mx-auto">
            <DiffViewer
              testName="demo-test"
              baselinePath={result.baselinePath}
              currentPath={result.currentPath}
              diffPath={result.diffPath}
            />
          </div>
        </div>
      )}

      {/* Error state modal (simple) */}
      {step === 'error' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="font-black text-lg text-slate-900">Demo Failed</h3>
            </div>
            <p className="text-sm text-slate-600 font-medium mb-6">{error}</p>
            <button
              onClick={close}
              className="w-full py-3 bg-slate-100 text-slate-900 font-black rounded-xl hover:bg-slate-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
