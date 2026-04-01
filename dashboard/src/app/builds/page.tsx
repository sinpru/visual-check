import { readBuilds } from '@visual-check/core';
import BuildList from '@/components/BuildList';
import FigmaSnapshotModal from '@/components/FigmaSnapshotModal';

export default async function BuildsPage() {
  const builds = await readBuilds();

  return (
    <main className="max-w-400 mx-auto py-12 px-6 lg:px-12">
      <header className="mb-12 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Builds
          </h1>
          <p className="mt-3 text-lg text-slate-500 max-w-2xl font-medium">
            Monitor visual regression test runs across all branches and commits.
          </p>
        </div>

        {/* Compare to Figma — pulls a baseline and creates a Figma build row */}
        <div className="shrink-0 pt-1">
          <FigmaSnapshotModal />
        </div>
      </header>

      <BuildList builds={builds} />
    </main>
  );
}
