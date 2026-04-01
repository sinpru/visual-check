// Types
export type {
	FigmaNodeNotFoundError,
	FigmaAssetFetchError,
	ResultStatus,
	BuildStatus,
	FrameDimensions,
	DiffResult,
	ResultEntry,
	BuildEntry,
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
export { readBuilds, createBuild, updateBuild, recalculateBuildStatus } from './src/builds.ts';
