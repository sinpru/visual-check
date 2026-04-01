import React from 'react';
import Link from 'next/link';
import { ProjectEntry, BuildEntry } from '@visual-check/core';
import StatusBadge from './StatusBadge';
import { relativeTime } from '@/lib/format';
import { ChevronRight, GitBranch, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
	project: ProjectEntry;
	builds: BuildEntry[]; // all builds belonging to this project
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, builds }) => {
	// Sort builds newest-first, pick the latest
	const sorted     = [...builds].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
	const latest     = sorted[0];
	const buildCount = builds.length;

	return (
		<Link
			href={`/projects/${project.projectId}`}
			className="group block bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden"
		>
			<div className="flex items-center p-6 sm:p-8">
				{/* Left — project info */}
				<div className="flex-1 min-w-0 pr-8">
					<div className="flex items-center gap-4 mb-3">
						<h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors truncate tracking-tight">
							{project.name}
						</h3>
						{latest && <StatusBadge status={latest.status} />}
					</div>

					<div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-sm font-medium text-slate-500">
						<div className="flex items-center gap-2">
							<Layers className="h-4 w-4 text-slate-400" />
							<span>
								{buildCount} build{buildCount !== 1 ? 's' : ''}
							</span>
						</div>
						{latest?.branch && (
							<div className="flex items-center gap-2">
								<GitBranch className="h-4 w-4 text-slate-400" />
								<span className="truncate max-w-[150px]">{latest.branch}</span>
							</div>
						)}
						<div className="flex items-center gap-2 text-slate-400">
							<span className="text-slate-200">•</span>
							<span>Updated {relativeTime(project.updatedAt)}</span>
						</div>
					</div>
				</div>

				{/* Middle — snapshot stats from latest build */}
				{latest && (
					<div className="hidden md:flex items-center gap-8 pr-8 border-r border-slate-100">
						<div className="text-center">
							<div className="text-2xl font-black text-slate-900">
								{latest.changedSnapshots}
							</div>
							<div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
								Changed
							</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-black text-slate-400">
								{latest.totalSnapshots}
							</div>
							<div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
								Total
							</div>
						</div>
					</div>
				)}

				{/* Right — chevron */}
				<div className={cn('flex items-center gap-4', latest ? 'pl-8' : 'pl-0')}>
					<div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
						<ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-primary transition-colors" />
					</div>
				</div>
			</div>

			{/* Progress bar — only when latest build exists */}
			{latest && latest.totalSnapshots > 0 && (
				<div className="h-1.5 w-full bg-slate-50 flex">
					<div
						className="h-full bg-green-500 transition-all duration-1000"
						style={{
							width: `${(latest.passedSnapshots / latest.totalSnapshots) * 100}%`,
						}}
					/>
					<div
						className="h-full bg-destructive transition-all duration-1000"
						style={{
							width: `${(latest.changedSnapshots / latest.totalSnapshots) * 100}%`,
						}}
					/>
				</div>
			)}
		</Link>
	);
};

export default ProjectCard;