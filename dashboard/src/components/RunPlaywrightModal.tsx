'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Loader2,
  AlertCircle,
  Globe,
  X,
  ChevronRight,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  ExternalLink,
  Check,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface RunPlaywrightModalProps {
  projectId: string;
  onClose: () => void;
}

type ModalState = 'idle' | 'running' | 'done' | 'error';

interface AuthStatus {
  exists: boolean;
  savedAt: string | null;
  ageHours: number | null;
}

export default function RunPlaywrightModal({
  projectId,
  onClose,
}: RunPlaywrightModalProps) {
  const router = useRouter();

  const [state, setState] = useState<ModalState>('idle');
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000');
  const [authJwt, setAuthJwt] = useState('');
  const [authJwtKey, setAuthJwtKey] = useState('token');
  const [showJwt, setShowJwt] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isCapturingAuth, setIsCapturingAuth] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<
    'idle' | 'opening' | 'waiting' | 'saving' | 'error'
  >('idle');

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth-status');
      const data = await res.json();
      setAuthStatus(data);
    } catch (err) {
      setAuthStatus({ exists: false, savedAt: null, ageHours: null });
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  async function handleStartCapture() {
    setCaptureStatus('opening');
    setError('');
    try {
      const res = await fetch('/api/auth/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', url: baseUrl }),
      });
      if (!res.ok) throw new Error('Failed to launch browser');
      setIsCapturingAuth(true);
      setCaptureStatus('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCaptureStatus('error');
    }
  }

  async function handleConfirmCapture() {
    setCaptureStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/auth/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm' }),
      });
      if (!res.ok) throw new Error('Failed to save session');
      setIsCapturingAuth(false);
      setCaptureStatus('idle');
      fetchAuthStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCaptureStatus('error');
    }
  }

  async function handleCancelCapture() {
    try {
      await fetch('/api/auth/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
    } catch (err) {}
    setIsCapturingAuth(false);
    setCaptureStatus('idle');
  }

  async function handleRun(e: React.SubmitEvent) {
    e.preventDefault();
    setState('running');
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          ...(authJwt.trim()
            ? {
                authJwt: authJwt.trim(),
                authJwtKey: authJwtKey.trim() || 'token',
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setState('done');
      setTimeout(() => {
        router.push(`/projects/${projectId}/${data.buildId}`);
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== 'running') onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Play className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Run visual tests
              </h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Playwright screenshots and diffs against Figma baselines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={state === 'running'}
            className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleRun} className="px-7 py-6 space-y-5">
          {/* Target URL */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              Target URL <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:3000"
                required
                disabled={state === 'running' || isCapturingAuth}
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

          {/* ── Auth section ── */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            {/* Auth status row */}
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
              {authStatus === null ? (
                <Loader2 className="h-4 w-4 text-slate-400 animate-spin shrink-0" />
              ) : authStatus.exists ? (
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <ShieldOff className="h-4 w-4 text-amber-400 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                {authStatus === null ? (
                  <p className="text-xs text-slate-400 font-medium">
                    Checking auth session…
                  </p>
                ) : authStatus.exists ? (
                  <>
                    <p className="text-xs font-black text-emerald-700">
                      Saved session found
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {authStatus.ageHours! < 1
                        ? 'Saved less than 1 hour ago'
                        : `Saved ${authStatus.ageHours}h ago`}
                      {authStatus.ageHours! > 24 && (
                        <span className="text-amber-500 ml-1.5">
                          · may have expired
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-black text-slate-700">
                      No saved session
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Capture a browser session or use JWT below
                    </p>
                  </>
                )}
              </div>

              {/* Browser Capture Toggle */}
              {!isCapturingAuth ? (
                <button
                  type="button"
                  onClick={handleStartCapture}
                  disabled={captureStatus === 'opening'}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                    'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary shadow-sm',
                    'disabled:opacity-50',
                  )}
                >
                  {captureStatus === 'opening' ? (
                    <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <ExternalLink className="h-3 w-3" />
                      Capture
                    </div>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConfirmCapture}
                    disabled={captureStatus === 'saving'}
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                    title="Finish and Save"
                  >
                    {captureStatus === 'saving' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCapture}
                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors shadow-sm"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Capturing helper message */}
            {isCapturingAuth && (
              <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100">
                <p className="text-[10px] text-emerald-700 font-black flex items-center gap-1.5 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Browser open — log in and click checkmark
                </p>
              </div>
            )}

            {/* JWT fallback toggle */}
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowJwt((v) => !v)}
                className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-800 transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {showJwt ? 'Hide JWT auth' : 'Use JWT token instead'}
              </button>

              {showJwt && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      JWT token
                    </label>
                    <input
                      type="password"
                      value={authJwt}
                      onChange={(e) => setAuthJwt(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiJ9…"
                      disabled={state === 'running'}
                      className={cn(
                        'w-full px-3.5 py-2 rounded-xl border text-sm font-mono',
                        'border-slate-200 bg-white text-slate-900 placeholder:text-slate-300',
                        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                        'disabled:opacity-50 transition-all',
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      localStorage key
                    </label>
                    <input
                      type="text"
                      value={authJwtKey}
                      onChange={(e) => setAuthJwtKey(e.target.value)}
                      placeholder="token"
                      disabled={state === 'running'}
                      className={cn(
                        'w-full px-3.5 py-2 rounded-xl border text-sm font-mono',
                        'border-slate-200 bg-white text-slate-900 placeholder:text-slate-300',
                        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                        'disabled:opacity-50 transition-all',
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {(state === 'error' || captureStatus === 'error') && error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={state === 'running' || !baseUrl.trim() || isCapturingAuth}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-white transition-colors',
              state === 'running' || !baseUrl.trim() || isCapturingAuth
                ? 'bg-primary/50 cursor-not-allowed'
                : 'bg-primary hover:opacity-90',
            )}
          >
            {state === 'running' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running tests…
              </>
            ) : state === 'done' ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Build created!
              </>
            ) : (
              <>
                <ChevronRight className="h-4 w-4" />
                Start Playwright run
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
