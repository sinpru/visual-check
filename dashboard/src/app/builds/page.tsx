import { readBuilds } from '@visual-check/core';
import BuildList from '@/components/BuildList';

export default async function BuildsPage() {
  const builds = await readBuilds();

  return (
    <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
          Builds
        </h1>
        <p className="mt-3 text-lg text-slate-500 max-w-2xl font-medium">
          Monitor visual regression test runs across all branches and commits.
        </p>
      </header>

      <BuildList builds={builds} />
    </main>
  );
}
