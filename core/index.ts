// Types
export type {
	ResultStatus,
	BuildStatus,
	ProjectStatus,
	FrameDimensions,
	DiffResult,
	ResultEntry,
	BuildEntry,
	ProjectEntry,
} from './src/types.ts';

export {
	FigmaNodeNotFoundError,
	FigmaAssetFetchError,
} from './src/types.ts';

// Figma
export { getFrameDimensions, fetchFigmaBaseline } from './src/figma.ts';

// Diffing
export { runDiff } from './src/diff.ts';

// Storage
export { saveSnapshot, approveBaseline, getPaths, getSnapshotsDir } from './src/storage.ts';

// Results manifest
export { readResults, writeResult, updateStatus } from './src/results.ts';

// Builds
export { readBuilds, createBuild, updateBuild, recalculateBuildStatus, getOrCreateBuild } from './src/builds.ts';

// Projects
export { readProjects, createProject, updateProject, deleteProject } from './src/projects.ts';