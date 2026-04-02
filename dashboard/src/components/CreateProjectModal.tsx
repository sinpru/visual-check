'use client';

import React, { useState } from 'react';
import { Loader2, X, FolderPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'idle' | 'open' | 'loading' | 'success' | 'error';

export default function CreateProjectModal() {
	const [step, setStep]   = useState<Step>('idle');
	const [name, setName]   = useState('');
	const [error, setError] = useState('');

	function open() {
		setStep('open');
		setName('');
		setError('');
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
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() }),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

			setStep('success');
			setTimeout(() => window.location.reload(), 1200);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStep('error');
		}
	}

	return (
		<>
			{/* Trigger */}
			<button
				onClick={open}
				className={cn(
					'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold',
					'bg-primary text-white hover:opacity-90 transition-opacity shadow-sm',
				)}
			>
				<FolderPlus className="h-4 w-4" />
				Create project
			</button>

			{/* Backdrop */}
			{step !== 'idle' && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
					onClick={(e) => { if (e.target === e.currentTarget) close(); }}
				>
						<div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

						{/* Header */}
						<div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-slate-100">
							<div className="flex items-center gap-3">
								<div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
									<FolderPlus className="h-4 w-4 text-primary" />
								</div>
								<div>
										<h2 className="text-base font-bold text-gray-900">New project</h2>
									<p className="text-xs text-gray-400 font-normal mt-0.5">
										Projects group your visual test builds together
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

							{/* Success */}
							{step === 'success' && (
								<div className="text-center py-4">
									<div className="h-14 w-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
										<CheckCircle className="h-7 w-7 text-green-500" />
									</div>
									<p className="font-bold text-gray-900 text-lg mb-1">Project created!</p>
									<p className="text-sm text-gray-500 font-normal">
										<span className="font-semibold text-gray-700">{name}</span> is ready
									</p>
								</div>
							)}

							{/* Form */}
							{(step === 'open' || step === 'loading' || step === 'error') && (
								<form onSubmit={handleSubmit} className="space-y-4">
									<div>
										<label className="block text-xs font-semibold text-gray-700 mb-1.5">
											Project name <span className="text-red-400">*</span>
										</label>
										<input
											type="text"
											value={name}
											onChange={(e) => setName(e.target.value)}
											placeholder="e.g. Homepage, Marketing site"
											required
											disabled={step === 'loading'}
											autoFocus
											className={cn(
												'w-full px-4 py-2.5 rounded-lg border text-sm font-normal',
												'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400',
												'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
												'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
											)}
										/>
									</div>

									{step === 'error' && error && (
										<div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-2xl border border-red-100">
											<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
											<p className="text-sm text-red-700 font-medium">{error}</p>
										</div>
									)}

									<button
										type="submit"
										disabled={step === 'loading' || !name.trim()}
										className={cn(
											'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
											'text-sm font-semibold text-white transition-colors',
											step === 'loading' || !name.trim()
												? 'bg-primary/50 cursor-not-allowed'
												: 'bg-primary hover:opacity-90',
										)}
									>
										{step === 'loading' ? (
											<><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
										) : (
											<><FolderPlus className="h-4 w-4" />Create project</>
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