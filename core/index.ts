// Types
export type {
	ResultStatus,
	BuildStatus,
	ProjectStatus,
	FrameDimensions,
	DiffResult,
	DiffRegion,
	ResultEntry,
	BuildEntry,
	ProjectEntry,
	FigmaNodeDocument,
	FigmaNodeBoundingBox,
} from './src/types.ts';

export {
	FigmaNodeNotFoundError,
	FigmaAssetFetchError,
} from './src/types.ts';

// Figma
export {
	getFrameDimensions,
	fetchFigmaBaseline,
	fetchFigmaBaselineWithTree,
	fetchNodeTree,
	findFigmaNodeForRegion,
} from './src/figma.ts';

// Diffing
export { runDiff } from './src/diff.ts';

// Storage
export {
	saveSnapshot,
	approveBaseline,
	getPaths,
	baselineRelPath,
	getSnapshotsDir,
	saveFigmaNodeTree,
	loadFigmaNodeTree,
} from './src/storage.ts';

// Results manifest
export {
	readResults,
	writeResult,
	updateStatus,
	updateRegionAnalysis,
} from './src/results.ts';

// Builds
export {
	readBuilds,
	createBuild,
	updateBuild,
	getOrCreateBuild,
	recalculateBuildStatus,
} from './src/builds.ts';

// Projects
export {
	readProjects,
	createProject,
	updateProject,
	deleteProject,
} from './src/projects.ts';