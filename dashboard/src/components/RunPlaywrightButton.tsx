'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface RunPlaywrightButtonProps {
  projectId: string;
}

type State = 'idle' | 'running' | 'done' | 'error';

export default function RunPlaywrightButton({ projectId }: RunPlaywrightButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function handleRun() {
    setState('running');
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      setState('done');

      // Navigate to the new build after a brief success flash
      setTimeout(() => router.push(`/builds/${data.buildId}`), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }

  if (state === 'running') {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black bg-slate-100 text-slate-500 cursor-not-allowed"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Running tests…
      </button>
    );
  }

  if (state === 'done') {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black bg-green-50 text-green-700"
      >
        <CheckCircle className="h-4 w-4" />
        Done — opening build…
      </button>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium max-w-48">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate" title={error}>{error}</span>
        </div>
        <button
          onClick={handleRun}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
            'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
          )}
        >
          <Play className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRun}
      className={cn(
        'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
        'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
      )}
    >
      <Play className="h-4 w-4" />
      Run tests
    </button>
  );
}