'use client';

import React, { useState } from 'react';
import { ImagePlus, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'idle' | 'open' | 'loading' | 'success' | 'error';

interface FigmaSnapshotResult {
  build: { buildId: string; createdAt: string };
  testName: string;
  width: number;
  height: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FigmaSnapshotModal() {
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<FigmaSnapshotResult | null>(null);

  // Form fields
  const [testName, setTestName] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [token, setToken] = useState('');

  function open() {
    setStep('open');
    setError('');
    setResult(null);
  }

  function close() {
    setStep('idle');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep('loading');
    setError('');

    try {
      const res = await fetch('/api/figma-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName: testName.trim(),
          nodeId: nodeId.trim(),
          // Only send if filled — API falls back to env vars if omitted
          ...(fileKey.trim() ? { fileKey: fileKey.trim() } : {}),
          ...(token.trim() ? { token: token.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      setResult(data as FigmaSnapshotResult);
      setStep('success');

      // Refresh the builds list after a short delay so the user sees the
      // success state before the page reloads
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={open}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
          'bg-[#1ABCFE] text-white hover:bg-[#0FA8E8] transition-colors shadow-sm',
          'shadow-[#1ABCFE]/20',
        )}
      >
        <ImagePlus className="h-4 w-4" />
        Compare to Figma
      </button>

      {/* ── Modal backdrop ── */}
      {step !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#1ABCFE]/10 flex items-center justify-center">
                  <ImagePlus className="h-4 w-4 text-[#1ABCFE]" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Pull Figma Baseline
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Snapshot will be saved as the baseline for future
                    comparisons
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-7 py-6">
              {/* ── Success state ── */}
              {step === 'success' && result && (
                <div className="text-center py-4">
                  <div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-7 w-7 text-green-500" />
                  </div>
                  <p className="font-black text-slate-900 text-lg mb-1">
                    Baseline saved!
                  </p>
                  <p className="text-sm text-slate-500 font-medium">
                    <span className="font-black text-slate-700">
                      {result.testName}
                    </span>{' '}
                    — {result.width}×{result.height}px
                  </p>
                  <p className="text-xs text-slate-400 mt-3">
                    Refreshing builds list…
                  </p>
                </div>
              )}

              {/* ── Form state ── */}
              {(step === 'open' || step === 'loading' || step === 'error') && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field
                    label="Test name"
                    hint="Unique key for this snapshot (e.g. homepage-hero)"
                    value={testName}
                    onChange={setTestName}
                    placeholder="homepage-hero"
                    required
                    disabled={step === 'loading'}
                  />

                  <Field
                    label="Node ID"
                    hint={
                      <>
                        Right-click frame in Figma → Copy link →{' '}
                        <code className="bg-slate-100 px-1 rounded text-[11px]">
                          ?node-id=1%3A23
                        </code>
                      </>
                    }
                    value={nodeId}
                    onChange={setNodeId}
                    placeholder="1:23"
                    required
                    disabled={step === 'loading'}
                  />

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                      Credentials{' '}
                      <span className="normal-case font-medium tracking-normal">
                        (leave blank to use .env)
                      </span>
                    </p>

                    <div className="space-y-3">
                      <Field
                        label="File key"
                        hint="From the Figma URL: figma.com/file/FILE_KEY/..."
                        value={fileKey}
                        onChange={setFileKey}
                        placeholder="ABCDEF1234567890 (or set FIGMA_FILE_KEY in .env)"
                        disabled={step === 'loading'}
                      />

                      <Field
                        label="Token"
                        hint="Figma Personal Access Token"
                        value={token}
                        onChange={setToken}
                        placeholder="figd_xxx... (or set FIGMA_TOKEN in .env)"
                        type="password"
                        disabled={step === 'loading'}
                      />
                    </div>
                  </div>

                  {/* Error message */}
                  {step === 'error' && error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700 font-medium">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={step === 'loading'}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-2xl',
                      'text-sm font-black text-white transition-colors',
                      step === 'loading'
                        ? 'bg-[#1ABCFE]/60 cursor-not-allowed'
                        : 'bg-[#1ABCFE] hover:bg-[#0FA8E8]',
                    )}
                  >
                    {step === 'loading' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Pulling from Figma…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" />
                        Pull baseline
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Field sub-component ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: string;
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  type = 'text',
}: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-black text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && (
        <p className="text-[11px] text-slate-400 font-medium mb-1.5">{hint}</p>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl border text-sm font-medium',
          'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300',
          'focus:outline-none focus:ring-2 focus:ring-[#1ABCFE]/30 focus:border-[#1ABCFE]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all',
        )}
      />
    </div>
  );
}
