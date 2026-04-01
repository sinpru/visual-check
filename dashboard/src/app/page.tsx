import { readProjects, readBuilds } from '@visual-check/core';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';

export default async function HomePage() {
	const [projects, builds] = await Promise.all([
		readProjects(),
		readBuilds(),
	]);

	// Sort projects newest-first
	const sorted = [...projects].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	return (
		<main className="max-w-400 mx-auto py-12 px-6 lg:px-12">

			{/* Header */}
			<header className="mb-12 flex items-start justify-between gap-6">
				<div>
					<h1 className="text-4xl font-black text-slate-900 tracking-tight">
						Projects
					</h1>
					<p className="mt-3 text-lg text-slate-500 max-w-2xl font-medium">
						Each project groups your visual test builds together for review.
					</p>
				</div>
				<div className="shrink-0 pt-1">
					<CreateProjectModal />
				</div>
			</header>

			{/* Empty state */}
			{sorted.length === 0 ? (
				<div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
					<div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-6">
						<Layers className="h-8 w-8 text-slate-300" />
					</div>
					<h3 className="text-lg font-black text-slate-900 mb-2">
						No projects yet
					</h3>
					<p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">
						Create your first project to start grouping visual test builds together.
					</p>
					<CreateProjectModal />
				</div>
			) : (
				<div className="space-y-4">
					{sorted.map((project) => {
						// Pass only builds belonging to this project
						const projectBuilds = builds.filter(
							(b) => b.projectId === project.projectId
						);
						return (
							<ProjectCard
								key={project.projectId}
								project={project}
								builds={projectBuilds}
							/>
						);
					})}
				</div>
			)}

			{/* Footer link to all builds */}
			<div className="mt-12 flex justify-center">
				<Link
					href="/builds"
					className="inline-flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
				>
					View all builds
					<ArrowRight className="h-4 w-4" />
				</Link>
			</div>
		</main>
	);
}