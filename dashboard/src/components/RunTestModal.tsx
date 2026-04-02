'use client';

import React, { useState } from 'react';
import {
	Loader2, X, Play, ChevronRight, ChevronLeft,
	AlertCircle, CheckCircle, Globe, ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type Step = 'idle' | 'step1' | 'loading' | 'success' | 'error';

interface RunTestModalProps {
	projectId: string;
	projectName: string;
}

export default function RunTestModal({ projectId, projectName }: RunTestModalProps) {
	const router = useRouter();

	const [step, setStep]         = useState<Step>('idle');
	const [error, setError]       = useState('');
	const [figmaUrl, setFigmaUrl] = useState('');
	const [token, setToken]       = useState('');
	const [savedCount, setSavedCount] = useState(0);
	const [buildId, setBuildId]   = useState('');

	function open() {
		setStep('step1');
		setError('');
		setFigmaUrl('');
		setToken('');
	}

	function close() {
		setStep('idle');
		setError('');
	}

	async function handleRun(e: React.FormEvent) {
		e.preventDefault();
		setStep('loading');
		setError('');

		try {
			const res = await fetch(`/api/projects/${projectId}/run`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					figmaUrl: figmaUrl.trim(),
					...(token.trim() ? { token: token.trim() } : {}),
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

			setSavedCount(data.saved?.length ?? 0);
			setBuildId(data.build.buildId);
			setStep('success');
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStep('error');
		}
	}

	function goToBuild() {
		router.push(`/projects/${projectId}/${buildId}`);
	}

	return (
		<>
			{/* Trigger */}
			<button
				onClick={open}
				className={cn(
					'flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black',
					'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
				)}
			>
				<Play className="h-4 w-4" />
				Run test
			</button>

			{/* Backdrop */}
			{step !== 'idle' && (
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
									<h2 className="text-base font-black text-slate-900">
										Run visual test
									</h2>
									<p className="text-xs text-slate-400 font-medium mt-0.5">
										{projectName}
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

							{/* ── Success ── */}
							{step === 'success' && (
								<div className="text-center py-4">
									<div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
										<CheckCircle className="h-7 w-7 text-green-500" />
									</div>
									<p className="font-black text-slate-900 text-lg mb-1">
										Build created!
									</p>
									<p className="text-sm text-slate-500 font-medium mb-6">
										{savedCount} Figma frame{savedCount !== 1 ? 's' : ''} saved as baselines
									</p>
									<button
										onClick={goToBuild}
										className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white text-sm font-black hover:opacity-90 transition-opacity"
									>
										<ChevronRight className="h-4 w-4" />
										View build
									</button>
								</div>
							)}

							{/* ── Step 1: Figma URL ── */}
							{(step === 'step1' || step === 'loading' || step === 'error') && (
								<form onSubmit={handleRun} className="space-y-5">

									{/* Figma section */}
									<div className="space-y-3">
										<div className="flex items-center gap-2 mb-1">
											<ImagePlus className="h-4 w-4 text-violet-500" />
											<span className="text-xs font-black uppercase tracking-widest text-slate-400">
												Figma design
											</span>
										</div>

										<div>
											<label className="block text-xs font-black text-slate-700 mb-1.5">
												Figma file URL <span className="text-red-400">*</span>
											</label>
											<input
												type="text"
												value={figmaUrl}
												onChange={(e) => setFigmaUrl(e.target.value)}
												placeholder="https://www.figma.com/file/ABCDEF.../My-Design"
												required
												disabled={step === 'loading'}
												autoFocus
												className={cn(
													'w-full px-4 py-2.5 rounded-xl border text-sm font-medium',
													'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300',
													'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500',
													'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
												)}
											/>
											<p className="text-[11px] text-slate-400 font-medium mt-1.5">
												All frames in the file will be pulled as baselines
											</p>
										</div>

										<div>
											<label className="block text-xs font-black text-slate-700 mb-1.5">
												Token
											</label>
											<input
												type="password"
												value={token}
												onChange={(e) => setToken(e.target.value)}
												placeholder="figd_xxx... (leave blank to use .env)"
												disabled={step === 'loading'}
												className={cn(
													'w-full px-4 py-2.5 rounded-xl border text-sm font-medium',
													'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300',
													'focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500',
													'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
												)}
											/>
										</div>
									</div>

									{/* Web section — informational only for now */}
									<div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
										<div className="flex items-center gap-2 mb-2">
											<Globe className="h-4 w-4 text-slate-400" />
											<span className="text-xs font-black uppercase tracking-widest text-slate-400">
												Web comparison
											</span>
										</div>
										<p className="text-xs text-slate-400 font-medium">
											Playwright runs automatically via CI or{' '}
											<code className="bg-white px-1.5 py-0.5 rounded-lg border border-slate-200 text-slate-600">
												pnpm test
											</code>
											. Results appear in this build once tests complete.
										</p>
									</div>

									{/* Error */}
									{step === 'error' && error && (
										<div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
											<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
											<p className="text-sm text-red-700 font-medium">{error}</p>
										</div>
									)}

									{/* Submit */}
									<button
										type="submit"
										disabled={step === 'loading' || !figmaUrl.trim()}
										className={cn(
											'w-full flex items-center justify-center gap-2 py-3 rounded-2xl',
											'text-sm font-black text-white transition-colors',
											step === 'loading' || !figmaUrl.trim()
												? 'bg-primary/50 cursor-not-allowed'
												: 'bg-primary hover:opacity-90',
										)}
									>
										{step === 'loading' ? (
											<><Loader2 className="h-4 w-4 animate-spin" />Pulling Figma & creating build…</>
										) : (
											<><Play className="h-4 w-4" />Pull Figma & create build</>
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