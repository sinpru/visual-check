import { readProjects, readBuilds } from '@visual-check/core';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import BuildList from '@/components/BuildList';
import FigmaSnapshotModal from '@/components/FigmaSnapshotModal';
import RunPlaywrightButton from '@/components/RunPlaywrightButton';
export const dynamic = 'force-dynamic';

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;

  const [projects, builds] = await Promise.all([readProjects(), readBuilds()]);

  const project = projects.find((p) => p.projectId === projectId);
  if (!project) return notFound();

  const projectBuilds = builds.filter((b) => b.projectId === projectId);

  return (
    <main className="max-w-400 mx-auto py-12 px-6 lg:px-12">
      {/* Back */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-all hover:-translate-x-0.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>

      {/* Header */}
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-display">
            {project.name}
          </h1>
          <p className="mt-2 text-base text-gray-500 font-normal">
            {projectBuilds.length} build{projectBuilds.length !== 1 ? 's' : ''}{' '}
            · visual regression test runs
          </p>
        </div>

        {/* Actions: pull Figma baselines first, then run Playwright against them */}
        <div className="shrink-0 pt-1 flex items-center gap-3">
          <RunPlaywrightButton projectId={projectId} />
          <FigmaSnapshotModal
            projectId={projectId}
            projectName={project.name}
          />
        </div>
      </header>

      {/* Build list — only builds belonging to this project */}
      <BuildList builds={projectBuilds} />
    </main>
  );
}
