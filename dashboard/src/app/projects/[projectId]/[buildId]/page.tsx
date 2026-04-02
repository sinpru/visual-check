import { readBuilds, readResults } from '@visual-check/core';
import { notFound } from 'next/navigation';
import BuildHeader from '@/components/BuildHeader';
import SnapshotGrid from '@/components/SnapshotGrid';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface BuildPageProps {
  params: Promise<{
    projectId: string;
    buildId: string;
  }>;
}

export default async function BuildPage({ params }: BuildPageProps) {
  const { projectId, buildId } = await params;
  const builds = await readBuilds();
  const build = builds.find((b) => b.buildId === buildId);

  if (!build) {
    return notFound();
  }

  const results = await readResults(buildId);

  return (
    <main className="max-w-400 mx-auto py-12 px-6 lg:px-12">
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 font-medium transition-all hover:-translate-x-0.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Project
        </Link>
      </div>

      <BuildHeader build={build} />

      <SnapshotGrid results={results} buildId={buildId} projectId={projectId} />
    </main>
  );
}

