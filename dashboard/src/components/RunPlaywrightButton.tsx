'use client';

import { useState } from 'react';
import {
  Play, Loader2, CheckCircle, AlertCircle,
  Globe, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface RunPlaywrightButtonProps {
  projectId: string;
}

type ModalState = 'idle' | 'open' | 'running' | 'done' | 'error';

export default function RunPlaywrightButton({ projectId }: RunPlaywrightButtonProps) {
  const router = useRouter();

  const [state,   setState]   = useState<ModalState>('idle');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000');
  const [error,   setError]   = useState('');

  function open() { setState('open'); setError(''); }
  function close() { if (state === 'running') return; setState('idle'); setError(''); }

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setState('running');
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setState('done');
      setTimeout(() => router.push(`/projects/${projectId}/${data.buildId}`), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }

  return (
    <>
      {/* ── Trigger ── */}
      {state === 'running' ? (
        <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black bg-slate-100 text-slate-500 cursor-not-allowed">
          <Loader2 className="h-4 w-4 animate-spin" />Running…
        </button>
      ) : state === 'done' ? (
        <button disabled className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black bg-green-50 text-green-700">
          <CheckCircle className="h-4 w-4" />Done — opening build…
        </button>
      ) : (
        <button onClick={open} className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
          'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
        )}>
          <Play className="h-4 w-4" />Run tests
        </button>
      )}

      {/* ── Modal ── */}
      {(state === 'open' || state === 'running' || state === 'error') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Play className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">Run visual tests</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Playwright will screenshot and diff against Figma baselines
                  </p>
                </div>
              </div>
              <button onClick={close} disabled={state === 'running'}
                className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleRun} className="px-7 py-6 space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Target URL <span className="text-red-400">*</span>
                </label>
                <p className="text-[11px] text-slate-400 font-medium mb-2">
                  The base URL Playwright navigates to. Must be reachable from this machine.
                </p>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:3000"
                    required
                    disabled={state === 'running'}
                    autoFocus
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium',
                      'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300',
                      'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                      'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
                    )}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Authentication is not configured yet — the URL must be publicly accessible or local.
                  Tests run sequentially (1 worker) to avoid file race conditions.
                </p>
              </div>

              {state === 'error' && error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <button type="submit" disabled={state === 'running' || !baseUrl.trim()}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-white transition-colors',
                  state === 'running' || !baseUrl.trim() ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:opacity-90',
                )}>
                {state === 'running'
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Running tests…</>
                  : <><ChevronRight className="h-4 w-4" />Start Playwright run</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}