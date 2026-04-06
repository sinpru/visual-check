'use client';

import React, { useState } from 'react';
import {
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  ImagePlus,
  ChevronRight,
  ChevronLeft,
  Search,
  LayoutGrid,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | 'idle'
  | 'step1'
  | 'discovering'
  | 'error-step1'
  | 'step2'
  | 'pulling'
  | 'error-step2'
  | 'success';

interface DiscoveredFrame {
  id: string;
  name: string;
  pageName: string;
  width: number;
  height: number;
}

interface SelectedFrame extends DiscoveredFrame {
  testName: string;
}

interface FigmaSnapshotModalProps {
  /** When provided, the created build will be tagged with this project. */
  projectId?: string;
  /** Shown in the modal header as context. */
  projectName?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTestName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function parseFileKey(input: string): string {
  try {
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'file' || p === 'design');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL — use as-is
  }
  return input.trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FigmaSnapshotModal({
  projectId,
  projectName,
}: FigmaSnapshotModalProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');

  // Step 1
  const [fileInput, setFileInput] = useState('');
  const [token, setToken] = useState('');
  const [fileName, setFileName] = useState('');
  const [resolvedFileKey, setResolvedFileKey] = useState('');

  // Step 2
  const [frames, setFrames] = useState<DiscoveredFrame[]>([]);
  const [selected, setSelected] = useState<SelectedFrame[]>([]);
  const [search, setSearch] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [createdBuildId, setCreatedBuildId] = useState('');

  // ── Open / close ─────────────────────────────────────────────────────────────

  function open() {
    setStep('step1');
    setError('');
    setFileInput('');
    setToken('');
    setFrames([]);
    setSelected([]);
    setSearch('');
    setCreatedBuildId('');
  }

  function close() {
    setStep('idle');
    setError('');
  }

  // ── Step 1 → discover frames ─────────────────────────────────────────────────

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    setStep('discovering');
    setError('');

    const fileKey = parseFileKey(fileInput);
    setResolvedFileKey(fileKey);

    try {
      const params = new URLSearchParams({ fileKey });
      if (token.trim()) params.set('token', token.trim());

      const res = await fetch(`/api/figma-frames?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      const discovered: DiscoveredFrame[] = data.frames;
      if (discovered.length === 0) {
        throw new Error(
          'No eligible frames found in this file. Make sure the file contains FRAME or COMPONENT nodes.',
        );
      }

      setFileName(data.fileName);
      setFrames(discovered);
      setSelected(
        discovered.map((f) => ({ ...f, testName: toTestName(f.name) })),
      );
      setStep('step2');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error-step1' as Step);
    }
  }

  // ── Step 2: toggle frame selection ──────────────────────────────────────────

  function toggleFrame(frame: DiscoveredFrame) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.id === frame.id);
      if (exists) return prev.filter((s) => s.id !== frame.id);
      return [...prev, { ...frame, testName: toTestName(frame.name) }];
    });
  }

  function toggleAll() {
    if (selected.length === filteredFrames.length) {
      setSelected([]);
    } else {
      setSelected(
        filteredFrames.map((f) => ({ ...f, testName: toTestName(f.name) })),
      );
    }
  }

  function updateTestName(frameId: string, testName: string) {
    setSelected((prev) =>
      prev.map((s) => (s.id === frameId ? { ...s, testName } : s)),
    );
  }

  const filteredFrames = frames.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.pageName.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Step 2 → pull selected frames ───────────────────────────────────────────

  async function handlePull() {
    if (selected.length === 0) return;
    setStep('pulling');
    setError('');

    try {
      const res = await fetch('/api/figma-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileKey: resolvedFileKey,
          ...(token.trim() ? { token: token.trim() } : {}),
          // ← projectId attached here so the build gets tagged with this project
          ...(projectId ? { projectId } : {}),
          frames: selected.map((s) => ({
            nodeId: s.id,
            testName: s.testName,
            width: s.width,
            height: s.height,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      if (data.errors && data.errors.length > 0) {
        const errorList = data.errors
          .map((e: any) => `${e.testName}: ${e.error}`)
          .join('\n');
        setError(`Failed to pull some frames:\n${errorList}`);
        setStep('error-step2');
        return;
      }

      setSavedCount(data.saved?.length ?? selected.length);
      setCreatedBuildId(data.build?.buildId ?? '');
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error-step2');
    }
  }

  // ── Success navigation ───────────────────────────────────────────────────────

  function goToBuild() {
    if (createdBuildId && projectId) {
      router.push(`/projects/${projectId}/${createdBuildId}`);
    } else if (projectId) {
      router.push(`/projects/${projectId}`);
    }
    close();
  }

  function goToProject() {
    if (projectId) {
      router.refresh(); // re-fetch server component data
      close();
    }
  }

  // ── Group frames by page ─────────────────────────────────────────────────────

  const framesByPage = filteredFrames.reduce<Record<string, DiscoveredFrame[]>>(
    (acc, f) => {
      if (!acc[f.pageName]) acc[f.pageName] = [];
      acc[f.pageName].push(f);
      return acc;
    },
    {},
  );

  const isSelected = (id: string) => selected.some((s) => s.id === id);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger ── */}
      <button
        onClick={open}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
          'bg-violet-600 text-white hover:bg-violet-700 transition-colors shadow-sm',
        )}
      >
        <ImagePlus className="h-4 w-4" />
        Pull Figma baselines
      </button>

      {/* ── Backdrop ── */}
      {step !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className={cn(
              'bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col',
              step === 'step2' || step === 'pulling'
                ? 'max-w-2xl max-h-[85vh]'
                : 'max-w-md',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center">
                  <ImagePlus className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {step === 'step2' || step === 'pulling'
                      ? `Select frames — ${fileName}`
                      : 'Pull Figma Baselines'}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {step === 'step2' || step === 'pulling'
                      ? `${selected.length} of ${frames.length} selected`
                      : projectName
                        ? `Baselines for ${projectName}`
                        : 'Snapshot frames will be saved as baselines'}
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
            <div className="flex flex-col overflow-hidden grow">
              {/* ── Success ── */}
              {step === 'success' && (
                <div className="px-7 py-8 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-7 w-7 text-green-500" />
                  </div>
                  <p className="font-black text-slate-900 text-lg mb-1">
                    Baselines saved!
                  </p>
                  <p className="text-sm text-slate-500 font-medium mb-6">
                    {savedCount} frame{savedCount !== 1 ? 's' : ''} pulled from
                    Figma
                    {projectName ? ` for ${projectName}` : ''}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {createdBuildId && (
                      <button
                        onClick={goToBuild}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-violet-600 text-white text-sm font-black hover:bg-violet-700 transition-colors"
                      >
                        <ChevronRight className="h-4 w-4" />
                        View build
                      </button>
                    )}
                    {projectId && (
                      <button
                        onClick={goToProject}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-100 text-slate-700 text-sm font-black hover:bg-slate-200 transition-colors"
                      >
                        Back to project
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 1: credentials ── */}
              {(step === 'step1' ||
                step === 'discovering' ||
                (step as string) === 'error-step1') && (
                <form onSubmit={handleDiscover} className="px-7 py-6 space-y-4">
                  <Field
                    label="Figma file URL or file key"
                    hint="Paste the full Figma URL or just the key from figma.com/file/FILE_KEY/..."
                    value={fileInput}
                    onChange={setFileInput}
                    placeholder="https://www.figma.com/file/ABCDEF.../My-Design"
                    required
                    disabled={step === 'discovering'}
                  />

                  <Field
                    label="Token"
                    hint="Leave blank to use FIGMA_TOKEN from .env"
                    value={token}
                    onChange={setToken}
                    placeholder="figd_xxx... (optional if set in .env)"
                    type="password"
                    disabled={step === 'discovering'}
                  />

                  {(step as string) === 'error-step1' && error && (
                    <ErrorBox message={error} />
                  )}

                  <button
                    type="submit"
                    disabled={step === 'discovering' || !fileInput.trim()}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-2xl',
                      'text-sm font-black text-white transition-colors',
                      step === 'discovering' || !fileInput.trim()
                        ? 'bg-violet-400 cursor-not-allowed'
                        : 'bg-violet-600 hover:bg-violet-700',
                    )}
                  >
                    {step === 'discovering' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Discovering frames…
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-4 w-4" />
                        Discover frames
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* ── Step 2: frame picker ── */}
              {(step === 'step2' ||
                step === 'pulling' ||
                step === 'error-step2') && (
                <>
                  {/* Search + select-all bar */}
                  <div className="px-7 py-4 border-b border-slate-100 shrink-0 flex items-center gap-3">
                    <div className="relative grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search frames…"
                        className={cn(
                          'w-full pl-9 pr-4 py-2 rounded-xl border text-sm font-medium',
                          'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300',
                          'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500',
                        )}
                      />
                    </div>
                    <button
                      onClick={toggleAll}
                      className="shrink-0 text-xs font-black text-violet-600 hover:text-violet-700 px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors"
                    >
                      {selected.length === filteredFrames.length
                        ? 'Deselect all'
                        : 'Select all'}
                    </button>
                  </div>

                  {/* Frame list */}
                  <div className="overflow-y-auto grow px-7 py-4 space-y-5">
                    {Object.entries(framesByPage).map(
                      ([pageName, pageFrames]) => (
                        <div key={pageName}>
                          <div className="flex items-center gap-2 mb-2">
                            <LayoutGrid className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {pageName}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {pageFrames.map((frame) => {
                              const sel = selected.find(
                                (s) => s.id === frame.id,
                              );
                              return (
                                <div
                                  key={frame.id}
                                  className={cn(
                                    'flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer',
                                    isSelected(frame.id)
                                      ? 'border-violet-200 bg-violet-50'
                                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50',
                                  )}
                                  onClick={() => toggleFrame(frame)}
                                >
                                  {/* Checkbox */}
                                  <div
                                    className={cn(
                                      'h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                      isSelected(frame.id)
                                        ? 'border-violet-600 bg-violet-600'
                                        : 'border-slate-300',
                                    )}
                                  >
                                    {isSelected(frame.id) && (
                                      <Check className="h-3 w-3 text-white" />
                                    )}
                                  </div>

                                  {/* Frame info */}
                                  <div className="grow min-w-0">
                                    <p className="text-sm font-black text-slate-900 truncate">
                                      {frame.name}
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium">
                                      {frame.width}×{frame.height}px
                                    </p>
                                  </div>

                                  {/* Editable test name */}
                                  {sel && (
                                    <input
                                      type="text"
                                      value={sel.testName}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        updateTestName(
                                          frame.id,
                                          e.target.value,
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="test-name"
                                      className={cn(
                                        'w-40 px-3 py-1.5 rounded-xl border text-xs font-mono shrink-0',
                                        'border-slate-200 bg-white text-slate-700',
                                        'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500',
                                      )}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Error */}
                  {step === 'error-step2' && error && (
                    <div className="px-7 pb-4">
                      <ErrorBox message={error} />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-7 py-5 border-t border-slate-100 shrink-0 flex items-center gap-3">
                    <button
                      onClick={() => {
                        setStep('step1');
                        setError('');
                      }}
                      disabled={step === 'pulling'}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </button>

                    <button
                      onClick={handlePull}
                      disabled={selected.length === 0 || step === 'pulling'}
                      className={cn(
                        'grow flex items-center justify-center gap-2 py-2.5 rounded-2xl',
                        'text-sm font-black text-white transition-colors',
                        selected.length === 0 || step === 'pulling'
                          ? 'bg-violet-400 cursor-not-allowed'
                          : 'bg-violet-600 hover:bg-violet-700',
                      )}
                    >
                      {step === 'pulling' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Pulling {selected.length} frame
                          {selected.length !== 1 ? 's' : ''}…
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          Pull {selected.length} baseline
                          {selected.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
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
          'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
        )}
      />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-sm text-red-700 font-medium">{message}</p>
    </div>
  );
}
